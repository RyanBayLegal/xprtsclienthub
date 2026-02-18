import { useState, useEffect, DragEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { formatDistanceToNow } from "date-fns";

const STAGES = [
  "Prospecting Stage",
  "Discovery Stage",
  "Solution Mapping Stage",
  "Proposal/Contract Stage",
  "Onboarding/Kickoff Stage",
];

const STAGE_COLORS: Record<string, string> = {
  "Prospecting Stage": "bg-blue-500/10 border-blue-500/30",
  "Discovery Stage": "bg-amber-500/10 border-amber-500/30",
  "Solution Mapping Stage": "bg-purple-500/10 border-purple-500/30",
  "Proposal/Contract Stage": "bg-emerald-500/10 border-emerald-500/30",
  "Onboarding/Kickoff Stage": "bg-rose-500/10 border-rose-500/30",
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

export default function LeadsKanban() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

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

  const getLeadsByStage = (stage: string) => leads.filter((l) => l.stage === stage);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-10rem)]">
      {STAGES.map((stage) => {
        const stageLeads = getLeadsByStage(stage);
        return (
          <div
            key={stage}
            className={`flex-shrink-0 w-72 rounded-lg border p-3 ${STAGE_COLORS[stage] || "bg-muted/30"}`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, stage)}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm truncate">{stage.replace(" Stage", "")}</h3>
              <Badge variant="secondary" className="text-xs">{stageLeads.length}</Badge>
            </div>
            <div className="space-y-2">
              {stageLeads.map((lead) => (
                <Card
                  key={lead.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead.id)}
                  onClick={() => navigate(`/clients/${lead.id}`)}
                  className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
                    draggedId === lead.id ? "opacity-50" : ""
                  }`}
                >
                  <CardContent className="p-3 space-y-1">
                    <p className="font-medium text-sm">{lead.name}</p>
                    {lead.contact && <p className="text-xs text-muted-foreground">{lead.contact}</p>}
                    {lead.source && <p className="text-xs text-muted-foreground">Source: {lead.source}</p>}
                    {lead.next_steps && (
                      <p className="text-xs text-muted-foreground truncate">Next: {lead.next_steps}</p>
                    )}
                    {lead.stage_changed_at && (
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        Moved {formatDistanceToNow(new Date(lead.stage_changed_at), { addSuffix: true })}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
              {stageLeads.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">Drop leads here</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
