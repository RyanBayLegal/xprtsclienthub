import { useState, useEffect, DragEvent, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Plus, X, Search } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/lib/auth";
import { logAudit, getUserName } from "@/lib/audit-logger";

const DEFAULT_STAGES = ["Prospect", "Qualified", "Active", "Signed", "Inactive"];
const CLIENTS_KANBAN_STAGES_KEY = "clients_kanban_custom_stages";

const STAGE_COLORS: Record<string, string> = {
  Prospect: "bg-blue-500/10 border-blue-500/30",
  Qualified: "bg-amber-500/10 border-amber-500/30",
  Active: "bg-emerald-500/10 border-emerald-500/30",
  Signed: "bg-teal-500/10 border-teal-500/30",
  Inactive: "bg-gray-500/10 border-gray-500/30",
};

interface ClientRow {
  id: string;
  name: string;
  company: string | null;
  role: string | null;
  stage: string | null;
  practice_area: string | null;
  client_health_score: number | null;
  stage_changed_at: string | null;
  avatar_url: string | null;
}

interface ClientsKanbanProps {
  refreshKey?: number;
}

export default function ClientsKanban({ refreshKey }: ClientsKanbanProps) {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [stages, setStages] = useState<string[]>(() => {
    const stored = localStorage.getItem(CLIENTS_KANBAN_STAGES_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_STAGES;
  });
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({});
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    localStorage.setItem(CLIENTS_KANBAN_STAGES_KEY, JSON.stringify(stages));
  }, [stages]);

  const fetchClients = useCallback(async () => {
    const { data } = await supabase
      .from("client_profiles")
      .select("id, name, company, role, stage, practice_area, client_health_score, stage_changed_at, avatar_url")
      .order("created_at", { ascending: false });
    if (data) setClients(data as ClientRow[]);
  }, []);

  useEffect(() => { fetchClients(); }, [refreshKey, fetchClients]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("clients_kanban_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "client_profiles" }, (payload) => {
        setClients((current) => {
          if (payload.eventType === "DELETE") return current.filter((c) => c.id !== (payload.old as any).id);
          const updated = payload.new as ClientRow;
          const exists = current.find((c) => c.id === updated.id);
          if (exists) return current.map((c) => c.id === updated.id ? updated : c);
          return [updated, ...current];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleDragStart = (e: DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: DragEvent, newStage: string) => {
    e.preventDefault();
    if (!draggedId) return;
    const client = clients.find((c) => c.id === draggedId);
    if (!client || client.stage === newStage) { setDraggedId(null); return; }

    const oldStage = client.stage;
    setClients((prev) => prev.map((c) => c.id === draggedId ? { ...c, stage: newStage, stage_changed_at: new Date().toISOString() } : c));
    setDraggedId(null);

    const { error } = await supabase.from("client_profiles").update({ stage: newStage } as any).eq("id", draggedId);
    if (error) {
      toast.error("Failed to update stage");
      setClients((prev) => prev.map((c) => c.id === draggedId ? { ...c, stage: oldStage } : c));
      return;
    }

    if (user) {
      const userName = await getUserName(user.id);
      const stageAge = client.stage_changed_at
        ? Math.floor((Date.now() - new Date(client.stage_changed_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      await logAudit({
        userId: user.id,
        userName,
        entityType: "client_profile",
        entityId: draggedId,
        clientProfileId: draggedId,
        action: "update",
        fieldName: "Stage",
        oldValue: oldStage,
        newValue: newStage,
        description: `Moved client "${client.name}" from ${oldStage} to ${newStage} (was in ${oldStage} for ${stageAge} day${stageAge !== 1 ? "s" : ""})`,
      });
    }
    toast.success(`Moved to ${newStage}`);
  };

  const filteredClients = clients.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.company || "").toLowerCase().includes(q) || (c.practice_area || "").toLowerCase().includes(q);
  });

  const getClientsByStage = (stage: string) => filteredClients.filter((c) => c.stage === stage);

  const handleAddStage = () => {
    const name = newStageName.trim();
    if (!name) { toast.error("Stage name is required"); return; }
    if (stages.includes(name)) { toast.error("Stage already exists"); return; }
    setStages([...stages, name]);
    setNewStageName("");
    setAddDialogOpen(false);
    toast.success(`Added "${name}" stage`);
  };

  const handleRemoveStage = (stage: string) => {
    const clientsInStage = getClientsByStage(stage);
    if (clientsInStage.length > 0) {
      toast.error(`Cannot remove "${stage}" — it has ${clientsInStage.length} client(s). Move them first.`);
      return;
    }
    setStages(stages.filter((s) => s !== stage));
    toast.success(`Removed "${stage}" stage`);
  };

  function getStageAgeDays(stageChangedAt: string | null): number {
    if (!stageChangedAt) return 0;
    return Math.floor((Date.now() - new Date(stageChangedAt).getTime()) / (1000 * 60 * 60 * 24));
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search clients..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-8 text-xs" />
        </div>
        <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />Add Stage
        </Button>
        {JSON.stringify(stages) !== JSON.stringify(DEFAULT_STAGES) && (
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setStages(DEFAULT_STAGES); toast.success("Reset to default stages"); }}>
            Reset
          </Button>
        )}
      </div>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Custom Stage</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <Input placeholder="Stage name, e.g. 'On Hold'" value={newStageName} onChange={(e) => setNewStageName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddStage()} />
            <Button onClick={handleAddStage} className="w-full">Add Stage</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-10rem)]">
        {stages.map((stage) => {
          const stageClients = getClientsByStage(stage);
          const isCustom = !DEFAULT_STAGES.includes(stage);
          return (
            <div
              key={stage}
              className={`flex-shrink-0 w-72 rounded-lg border p-3 ${STAGE_COLORS[stage] || "bg-muted/30 border-border"}`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage)}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm truncate">{stage}</h3>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs">{stageClients.length}</Badge>
                  {isCustom && (
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleRemoveStage(stage)} title="Remove stage">
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                {(expandedStages[stage] ? stageClients : stageClients.slice(0, 10)).map((client) => {
                  const ageDays = getStageAgeDays(client.stage_changed_at);
                  const ageColor = ageDays >= 30 ? "text-destructive" : ageDays >= 14 ? "text-amber-600" : "text-muted-foreground";
                  return (
                    <Card
                      key={client.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e as any, client.id)}
                      className={`transition-shadow cursor-pointer ${draggedId === client.id ? "opacity-50" : "hover:shadow-md"}`}
                      onClick={() => navigate(`/clients/${client.id}`)}
                    >
                      <CardContent className="p-3 space-y-1">
                        <div className="flex items-center gap-2">
                          <UserAvatar avatarUrl={client.avatar_url} fullName={client.name} size="sm" />
                          <p className="font-medium text-sm truncate flex-1">{client.name}</p>
                        </div>
                        {client.company && <p className="text-xs text-muted-foreground">{client.company}</p>}
                        {client.practice_area && <p className="text-xs text-muted-foreground">{client.practice_area}</p>}
                        {client.client_health_score !== null && (
                          <p className="text-xs text-muted-foreground">Health: {client.client_health_score}/10</p>
                        )}
                        {client.stage_changed_at && (
                          <p className={`text-[10px] font-medium mt-1 ${ageColor}`}>
                            In stage {ageDays}d
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
                {stageClients.length > 10 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-[10px] h-6"
                    onClick={() => setExpandedStages((prev) => ({ ...prev, [stage]: !prev[stage] }))}
                  >
                    {expandedStages[stage] ? "Show less" : `Show all ${stageClients.length} clients`}
                  </Button>
                )}
                {stageClients.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">Drop clients here</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
