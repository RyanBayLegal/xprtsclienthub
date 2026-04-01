import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAudit, getUserName } from "@/lib/audit-logger";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Plus, Trash2, Zap, ListTodo, Bell, UserCheck, History, CheckCircle2, XCircle, Pencil } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const ALL_STAGES = [
  "Prospecting Stage",
  "Discovery Stage",
  "Solution Mapping Stage",
  "Proposal/Contract Stage",
  "Onboarding/Kickoff Stage",
  "Hired Stage",
  "Lost Stage",
];

const ACTION_TYPES = [
  { value: "create_task", label: "Create Task", icon: ListTodo },
  { value: "send_notification", label: "Send Notification", icon: Bell },
  { value: "convert_to_client", label: "Convert to Client", icon: UserCheck },
];

interface Automation {
  id: string;
  name: string;
  trigger_stage: string;
  action_type: string;
  action_config: Record<string, any>;
  is_active: boolean;
  created_at: string;
}

interface StaffMember {
  user_id: string;
  full_name: string | null;
}

interface TaskOption {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
}

interface AutomationLog {
  id: string;
  automation_name: string;
  trigger_stage: string;
  action_type: string;
  lead_name: string;
  result: string | null;
  status: string;
  executed_at: string;
}

const emptyForm = {
  name: "",
  trigger_stage: "Hired Stage",
  action_type: "create_task",
  action_config: {} as Record<string, any>,
};

export default function WorkflowAutomations() {
  const { user } = useAuth();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [existingTasks, setExistingTasks] = useState<TaskOption[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [taskMode, setTaskMode] = useState<"new" | "existing">("new");
  const [form, setForm] = useState({ ...emptyForm });

  const fetchAll = async () => {
    const [{ data: autos }, { data: profiles }, { data: logData }, { data: tasks }] = await Promise.all([
      (supabase.from("workflow_automations" as any).select("*").order("created_at", { ascending: false }) as any),
      supabase.from("profiles").select("user_id, full_name"),
      (supabase.from("workflow_automation_logs" as any).select("*").order("executed_at", { ascending: false }).limit(50) as any),
      supabase.from("tasks").select("id, title, description, priority, assigned_to, assigned_to_name").order("created_at", { ascending: false }).limit(100),
    ]);
    if (autos) setAutomations(autos as Automation[]);
    if (profiles) setStaff(profiles);
    if (logData) setLogs(logData as AutomationLog[]);
    if (tasks) setExistingTasks(tasks as TaskOption[]);
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setTaskMode("new");
    setDialogOpen(true);
  };

  const openEdit = (auto: Automation) => {
    setEditingId(auto.id);
    setForm({
      name: auto.name,
      trigger_stage: auto.trigger_stage,
      action_type: auto.action_type,
      action_config: { ...auto.action_config },
    });
    setTaskMode(auto.action_config.existing_task_id ? "existing" : "new");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }

    const userName = user ? await getUserName(user.id) : "Unknown";

    if (editingId) {
      const { error } = await (supabase.from("workflow_automations" as any).update({
        name: form.name,
        trigger_stage: form.trigger_stage,
        action_type: form.action_type,
        action_config: form.action_config,
      }).eq("id", editingId) as any);
      if (error) { toast.error(error.message); return; }
      if (user) await logAudit({ userId: user.id, userName, entityType: "workflow_automation", entityId: editingId, action: "update", description: `Updated automation: ${form.name}` });
      toast.success("Automation updated");
    } else {
      const { data: inserted, error } = await (supabase.from("workflow_automations" as any).insert({
        name: form.name,
        trigger_stage: form.trigger_stage,
        action_type: form.action_type,
        action_config: form.action_config,
        created_by: user?.id,
      }).select().single() as any);
      if (error) { toast.error(error.message); return; }
      if (user) await logAudit({ userId: user.id, userName, entityType: "workflow_automation", entityId: inserted?.id || "", action: "create", description: `Created automation: ${form.name}` });
      toast.success("Automation created");
    }

    setDialogOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    fetchAll();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await (supabase.from("workflow_automations" as any).update({ is_active: !current }).eq("id", id) as any);
    setAutomations((prev) => prev.map((a) => a.id === id ? { ...a, is_active: !current } : a));
  };

  const handleDelete = async (id: string) => {
    await (supabase.from("workflow_automations" as any).delete().eq("id", id) as any);
    setAutomations((prev) => prev.filter((a) => a.id !== id));
    toast.success("Automation deleted");
  };

  const updateConfig = (key: string, value: any) => {
    setForm((f) => ({ ...f, action_config: { ...f.action_config, [key]: value } }));
  };

  const selectExistingTask = (taskId: string) => {
    const task = existingTasks.find(t => t.id === taskId);
    if (!task) return;
    setForm(f => ({
      ...f,
      action_config: {
        ...f.action_config,
        existing_task_id: taskId,
        title: task.title,
        description: task.description || "",
        priority: task.priority,
        assigned_to: task.assigned_to,
        assigned_to_name: task.assigned_to_name,
      },
    }));
  };

  const actionIcon = (type: string) => {
    const found = ACTION_TYPES.find((a) => a.value === type);
    return found ? <found.icon className="h-4 w-4" /> : null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Pipeline Automations
          </h3>
          <p className="text-sm text-muted-foreground">
            Trigger actions automatically when leads move to a stage. Use <code className="text-xs bg-muted px-1 rounded">{"{{lead_name}}"}</code> as a placeholder.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />Add Rule
        </Button>
      </div>

      {automations.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No automations yet. Create one to get started.</p>
      )}

      <div className="space-y-2">
        {automations.map((auto) => (
          <Card key={auto.id} className={auto.is_active ? "" : "opacity-60"}>
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {actionIcon(auto.action_type)}
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{auto.name}</p>
                  <p className="text-xs text-muted-foreground">
                    When lead enters <Badge variant="outline" className="mx-1 text-[10px]">{auto.trigger_stage.replace(" Stage", "")}</Badge>
                    → {ACTION_TYPES.find((a) => a.value === auto.action_type)?.label}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Switch checked={auto.is_active} onCheckedChange={() => toggleActive(auto.id, auto.is_active)} />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(auto)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(auto.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); setForm({ ...emptyForm }); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Automation Rule" : "New Automation Rule"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Rule Name</Label>
              <Input placeholder='e.g. "Auto-create onboarding task"' value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Trigger Stage</Label>
              <Select value={form.trigger_stage} onValueChange={(v) => setForm((f) => ({ ...f, trigger_stage: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Fires when a lead is moved into this stage.</p>
            </div>
            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={form.action_type} onValueChange={(v) => setForm((f) => ({ ...f, action_type: v, action_config: {} }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {form.action_type === "create_task" && (
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase">Task Config</p>
                
                <RadioGroup value={taskMode} onValueChange={(v) => {
                  setTaskMode(v as "new" | "existing");
                  if (v === "new") {
                    const { existing_task_id, ...rest } = form.action_config;
                    setForm(f => ({ ...f, action_config: rest }));
                  }
                }} className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="new" id="task-new" />
                    <Label htmlFor="task-new" className="text-sm">Create new task</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="existing" id="task-existing" />
                    <Label htmlFor="task-existing" className="text-sm">Use existing task</Label>
                  </div>
                </RadioGroup>

                {taskMode === "existing" && (
                  <div className="space-y-2">
                    <Label>Select Task Template</Label>
                    <Select value={form.action_config.existing_task_id || ""} onValueChange={selectExistingTask}>
                      <SelectTrigger><SelectValue placeholder="Choose a task..." /></SelectTrigger>
                      <SelectContent>
                        {existingTasks.map(t => (
                          <SelectItem key={t.id} value={t.id}>
                            <span className="truncate">{t.title}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Task Title</Label>
                  <Input placeholder='e.g. "Onboard {{lead_name}}"' value={form.action_config.title || ""} onChange={(e) => updateConfig("title", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea rows={2} value={form.action_config.description || ""} onChange={(e) => updateConfig("description", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={form.action_config.priority || "medium"} onValueChange={(v) => updateConfig("priority", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Due In (days)</Label>
                    <Input type="number" min={0} value={form.action_config.due_in_days || ""} onChange={(e) => updateConfig("due_in_days", parseInt(e.target.value) || null)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Assign To</Label>
                  <Select value={form.action_config.assigned_to || "unassigned"} onValueChange={(v) => {
                    if (v === "unassigned") {
                      updateConfig("assigned_to", null);
                      updateConfig("assigned_to_name", null);
                    } else {
                      const s = staff.find((s) => s.user_id === v);
                      updateConfig("assigned_to", v);
                      updateConfig("assigned_to_name", s?.full_name || null);
                    }
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {staff.map((s) => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name || s.user_id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {form.action_type === "send_notification" && (
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase">Notification Config</p>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input placeholder='e.g. "{{lead_name}} hired!"' value={form.action_config.title || ""} onChange={(e) => updateConfig("title", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea rows={2} value={form.action_config.message || ""} onChange={(e) => updateConfig("message", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Send To</Label>
                  <Select value={form.action_config.notify_all_admins ? "all_admins" : (form.action_config.user_id || "all_admins")} onValueChange={(v) => {
                    if (v === "all_admins") {
                      updateConfig("notify_all_admins", true);
                      updateConfig("user_id", null);
                    } else {
                      updateConfig("notify_all_admins", false);
                      updateConfig("user_id", v);
                    }
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_admins">All Admins</SelectItem>
                      {staff.map((s) => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name || s.user_id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {form.action_type === "convert_to_client" && (
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase">Conversion Config</p>
                <div className="space-y-2">
                  <Label>Default Client Stage</Label>
                  <Input placeholder="e.g. Prospect" value={form.action_config.default_stage || ""} onChange={(e) => updateConfig("default_stage", e.target.value)} />
                </div>
              </div>
            )}

            <Button onClick={handleSave} className="w-full">
              {editingId ? "Update Automation" : "Create Automation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Execution History */}
      <div className="pt-4 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sm text-muted-foreground"
          onClick={() => setShowLogs(!showLogs)}
        >
          <History className="h-4 w-4 mr-2" />
          Execution History ({logs.length})
        </Button>
        {showLogs && (
          <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No executions yet.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-md border bg-card text-sm">
                  {log.status === "success" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{log.automation_name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {ACTION_TYPES.find((a) => a.value === log.action_type)?.label || log.action_type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Lead: <span className="font-medium">{log.lead_name}</span> → {log.trigger_stage.replace(" Stage", "")}
                    </p>
                    {log.result && (
                      <p className="text-xs text-muted-foreground mt-0.5">{log.result}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(log.executed_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
