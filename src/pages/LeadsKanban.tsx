import { useState, useEffect, DragEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { formatDistanceToNow } from "date-fns";
import { UserCheck, Plus, X, Search } from "lucide-react";

const DEFAULT_STAGES = [
  "Prospecting Stage",
  "Discovery Stage",
  "Solution Mapping Stage",
  "Proposal/Contract Stage",
  "Onboarding/Kickoff Stage",
  "Hired Stage",
  "Lost Stage",
];

const KANBAN_STAGES_KEY = "kanban_custom_stages";

const STAGE_COLORS: Record<string, string> = {
  "Prospecting Stage": "bg-blue-500/10 border-blue-500/30",
  "Discovery Stage": "bg-amber-500/10 border-amber-500/30",
  "Solution Mapping Stage": "bg-purple-500/10 border-purple-500/30",
  "Proposal/Contract Stage": "bg-emerald-500/10 border-emerald-500/30",
  "Onboarding/Kickoff Stage": "bg-rose-500/10 border-rose-500/30",
  "Hired Stage": "bg-teal-500/10 border-teal-500/30",
  "Lost Stage": "bg-gray-500/10 border-gray-500/30",
};

interface Lead {
  id: string;
  name: string;
  contact: string | null;
  source: string | null;
  next_steps: string | null;
  stage: string;
  stage_changed_at: string | null;
}

interface LeadsKanbanProps {
  onConvert?: (lead: Lead) => void;
}

export default function LeadsKanban({ onConvert }: LeadsKanbanProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [stages, setStages] = useState<string[]>(() => {
    const stored = localStorage.getItem(KANBAN_STAGES_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_STAGES;
  });
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({});
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    localStorage.setItem(KANBAN_STAGES_KEY, JSON.stringify(stages));
  }, [stages]);

  const fetchLeads = async () => {
    const { data } = await supabase
      .from("leads")
      .select("id, name, contact, source, next_steps, stage, stage_changed_at")
      .order("created_at", { ascending: false });
    if (data) setLeads(data as Lead[]);
  };

  useEffect(() => { fetchLeads(); }, []);

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

    const lead = leads.find((l) => l.id === draggedId);
    if (!lead || lead.stage === newStage) { setDraggedId(null); return; }

    const oldStage = lead.stage;
    setLeads((prev) => prev.map((l) => l.id === draggedId ? { ...l, stage: newStage, stage_changed_at: new Date().toISOString() } : l));
    setDraggedId(null);

    const { error } = await supabase.from("leads").update({ stage: newStage }).eq("id", draggedId);
    if (error) {
      toast.error("Failed to update stage");
      setLeads((prev) => prev.map((l) => l.id === draggedId ? { ...l, stage: oldStage } : l));
      return;
    }

    if (user) {
      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "stage_change",
        title: `Lead moved to ${newStage}`,
        message: `${lead.name} moved from ${oldStage} to ${newStage}`,
        lead_id: lead.id,
      });
    }
    toast.success(`Moved to ${newStage}`);
  };

  const filteredLeads = leads.filter((l) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return l.name.toLowerCase().includes(q) || (l.contact || "").toLowerCase().includes(q) || (l.source || "").toLowerCase().includes(q);
  });

  const getLeadsByStage = (stage: string) => filteredLeads.filter((l) => l.stage === stage);

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
    const leadsInStage = getLeadsByStage(stage);
    if (leadsInStage.length > 0) {
      toast.error(`Cannot remove "${stage}" — it has ${leadsInStage.length} lead(s). Move them first.`);
      return;
    }
    setStages(stages.filter((s) => s !== stage));
    toast.success(`Removed "${stage}" stage`);
  };

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
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
            <Input placeholder="Stage name, e.g. 'Negotiation Stage'" value={newStageName} onChange={(e) => setNewStageName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddStage()} />
            <Button onClick={handleAddStage} className="w-full">Add Stage</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-10rem)]">
        {stages.map((stage) => {
          const stageLeads = getLeadsByStage(stage);
          const isCustom = !DEFAULT_STAGES.includes(stage);
          return (
            <div
              key={stage}
              className={`flex-shrink-0 w-72 rounded-lg border p-3 ${STAGE_COLORS[stage] || "bg-muted/30 border-border"}`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage)}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm truncate">{stage.replace(" Stage", "")}</h3>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs">{stageLeads.length}</Badge>
                  {isCustom && (
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleRemoveStage(stage)} title="Remove stage">
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                {(expandedStages[stage] ? stageLeads : stageLeads.slice(0, 10)).map((lead) => (
                  <Card
                    key={lead.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead.id)}
                    className={`transition-shadow ${draggedId === lead.id ? "opacity-50" : "hover:shadow-md"}`}
                  >
                    <CardContent className="p-3 space-y-1">
                      <p
                        className="font-medium text-sm cursor-pointer hover:text-primary"
                        onClick={() => navigate(`/clients/${lead.id}`)}
                      >
                        {lead.name}
                      </p>
                      {lead.contact && <p className="text-xs text-muted-foreground">{lead.contact}</p>}
                      {lead.source && <p className="text-xs text-muted-foreground">Source: {lead.source}</p>}
                      {lead.next_steps && (
                        <p className="text-xs text-muted-foreground truncate">Next: {lead.next_steps}</p>
                      )}
                      {lead.stage_changed_at && (() => {
                        const days = Math.floor((Date.now() - new Date(lead.stage_changed_at).getTime()) / (1000 * 60 * 60 * 24));
                        const color = days < 7 ? "text-green-600" : days < 14 ? "text-amber-600" : "text-destructive";
                        return (
                          <p className={`text-[10px] font-medium mt-1 ${color}`}>
                            In stage {days}d
                          </p>
                        );
                      })()}
                      {onConvert && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] text-primary w-full mt-1"
                          onClick={(e) => { e.stopPropagation(); onConvert(lead); }}
                        >
                          <UserCheck className="h-3 w-3 mr-1" />
                          Convert to Client
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {stageLeads.length > 10 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-[10px] h-6"
                    onClick={() => setExpandedStages((prev) => ({ ...prev, [stage]: !prev[stage] }))}
                  >
                    {expandedStages[stage] ? `Show less` : `Show all ${stageLeads.length} leads`}
                  </Button>
                )}
                {stageLeads.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">Drop leads here</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
