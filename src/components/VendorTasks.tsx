import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, CheckCircle2, Circle, Clock } from "lucide-react";
import { toast } from "sonner";

interface VendorTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to_name: string | null;
}

const STATUS = ["todo", "in_progress", "done"];
const PRIORITY = ["low", "medium", "high", "urgent"];

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-500/15 text-blue-700",
  high: "bg-amber-500/15 text-amber-700",
  urgent: "bg-destructive/15 text-destructive",
};

const emptyForm = { title: "", description: "", status: "todo", priority: "medium", due_date: "", assigned_to_name: "" };

export default function VendorTasks({ vendorId }: { vendorId: string }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<VendorTask[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetch = async () => {
    const client = supabase as any;
    const { data } = await client
      .from("tasks")
      .select("id, title, description, status, priority, due_date, assigned_to_name")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false });
    if (data) setTasks(data as any);
  };

  useEffect(() => { fetch(); }, [vendorId]);

  const save = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    const payload: any = {
      title: form.title,
      description: form.description || null,
      status: form.status,
      priority: form.priority,
      due_date: form.due_date || null,
      assigned_to_name: form.assigned_to_name || null,
      vendor_id: vendorId,
      created_by: user?.id,
      completed_at: form.status === "done" ? new Date().toISOString() : null,
    };
    if (editingId) {
      const { error } = await supabase.from("tasks").update(payload).eq("id", editingId);
      if (error) { toast.error(error.message); return; }
      toast.success("Task updated");
    } else {
      const { error } = await supabase.from("tasks").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Task added");
    }
    setOpen(false); setForm(emptyForm); setEditingId(null); fetch();
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("tasks").update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    fetch();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    fetch();
  };

  const edit = (t: VendorTask) => {
    setForm({
      title: t.title,
      description: t.description || "",
      status: t.status,
      priority: t.priority,
      due_date: t.due_date || "",
      assigned_to_name: t.assigned_to_name || "",
    });
    setEditingId(t.id);
    setOpen(true);
  };

  const StatusIcon = ({ status }: { status: string }) =>
    status === "done" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
    status === "in_progress" ? <Clock className="h-4 w-4 text-primary" /> :
    <Circle className="h-4 w-4 text-muted-foreground" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{tasks.length} task{tasks.length === 1 ? "" : "s"}</p>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setForm(emptyForm); setEditingId(null); } }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Task</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Edit Task" : "New Task"}</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-1.5">
                <Label>Title *</Label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PRIORITY.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Due Date</Label>
                  <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Assignee</Label>
                  <Input value={form.assigned_to_name} onChange={(e) => setForm((f) => ({ ...f, assigned_to_name: e.target.value }))} placeholder="Name" />
                </div>
              </div>
              <Button onClick={save}>{editingId ? "Update" : "Add"} Task</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8 border rounded-md bg-muted/20">No tasks yet</p>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {tasks.map((t) => (
            <div key={t.id} className="border rounded-md p-3 bg-card flex items-start gap-3">
              <button onClick={() => setStatus(t.id, t.status === "done" ? "todo" : "done")} className="mt-0.5" title="Toggle done">
                <StatusIcon status={t.status} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`font-medium text-sm ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                  <Badge className={`text-[10px] ${priorityColors[t.priority]}`}>{t.priority}</Badge>
                  {t.due_date && <span className="text-xs text-muted-foreground">📅 {t.due_date}</span>}
                  {t.assigned_to_name && <span className="text-xs text-muted-foreground">👤 {t.assigned_to_name}</span>}
                </div>
                {t.description && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{t.description}</p>}
                <div className="flex gap-1 mt-2">
                  {STATUS.filter((s) => s !== t.status).map((s) => (
                    <Button key={s} variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => setStatus(t.id, s)}>
                      → {s.replace("_", " ")}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => edit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(t.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}