import { useState, useEffect, DragEvent, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

import { UserCheck, Plus, X, Search, Pencil, Check, Trash2, FileText } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { executeWorkflows } from "@/lib/workflow-engine";
import { logAudit, getUserName } from "@/lib/audit-logger";
import { StageReasonDialog } from "@/components/StageReasonDialog";

const DEFAULT_STAGES = [
  "Prospecting Stage",
  "Discovery Stage",
  "Solution Mapping Stage",
  "Proposal/Contract Stage",
  "Onboarding/Kickoff Stage",
  "Hired Stage",
  "Lost Stage",
  "For Nurture",
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
  "For Nurture": "bg-indigo-500/10 border-indigo-500/30",
};

interface Lead {
  id: string;
  name: string;
  contact: string | null;
  source: string | null;
  next_steps: string | null;
  stage: string;
  stage_changed_at: string | null;
  needs: string | null;
  notes: string | null;
}

interface LeadsKanbanProps {
  onConvert?: (lead: Lead) => void;
  onEdit?: (lead: Lead) => void;
  onDelete?: (id: string) => void | Promise<void>;
  refreshKey?: number;
}

export default function LeadsKanban({ onConvert, onEdit, onDelete, refreshKey }: LeadsKanbanProps) {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [stages, setStages] = useState<string[]>(() => {
    const stored = localStorage.getItem(KANBAN_STAGES_KEY);
    if (!stored) return DEFAULT_STAGES;
    const parsed: string[] = JSON.parse(stored);
    // Merge in any new default stages missing from cached list
    const merged = [...parsed];
    for (const s of DEFAULT_STAGES) if (!merged.includes(s)) merged.push(s);
    return merged;
  });
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({});
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [renameDialog, setRenameDialog] = useState<{ open: boolean; oldName: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [reasonDialog, setReasonDialog] = useState<{ open: boolean; leadId: string; leadName: string; newStage: string; oldStage: string } | null>(null);
  const [quickEdit, setQuickEdit] = useState<{ leadId: string; needs: string; notes: string; saving: boolean } | null>(null);
  
  const { user } = useAuth();

  useEffect(() => {
    localStorage.setItem(KANBAN_STAGES_KEY, JSON.stringify(stages));
  }, [stages]);

  const saveQuickEdit = async () => {
    if (!quickEdit) return;
    const lead = leads.find((l) => l.id === quickEdit.leadId);
    if (!lead) return;
    setQuickEdit({ ...quickEdit, saving: true });
    const newNeeds = quickEdit.needs.trim() || null;
    const newNotes = quickEdit.notes.trim() || null;
    const { error } = await supabase
      .from("leads")
      .update({ needs: newNeeds, notes: newNotes })
      .eq("id", lead.id);
    if (error) {
      toast.error("Failed to save changes");
      setQuickEdit({ ...quickEdit, saving: false });
      return;
    }
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, needs: newNeeds, notes: newNotes } : l));
    if (user) {
      const userName = await getUserName(user.id);
      if ((lead.needs || null) !== newNeeds) {
        await logAudit({ userId: user.id, userName, entityType: "lead", entityId: lead.id, action: "update", fieldName: "Needs", oldValue: lead.needs, newValue: newNeeds, description: `Updated Needs for "${lead.name}"` });
      }
      if ((lead.notes || null) !== newNotes) {
        await logAudit({ userId: user.id, userName, entityType: "lead", entityId: lead.id, action: "update", fieldName: "Notes", oldValue: lead.notes, newValue: newNotes, description: `Updated Notes for "${lead.name}"` });
      }
    }
    toast.success("Saved");
    setQuickEdit(null);
  };


  const fetchLeads = useCallback(async () => {
    const { data } = await supabase
      .from("leads")
      .select("id, name, contact, source, next_steps, stage, stage_changed_at, needs, notes")
      .order("created_at", { ascending: false });
    if (data) setLeads(data as Lead[]);
  }, []);

  useEffect(() => { fetchLeads(); }, [refreshKey, fetchLeads]);

  // Realtime subscription for cross-user updates
  useEffect(() => {
    const channel = supabase
      .channel("leads_kanban_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        (payload) => {
          setLeads((current) => {
            if (payload.eventType === "DELETE") {
              return current.filter((l) => l.id !== (payload.old as Lead).id);
            }
            const updated = payload.new as Lead;
            const exists = current.find((l) => l.id === updated.id);
            if (exists) {
              return current.map((l) => l.id === updated.id ? updated : l);
            }
            return [updated, ...current];
          });
        }
      )
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

    const lead = leads.find((l) => l.id === draggedId);
    if (!lead || lead.stage === newStage) { setDraggedId(null); return; }

    // Intercept Lost Stage — require reason
    if (newStage === "Lost Stage") {
      setReasonDialog({ open: true, leadId: lead.id, leadName: lead.name, newStage, oldStage: lead.stage });
      setDraggedId(null);
      return;
    }

    await performStageDrop(lead, newStage);
  };

  const performStageDrop = async (lead: Lead, newStage: string, stageReason?: string) => {
    const oldStage = lead.stage;
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, stage: newStage, stage_changed_at: new Date().toISOString() } : l));

    const updatePayload: any = { stage: newStage };
    if (stageReason) updatePayload.stage_reason = stageReason;
    else updatePayload.stage_reason = null;

    const { error } = await supabase.from("leads").update(updatePayload).eq("id", lead.id);
    if (error) {
      toast.error("Failed to update stage");
      setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, stage: oldStage } : l));
      return;
    }

    if (user) {
      const userName = await getUserName(user.id);
      const stageAge = lead.stage_changed_at
        ? Math.floor((Date.now() - new Date(lead.stage_changed_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const reasonText = stageReason ? ` — Reason: ${stageReason}` : "";
      await logAudit({
        userId: user.id,
        userName,
        entityType: "lead",
        entityId: lead.id,
        action: "update",
        fieldName: "Stage",
        oldValue: oldStage,
        newValue: newStage,
        description: `Moved lead "${lead.name}" from ${oldStage} to ${newStage} (was in ${oldStage} for ${stageAge} day${stageAge !== 1 ? "s" : ""})${reasonText}`,
      });

      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "stage_change",
        title: `Lead moved to ${newStage}`,
        message: `${lead.name} moved from ${oldStage} to ${newStage}${reasonText}`,
        lead_id: lead.id,
      });

      // Execute workflow automations
      const results = await executeWorkflows(lead.id, lead.name, newStage, user.id);
      if (results && results.length > 0) {
        results.forEach((r) => toast.info(r));
      }
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

  const handleRenameStage = async () => {
    if (!renameDialog) return;
    const newName = renameValue.trim();
    if (!newName) { toast.error("Stage name is required"); return; }
    if (newName === renameDialog.oldName) { setRenameDialog(null); return; }
    if (stages.includes(newName)) { toast.error("Stage already exists"); return; }

    const oldName = renameDialog.oldName;
    setStages(stages.map((s) => s === oldName ? newName : s));
    const leadsInStage = leads.filter((l) => l.stage === oldName);
    if (leadsInStage.length > 0) {
      const { error } = await supabase.from("leads").update({ stage: newName }).eq("stage", oldName);
      if (error) {
        toast.error("Failed to rename stage in database");
        setStages(stages);
        return;
      }
      setLeads((prev) => prev.map((l) => l.stage === oldName ? { ...l, stage: newName } : l));
    }
    setRenameDialog(null);
    toast.success(`Renamed "${oldName}" to "${newName}"`);
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

      <Dialog open={!!renameDialog?.open} onOpenChange={(v) => { if (!v) setRenameDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Rename Stage</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleRenameStage()} />
            <Button onClick={handleRenameStage} className="w-full">Rename</Button>
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
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setRenameDialog({ open: true, oldName: stage }); setRenameValue(stage); }} title="Rename stage">
                    <Pencil className="h-3 w-3" />
                  </Button>
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
                      <div className="flex items-center justify-between gap-1">
                        <p
                          className="font-medium text-sm cursor-pointer hover:text-primary hover:underline flex-1"
                          onClick={async () => {
                            const { data: cp } = await supabase.from("client_profiles").select("id").eq("lead_id", lead.id).maybeSingle();
                            if (cp) {
                              navigate(`/clients/${cp.id}`);
                            } else {
                              toast.info("No client profile yet. Convert this lead first.");
                            }
                          }}
                        >
                          {lead.name}
                        </p>
                        {onEdit && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onEdit(lead); }}
                            className="text-muted-foreground hover:text-foreground p-0.5 shrink-0"
                            title="Edit lead"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <Popover
                          open={quickEdit?.leadId === lead.id}
                          onOpenChange={(o) => {
                            if (o) setQuickEdit({ leadId: lead.id, needs: lead.needs || "", notes: lead.notes || "", saving: false });
                            else setQuickEdit(null);
                          }}
                        >
                          <PopoverTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="text-muted-foreground hover:text-foreground p-0.5 shrink-0"
                              title="Edit Needs / Notes"
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 space-y-3" onClick={(e) => e.stopPropagation()}>
                            <div className="space-y-1">
                              <Label className="text-xs">Needs</Label>
                              <Textarea
                                rows={3}
                                maxLength={2000}
                                value={quickEdit?.needs || ""}
                                onChange={(e) => setQuickEdit((q) => q ? { ...q, needs: e.target.value } : q)}
                                placeholder="What does this lead need?"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Notes</Label>
                              <Textarea
                                rows={4}
                                maxLength={2000}
                                value={quickEdit?.notes || ""}
                                onChange={(e) => setQuickEdit((q) => q ? { ...q, notes: e.target.value } : q)}
                                placeholder="Internal notes"
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => setQuickEdit(null)} disabled={quickEdit?.saving}>
                                Cancel
                              </Button>
                              <Button size="sm" onClick={saveQuickEdit} disabled={quickEdit?.saving}>
                                {quickEdit?.saving ? "Saving..." : "Save"}
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(lead); }}
                          className="text-muted-foreground hover:text-destructive p-0.5 shrink-0"
                          title="Delete lead"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
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
      {reasonDialog && (
        <StageReasonDialog
          open={reasonDialog.open}
          onOpenChange={(v) => { if (!v) setReasonDialog(null); }}
          stageName="Lost"
          entityName={reasonDialog.leadName}
          onConfirm={(reason) => {
            const lead = leads.find((l) => l.id === reasonDialog.leadId);
            if (lead) performStageDrop(lead, reasonDialog.newStage, reason);
            setReasonDialog(null);
          }}
        />
      )}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteTarget) return;
                const target = deleteTarget;
                setDeleteTarget(null);
                if (onDelete) {
                  await onDelete(target.id);
                } else {
                  const { error } = await supabase.from("leads").delete().eq("id", target.id);
                  if (error) { toast.error(error.message); return; }
                  toast.success("Lead deleted");
                  setLeads((prev) => prev.filter((l) => l.id !== target.id));
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
