import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, CheckCircle2, Circle, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  client_profile_id: string | null;
  lead_id: string | null;
  stage: string | null;
  template_name: string | null;
  completed_at: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
}

const STATUS_OPTIONS = ["todo", "in_progress", "done"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];

const statusIcons: Record<string, typeof Circle> = {
  todo: Circle,
  in_progress: Clock,
  done: CheckCircle2,
};

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-500/15 text-blue-700",
  high: "bg-amber-500/15 text-amber-700",
  urgent: "bg-destructive/15 text-destructive",
};

export default function Tasks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({
    title: "", description: "", status: "todo", priority: "medium",
    due_date: "", assigned_to_name: "", client_profile_id: "", stage: "",
  });

  const fetchTasks = async () => {
    let q = supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    const { data } = await q;
    if (data) setTasks(data as Task[]);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from("profiles").select("id, user_id, full_name");
    if (data) setProfiles(data);
  };

  useEffect(() => { fetchTasks(); fetchProfiles(); }, [statusFilter]);

  const handleCreate = async () => {
    const { error } = await supabase.from("tasks").insert({
      title: form.title,
      description: form.description || null,
      status: form.status,
      priority: form.priority,
      due_date: form.due_date || null,
      assigned_to_name: form.assigned_to_name || null,
      client_profile_id: form.client_profile_id || null,
      stage: form.stage || null,
      created_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }

    // Create notification for task assignment
    if (user && form.assigned_to_name) {
      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "task_assigned",
        title: "Task assigned",
        message: `"${form.title}" assigned to ${form.assigned_to_name}${form.due_date ? ` (due ${form.due_date})` : ""}`,
      });
    }

    toast.success("Task created");
    setDialogOpen(false);
    setForm({ title: "", description: "", status: "todo", priority: "medium", due_date: "", assigned_to_name: "", client_profile_id: "", stage: "" });
    fetchTasks();
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    const updates: any = { status };
    if (status === "done") updates.completed_at = new Date().toISOString();
    else updates.completed_at = null;
    const { error } = await supabase.from("tasks").update(updates).eq("id", taskId);
    if (error) { toast.error(error.message); return; }
    fetchTasks();
  };

  const deleteTask = async (taskId: string) => {
    await supabase.from("tasks").delete().eq("id", taskId);
    fetchTasks();
  };

  const todoTasks = tasks.filter((t) => t.status === "todo");
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
  const doneTasks = tasks.filter((t) => t.status === "done");

  const renderTaskCard = (task: Task) => {
    const StatusIcon = statusIcons[task.status] || Circle;
    return (
      <Card key={task.id} className="hover:shadow-md transition-shadow">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between">
            <p className="font-medium text-sm flex-1">{task.title}</p>
            <Badge className={`text-[10px] ${priorityColors[task.priority]}`}>
              {task.priority}
            </Badge>
          </div>
          {task.description && <p className="text-xs text-muted-foreground">{task.description}</p>}
          <div className="flex items-center gap-2 flex-wrap">
            {task.assigned_to_name && (
              <Badge variant="outline" className="text-[10px]">{task.assigned_to_name}</Badge>
            )}
            {task.due_date && (
              <span className="text-[10px] text-muted-foreground">
                Due: {new Date(task.due_date + "T00:00:00").toLocaleDateString()}
              </span>
            )}
            {task.stage && (
              <Badge variant="secondary" className="text-[10px]">{task.stage}</Badge>
            )}
          </div>
          <div className="flex gap-1">
            {STATUS_OPTIONS.filter((s) => s !== task.status).map((s) => (
              <Button key={s} variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={() => updateTaskStatus(task.id, s)}>
                {s === "done" ? "✓ Done" : s === "in_progress" ? "→ In Progress" : "← Todo"}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />New Task</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Task</DialogTitle></DialogHeader>
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
                <Label>Assign To</Label>
                <Input placeholder="Staff member name" value={form.assigned_to_name} onChange={(e) => setForm((f) => ({ ...f, assigned_to_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Pipeline Stage (optional)</Label>
                <Select value={form.stage} onValueChange={(v) => setForm((f) => ({ ...f, stage: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Prospecting Stage">Prospecting</SelectItem>
                    <SelectItem value="Discovery Stage">Discovery</SelectItem>
                    <SelectItem value="Solution Mapping Stage">Solution Mapping</SelectItem>
                    <SelectItem value="Proposal/Contract Stage">Proposal/Contract</SelectItem>
                    <SelectItem value="Onboarding/Kickoff Stage">Onboarding/Kickoff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate}>Create Task</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="board">
        <TabsList className="mb-4">
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
        </TabsList>

        <TabsContent value="board">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Circle className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">To Do</h3>
                <Badge variant="secondary" className="text-xs">{todoTasks.length}</Badge>
              </div>
              <div className="space-y-2">{todoTasks.map(renderTaskCard)}</div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-amber-500" />
                <h3 className="font-semibold text-sm">In Progress</h3>
                <Badge variant="secondary" className="text-xs">{inProgressTasks.length}</Badge>
              </div>
              <div className="space-y-2">{inProgressTasks.map(renderTaskCard)}</div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <h3 className="font-semibold text-sm">Done</h3>
                <Badge variant="secondary" className="text-xs">{doneTasks.length}</Badge>
              </div>
              <div className="space-y-2">{doneTasks.map(renderTaskCard)}</div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="list">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No tasks yet</TableCell></TableRow>
                  ) : tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>
                        <Select value={task.status} onValueChange={(v) => updateTaskStatus(task.id, v)}>
                          <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${priorityColors[task.priority]}`}>{task.priority}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{task.assigned_to_name || "—"}</TableCell>
                      <TableCell className="text-sm">{task.due_date || "—"}</TableCell>
                      <TableCell className="text-sm">{task.stage?.replace(" Stage", "") || "—"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => deleteTask(task.id)}>Delete</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
