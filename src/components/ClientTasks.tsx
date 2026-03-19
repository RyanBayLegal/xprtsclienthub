import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckCircle2, Circle, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import TaskComments from "@/components/TaskComments";
import { MessageSquare } from "lucide-react";

interface ClientTasksProps {
  clientProfileId: string;
  leadId?: string | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  stage: string | null;
  template_name: string | null;
  completed_at: string | null;
  created_at: string;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  stage: string;
  tasks: { title: string; assigned_to_name: string; priority: string }[];
}

const STATUS_OPTIONS = ["todo", "in_progress", "done"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];

const PIPELINE_STAGES = [
  "Prospecting Stage",
  "Discovery Stage",
  "Solution Mapping Stage",
  "Proposal/Contract Stage",
  "Onboarding/Kickoff Stage",
  "Hired Stage",
  "Lost Stage",
];


const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-500/15 text-blue-700",
  high: "bg-amber-500/15 text-amber-700",
  urgent: "bg-destructive/15 text-destructive",
};

function getDueDateStyle(dueDate: string | null, status: string): string {
  if (!dueDate || status === "done") return "text-muted-foreground";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  if (due < today) return "text-destructive font-medium";
  if (due.getTime() === today.getTime()) return "text-amber-600 font-medium";
  return "text-muted-foreground";
}

function getDueDateLabel(dueDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  if (due < today) return `Overdue: ${due.toLocaleDateString()}`;
  if (due.getTime() === today.getTime()) return "Due today";
  return `Due: ${due.toLocaleDateString()}`;
}

function sortByDueDate(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (!a.due_date && !b.due_date) return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    const diff = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    if (diff !== 0) return diff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export default function ClientTasks({ clientProfileId, leadId }: ClientTasksProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [staffMembers, setStaffMembers] = useState<{ id: string; full_name: string | null }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", priority: "medium", due_date: "", assigned_to: "", assigned_to_name: "", stage: "",
  });
  const [templateForm, setTemplateForm] = useState({
    name: "", stage: "Prospecting Stage",
    tasks: [{ title: "", assigned_to_name: "", priority: "medium" }],
  });



  const fetchTasks = useCallback(async () => {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("client_profile_id", clientProfileId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (data) setTasks(data as Task[]);
  }, [clientProfileId]);

  const fetchTemplates = async () => {
    const { data } = await supabase.from("workflow_templates").select("*");
    if (data) setTemplates(data.map((t) => ({ ...t, tasks: (t.tasks as any) || [] })) as WorkflowTemplate[]);
  };

  const fetchStaff = async () => {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["team_admin", "staff_member"]);
    if (!roles) return;
    const ids = roles.map((r) => r.user_id);
    if (ids.length === 0) return;
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", ids);
    if (profiles) setStaffMembers(profiles.map((p) => ({ id: p.user_id, full_name: p.full_name })));
  };

  useEffect(() => { fetchTasks(); fetchTemplates(); fetchStaff(); }, [clientProfileId, fetchTasks]);

  const createTask = async () => {
    const selectedStaff = staffMembers.find((s) => s.id === form.assigned_to);
    const { error } = await supabase.from("tasks").insert({
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      due_date: form.due_date || null,
      assigned_to: form.assigned_to || null,
      assigned_to_name: selectedStaff?.full_name || form.assigned_to_name || null,
      stage: form.stage || null,
      client_profile_id: clientProfileId,
      lead_id: leadId || null,
      created_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }

    if (user && form.assigned_to) {
      const { data: creatorProfile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
      const { data: clientProfile } = await supabase.from("client_profiles").select("name").eq("id", clientProfileId).maybeSingle();
      const creatorName = creatorProfile?.full_name || "Someone";
      const clientName = clientProfile?.name || "Unknown client";
      await supabase.from("notifications").insert({
        user_id: form.assigned_to,
        type: "task_assigned",
        title: "New task assigned to you",
        message: `"${form.title}" — Client: ${clientName}${form.due_date ? ` | Due: ${form.due_date}` : ""} | Created by: ${creatorName}`,
        lead_id: leadId || null,
      });
    }

    toast.success("Task created");
    setDialogOpen(false);
    setForm({ title: "", description: "", priority: "medium", due_date: "", assigned_to: "", assigned_to_name: "", stage: "" });
    fetchTasks();
  };

  const updateStatus = async (taskId: string, status: string) => {
    const updates: any = { status };
    if (status === "done") updates.completed_at = new Date().toISOString();
    else updates.completed_at = null;
    await supabase.from("tasks").update(updates).eq("id", taskId);
    fetchTasks();
  };

  const updateStage = async (taskId: string, newStage: string) => {
    const { error } = await supabase.from("tasks").update({ stage: newStage }).eq("id", taskId);
    if (error) {
      toast.error("Failed to update stage");
      return;
    }
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, stage: newStage } : t));
    toast.success(`Moved to ${newStage.replace(" Stage", "")}`);
  };

  const deleteTask = async (taskId: string) => {
    await supabase.from("tasks").delete().eq("id", taskId);
    fetchTasks();
  };

  const applyTemplate = async (template: WorkflowTemplate) => {
    const newTasks = template.tasks.map((t) => ({
      title: t.title,
      priority: t.priority || "medium",
      assigned_to_name: t.assigned_to_name || null,
      stage: template.stage,
      template_name: template.name,
      client_profile_id: clientProfileId,
      lead_id: leadId || null,
      created_by: user?.id,
    }));
    const { error } = await supabase.from("tasks").insert(newTasks);
    if (error) { toast.error(error.message); return; }
    toast.success(`Applied "${template.name}" template (${newTasks.length} tasks)`);
    fetchTasks();
  };

  const saveTemplate = async () => {
    const validTasks = templateForm.tasks.filter((t) => t.title.trim());
    if (!templateForm.name || validTasks.length === 0) { toast.error("Name and at least one task required"); return; }
    const { error } = await supabase.from("workflow_templates").insert({
      name: templateForm.name,
      stage: templateForm.stage,
      tasks: validTasks as any,
      created_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Template saved");
    setTemplateDialogOpen(false);
    setTemplateForm({ name: "", stage: "Prospecting Stage", tasks: [{ title: "", assigned_to_name: "", priority: "medium" }] });
    fetchTemplates();
  };

  const addTemplateTask = () => {
    setTemplateForm((f) => ({ ...f, tasks: [...f.tasks, { title: "", assigned_to_name: "", priority: "medium" }] }));
  };

  const updateTemplateTask = (idx: number, field: string, value: string) => {
    setTemplateForm((f) => ({
      ...f,
      tasks: f.tasks.map((t, i) => i === idx ? { ...t, [field]: value } : t),
    }));
  };


  const sortedTasks = sortByDueDate(tasks);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Tasks</h3>
        <div className="flex gap-2">
          {templates.length > 0 && (
            <Select onValueChange={(v) => {
              const tmpl = templates.find((t) => t.id === v);
              if (tmpl) applyTemplate(tmpl);
            }}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue placeholder="Apply template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name} ({t.stage.replace(" Stage", "")})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">Create Template</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>New Workflow Template</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Template Name</Label>
                    <Input value={templateForm.name} onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Pipeline Stage</Label>
                    <Select value={templateForm.stage} onValueChange={(v) => setTemplateForm((f) => ({ ...f, stage: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PIPELINE_STAGES.map((s) => (
                          <SelectItem key={s} value={s}>{s.replace(" Stage", "")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Label>Tasks</Label>
                {templateForm.tasks.map((t, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2">
                    <Input placeholder="Task title" value={t.title} onChange={(e) => updateTemplateTask(i, "title", e.target.value)} />
                    <Input placeholder="Assign to" value={t.assigned_to_name} onChange={(e) => updateTemplateTask(i, "assigned_to_name", e.target.value)} />
                    <Select value={t.priority} onValueChange={(v) => updateTemplateTask(i, "priority", v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addTemplateTask}><Plus className="mr-1 h-3 w-3" />Add Task</Button>
                <Button onClick={saveTemplate}>Save Template</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1 h-3 w-3" />Add Task</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Pipeline Stage</Label>
                  <Select value={form.stage} onValueChange={(v) => setForm((f) => ({ ...f, stage: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {PIPELINE_STAGES.map((s) => (
                        <SelectItem key={s} value={s}>{s.replace(" Stage", "")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Assign To</Label>
                  <Select value={form.assigned_to} onValueChange={(v) => {
                    const staff = staffMembers.find((s) => s.id === v);
                    setForm((f) => ({ ...f, assigned_to: v === "none" ? "" : v, assigned_to_name: staff?.full_name || "" }));
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {staffMembers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.full_name || s.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={createTask}>Create Task</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {tasks.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No tasks yet. Add a task or apply a workflow template.</p>
      ) : (
        <div className="space-y-2">
          {sortedTasks.map((task) => (
            <Card key={task.id}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => updateStatus(task.id, task.status === "done" ? "todo" : "done")}>
                    {task.status === "done" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : task.status === "in_progress" ? (
                      <Clock className="h-5 w-5 text-amber-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {task.assigned_to_name && <span className="text-[10px] text-muted-foreground">→ {task.assigned_to_name}</span>}
                      {task.due_date && (
                        <span className={`text-[10px] ${getDueDateStyle(task.due_date, task.status)}`}>
                          {getDueDateLabel(task.due_date)}
                        </span>
                      )}
                      {task.stage && <Badge variant="outline" className="text-[9px] h-4">{task.stage.replace(" Stage", "")}</Badge>}
                      {task.template_name && <Badge variant="outline" className="text-[9px] h-4">{task.template_name}</Badge>}
                    </div>
                  </div>
                  <Badge className={`text-[10px] ${priorityColors[task.priority]}`}>{task.priority}</Badge>
                  <Select value={task.status} onValueChange={(v) => updateStatus(task.id, v)}>
                    <SelectTrigger className="w-28 h-7 text-[10px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteTask(task.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] mt-1 text-muted-foreground">
                      <MessageSquare className="h-3 w-3 mr-1" />Comments
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <TaskComments taskId={task.id} />
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
