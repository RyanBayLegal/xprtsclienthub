import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { toast } from "sonner";
import { Plus, Trash2, Zap, ListTodo, Bell, UserCheck, History, CheckCircle2, XCircle } from "lucide-react";
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

export default function WorkflowAutomations() {
  const { user } = useAuth();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    trigger_stage: "Hired Stage",
    action_type: "create_task",
    action_config: {} as Record<string, any>,
  });

  const fetchAll = async () => {
    const [{ data: autos }, { data: profiles }] = await Promise.all([
      (supabase.from("workflow_automations" as any).select("*").order("created_at", { ascending: false }) as any),
      supabase.from("profiles").select("user_id, full_name"),
    ]);
    if (autos) setAutomations(autos as Automation[]);
    if (profiles) setStaff(profiles);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const { error } = await (supabase.from("workflow_automations" as any).insert({
      name: form.name,
      trigger_stage: form.trigger_stage,
      action_type: form.action_type,
      action_config: form.action_config,
      created_by: user?.id,
    }) as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Automation created");
    setDialogOpen(false);
    setForm({ name: "", trigger_stage: "Hired Stage", action_type: "create_task", action_config: {} });
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
        <Button size="sm" onClick={() => setDialogOpen(true)}>
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
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(auto.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Automation Rule</DialogTitle>
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

            <Button onClick={handleCreate} className="w-full">Create Automation</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
