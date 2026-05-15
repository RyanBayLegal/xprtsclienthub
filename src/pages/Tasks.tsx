import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MentionTextarea from "@/components/MentionTextarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, CheckCircle2, Circle, Clock, Pencil, Trash2, ChevronLeft, ChevronRight, Eye, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { UserAvatar } from "@/components/UserAvatar";
import TaskComments from "@/components/TaskComments";
import TaskAttachments from "@/components/TaskAttachments";
import TaskLinks from "@/components/TaskLinks";
import { extractMentionedUserIds } from "@/components/MentionTextarea";
import { logAudit, logFieldChanges, getUserName } from "@/lib/audit-logger";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";

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
  links: { title: string; url: string }[] | null;
  // enriched
  client_name?: string | null;
  staff_name?: string | null;
  staff_avatar?: string | null;
}

interface Client {
  id: string;
  name: string;
}

interface StaffMember {
  id: string;
  full_name: string | null;
  avatar_url?: string | null;
}

const STATUS_OPTIONS = ["todo", "in_progress", "done"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];

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

// Draggable task card
function DraggableTaskCard({
  task,
  onStatusChange,
  onEdit,
  onDelete,
  onView,
  navigate,
}: {
  task: Task;
  onStatusChange: (id: string, status: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onView: (task: Task) => void;
  navigate: (path: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, opacity: isDragging ? 0.4 : 1 }
    : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`hover:shadow-md transition-shadow ${isDragging ? "opacity-40" : ""}`}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-1">
          <span
            {...listeners}
            {...attributes}
            className="cursor-grab active:cursor-grabbing text-muted-foreground mt-0.5 shrink-0"
            title="Drag to move"
          >
            ⠿
          </span>
          <p className="font-medium text-sm flex-1">{task.title}</p>
          <div className="flex items-center gap-1 shrink-0">
            <Badge className={`text-[10px] ${priorityColors[task.priority]}`}>
              {task.priority}
            </Badge>
            <button
              onClick={() => onView(task)}
              className="text-muted-foreground hover:text-foreground p-0.5"
              title="View task"
            >
              <Eye className="h-3 w-3" />
            </button>
            <button
              onClick={() => onEdit(task)}
              className="text-muted-foreground hover:text-foreground p-0.5"
              title="Edit task"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={() => onDelete(task.id)}
              className="text-muted-foreground hover:text-destructive p-0.5"
              title="Delete task"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
        {/* description hidden from preview - shown in edit modal */}
        <div className="flex items-center gap-2 flex-wrap">
          {task.client_profile_id && task.client_name ? (
            <button
              onClick={() => navigate(`/clients/${task.client_profile_id}`)}
              className="text-[10px] text-primary underline underline-offset-2 hover:opacity-80"
            >
              📁 {task.client_name}
            </button>
          ) : (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5">Internal</Badge>
          )}
          {task.staff_name && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <UserAvatar avatarUrl={task.staff_avatar} fullName={task.staff_name} size="sm" />
              {task.staff_name}
            </span>
          )}
          {task.due_date && (
            <span className={`text-[10px] ${getDueDateStyle(task.due_date, task.status)}`}>
              {getDueDateLabel(task.due_date)}
            </span>
          )}
          {task.completed_at && (
            <span className="text-[10px] text-muted-foreground">
              ✓ {new Date(task.completed_at).toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {STATUS_OPTIONS.filter((s) => s !== task.status).map((s) => (
            <Button
              key={s}
              variant="ghost"
              size="sm"
              className="text-[10px] h-6 px-2"
              onClick={() => onStatusChange(task.id, s)}
            >
              {s === "done" ? "✓ Done" : s === "in_progress" ? "→ In Progress" : "← Todo"}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Droppable column
function DroppableColumn({
  id,
  label,
  icon: Icon,
  tasks,
  onStatusChange,
  onEdit,
  onDelete,
  onView,
  navigate,
  page,
  pageSize,
  onPageChange,
}: {
  id: string;
  label: string;
  icon: typeof Circle;
  tasks: Task[];
  onStatusChange: (id: string, status: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onView: (task: Task) => void;
  navigate: (path: string) => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });
  const totalPages = Math.ceil(tasks.length / pageSize);
  const paginatedTasks = tasks.slice(page * pageSize, (page + 1) * pageSize);

  const headerColor =
    id === "todo" ? "border-t-muted-foreground/40" :
    id === "in_progress" ? "border-t-primary" :
    "border-t-green-500";

  return (
    <div className="flex flex-col rounded-xl border bg-muted/30 overflow-hidden shadow-sm">
      <div className={`border-t-4 ${headerColor} bg-card px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">{label}</h3>
        </div>
        <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[400px] p-3 space-y-2 transition-colors ${isOver ? "bg-accent/30" : ""}`}
      >
        {paginatedTasks.length === 0 && (
          <p className="text-xs text-muted-foreground text-center pt-6 italic">Drop tasks here</p>
        )}
        {paginatedTasks.map((task) => (
          <DraggableTaskCard
            key={task.id}
            task={task}
            onStatusChange={onStatusChange}
            onEdit={onEdit}
            onDelete={onDelete}
            onView={onView}
            navigate={navigate}
          />
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t bg-card">
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-[10px] text-muted-foreground">{page + 1} / {totalPages}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

const emptyForm = {
  title: "", description: "", status: "todo", priority: "medium",
  due_date: "", client_profile_id: "", assigned_to: "", is_internal: false,
};

export default function Tasks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [assignedFilter, setAssignedFilter] = useState("all");
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [viewTask, setViewTask] = useState<Task | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [listPage, setListPage] = useState(0);
  const [boardPages, setBoardPages] = useState<Record<string, number>>({ todo: 0, in_progress: 0, done: 0 });
  const LIST_PAGE_SIZE = 15;
  const BOARD_PAGE_SIZE = 10;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const fetchTasks = async () => {
    let q = supabase.from("tasks").select("*").order("due_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    if (clientFilter !== "all") q = q.eq("client_profile_id", clientFilter);
    if (assignedFilter !== "all") q = q.eq("assigned_to", assignedFilter);
    const { data } = await q;
    if (!data) return;

    // Enrich with client names and staff names
    const clientIds = [...new Set(data.map((t) => t.client_profile_id).filter(Boolean))];
    const staffIds = [...new Set(data.map((t) => t.assigned_to).filter(Boolean))];

    const [clientRes, staffRes] = await Promise.all([
      clientIds.length > 0
        ? supabase.from("client_profiles").select("id, name").in("id", clientIds)
        : Promise.resolve({ data: [] }),
      staffIds.length > 0
        ? supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", staffIds)
        : Promise.resolve({ data: [] as { user_id: string; full_name: string | null; avatar_url: string | null }[] }),
    ]);

    const clientMap = Object.fromEntries((clientRes.data || []).map((c) => [c.id, c.name]));
    const staffMap = Object.fromEntries((staffRes.data || []).map((p) => [p.user_id, { name: p.full_name, avatar: p.avatar_url }]));

    setTasks(
      data.map((t) => ({
        ...t,
        links: (t.links as any) || [],
        client_name: t.client_profile_id ? clientMap[t.client_profile_id] ?? null : null,
        staff_name: t.assigned_to ? staffMap[t.assigned_to]?.name ?? null : null,
        staff_avatar: t.assigned_to ? staffMap[t.assigned_to]?.avatar ?? null : null,
      })) as Task[]
    );
  };

  const fetchClients = async () => {
    const { data } = await supabase.from("client_profiles").select("id, name").order("name");
    if (data) setClients(data);
  };

  const fetchStaff = async () => {
    // Fetch team_admin and staff_member roles
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["team_admin", "staff_member"]);
    if (!roles) return;
    const ids = roles.map((r) => r.user_id);
    if (ids.length === 0) return;
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .in("user_id", ids);
    if (profiles) {
      setStaffMembers(profiles.map((p) => ({ id: p.user_id, full_name: p.full_name, avatar_url: p.avatar_url })));
    }
  };

  useEffect(() => { fetchTasks(); fetchClients(); fetchStaff(); }, [statusFilter, clientFilter, assignedFilter]);

  useEffect(() => {
    const taskId = searchParams.get("task");
    if (!taskId || viewTask?.id === taskId) return;
    let cancelled = false;
    const openTargetTask = async () => {
      const target = tasks.find((task) => task.id === taskId);
      if (target) {
        if (cancelled) return;
        openView(target);
        return;
      }
      const { data } = await supabase.from("tasks").select("*").eq("id", taskId).maybeSingle();
      if (cancelled) return;
      if (!data) {
        toast.error("Task not found — it may have been deleted.");
        setSearchParams({}, { replace: true });
        return;
      }
      const [clientRes, staffRes] = await Promise.all([
        data.client_profile_id ? supabase.from("client_profiles").select("id, name").eq("id", data.client_profile_id).maybeSingle() : Promise.resolve({ data: null }),
        data.assigned_to ? supabase.from("profiles").select("user_id, full_name, avatar_url").eq("user_id", data.assigned_to).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      if (cancelled) return;
      openView({
        ...(data as any),
        links: (data.links as any) || [],
        client_name: clientRes.data?.name ?? null,
        staff_name: staffRes.data?.full_name ?? null,
        staff_avatar: staffRes.data?.avatar_url ?? null,
      } as Task);
    };
    openTargetTask();
    return () => { cancelled = true; };
  }, [searchParams, tasks, viewTask?.id]);

  const handleCreate = async () => {
    const selectedClient = clients.find((c) => c.id === form.client_profile_id);
    const selectedStaff = staffMembers.find((s) => s.id === form.assigned_to);
    const { data: inserted, error } = await supabase.from("tasks").insert({
      title: form.title,
      description: form.description || null,
      status: form.status,
      priority: form.priority,
      due_date: form.due_date || null,
      assigned_to_name: selectedClient?.name || null,
      client_profile_id: form.client_profile_id || null,
      assigned_to: form.assigned_to || null,
      created_by: user?.id,
    }).select("id").single();
    if (error) { toast.error(error.message); return; }

    if (user && inserted) {
      const userName = await getUserName(user.id);
      await logAudit({ userId: user.id, userName, entityType: "task", entityId: inserted.id, clientProfileId: form.client_profile_id || null, action: "create", description: `Created task: ${form.title}` });
      // Email notify admins via Gmail connector
      const creatorName = userName || "Someone";
      const assigneeName = staffMembers.find((s) => s.id === form.assigned_to)?.full_name || null;
      supabase.functions.invoke("send-task-notification", {
        body: {
          task_id: inserted.id,
          task_title: form.title,
          task_description: form.description || null,
          priority: form.priority,
          due_date: form.due_date || null,
          assignee_name: assigneeName,
          client_name: selectedClient?.name || null,
          created_by_name: creatorName,
        },
      }).catch((e) => console.error("Task email notify failed:", e));
    }

    // Notify the assigned staff member (not the creator)
    if (user && form.assigned_to) {
      const { data: creatorProfile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
      const creatorName = creatorProfile?.full_name || "Someone";
      const clientName = selectedClient?.name || "No client";
      await supabase.from("notifications").insert({
        user_id: form.assigned_to,
        type: "task_assigned",
        title: "New task assigned to you",
        message: `"${form.title}" — Client: ${clientName}${form.due_date ? ` | Due: ${form.due_date}` : ""} | Created by: ${creatorName}`,
        lead_id: inserted.id,
      });
    }

    // Send task assignment email
    if (selectedStaff && form.assigned_to) {
      const { data: staffAuth } = await supabase.from("profiles").select("full_name").eq("user_id", form.assigned_to).maybeSingle();
      supabase.functions.invoke("send-task-assignment", {
        body: {
          assignee_email: selectedStaff.full_name || form.assigned_to,
          assignee_name: staffAuth?.full_name || selectedStaff.full_name || "Staff",
          task_title: form.title,
          task_description: form.description,
          due_date: form.due_date,
        },
      });
    }

    // Notify @mentioned users in description
    if (user && form.description) {
      const mentionedIds = extractMentionedUserIds(form.description, staffMembers.map((s) => ({ id: s.id, full_name: s.full_name })));
      for (const uid of mentionedIds) {
        if (uid !== user.id && uid !== form.assigned_to) {
          await supabase.from("notifications").insert({
            user_id: uid,
            type: "task_mention",
            title: "You were mentioned in a task",
            message: `"${form.title}" — ${form.description.slice(0, 100)}`,
              lead_id: inserted.id,
          });
        }
      }
    }

    toast.success("Task created");
    setDialogOpen(false);
    setForm(emptyForm);
    fetchTasks();
  };

  const openView = (task: Task) => {
    setViewTask(task);
    setViewDialogOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setEditForm({
      title: task.title,
      description: task.description || "",
      status: task.status,
      priority: task.priority,
      due_date: task.due_date || "",
      client_profile_id: task.client_profile_id || "",
      assigned_to: task.assigned_to || "",
      is_internal: !task.client_profile_id,
    });
    setEditDialogOpen(true);
  };

  const handleEdit = async () => {
    if (!editingTask) return;
    const selectedClient = clients.find((c) => c.id === editForm.client_profile_id);
    const updates: any = {
      title: editForm.title,
      description: editForm.description || null,
      status: editForm.status,
      priority: editForm.priority,
      due_date: editForm.due_date || null,
      assigned_to_name: selectedClient?.name || null,
      client_profile_id: editForm.client_profile_id || null,
      assigned_to: editForm.assigned_to || null,
    };
    if (editForm.status === "done" && editingTask.status !== "done") {
      updates.completed_at = new Date().toISOString();
    } else if (editForm.status !== "done") {
      updates.completed_at = null;
    }
    const { error } = await supabase.from("tasks").update(updates).eq("id", editingTask.id);
    if (error) { toast.error(error.message); return; }

    // Audit log for task edit
    if (user) {
      const userName = await getUserName(user.id);
      await logFieldChanges(user.id, userName, "task", editingTask.id,
        { title: editingTask.title, description: editingTask.description, status: editingTask.status, priority: editingTask.priority, due_date: editingTask.due_date, assigned_to: editingTask.assigned_to, client_profile_id: editingTask.client_profile_id },
        { title: editForm.title, description: editForm.description, status: editForm.status, priority: editForm.priority, due_date: editForm.due_date, assigned_to: editForm.assigned_to, client_profile_id: editForm.client_profile_id },
        editForm.client_profile_id || editingTask.client_profile_id || null,
        { title: "Title", description: "Description", status: "Status", priority: "Priority", due_date: "Due Date", assigned_to: "Assigned To", client_profile_id: "Client" }
      );
    }

    // Notify newly assigned staff member + send email
    if (editForm.assigned_to && editForm.assigned_to !== editingTask.assigned_to) {
      const selectedStaff = staffMembers.find((s) => s.id === editForm.assigned_to);
      if (user) {
        const { data: creatorProfile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
        const creatorName = creatorProfile?.full_name || "Someone";
        const clientName = selectedClient?.name || "No client";
        await supabase.from("notifications").insert({
          user_id: editForm.assigned_to,
          type: "task_assigned",
          title: "Task reassigned to you",
          message: `"${editForm.title}" — Client: ${clientName}${editForm.due_date ? ` | Due: ${editForm.due_date}` : ""} | Assigned by: ${creatorName}`,
          lead_id: editingTask.id,
        });
      }
      if (selectedStaff) {
        supabase.functions.invoke("send-task-assignment", {
          body: {
            assignee_email: selectedStaff.full_name || editForm.assigned_to,
            assignee_name: selectedStaff.full_name || "Staff",
            task_title: editForm.title,
            task_description: editForm.description,
            due_date: editForm.due_date,
          },
        });
      }
    }

    // Notify @mentioned users in description
    if (user && editForm.description) {
      const mentionedIds = extractMentionedUserIds(editForm.description, staffMembers.map((s) => ({ id: s.id, full_name: s.full_name })));
      for (const uid of mentionedIds) {
        if (uid !== user.id && uid !== editForm.assigned_to) {
          await supabase.from("notifications").insert({
            user_id: uid,
            type: "task_mention",
            title: "You were mentioned in a task",
            message: `"${editForm.title}" — ${editForm.description.slice(0, 100)}`,
              lead_id: editingTask.id,
          });
        }
      }
    }

    toast.success("Task updated");
    setEditDialogOpen(false);
    setEditingTask(null);
    fetchTasks();
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    const updates: any = { status };
    if (status === "done") updates.completed_at = new Date().toISOString();
    else updates.completed_at = null;
    const { error } = await supabase.from("tasks").update(updates).eq("id", taskId);
    if (error) { toast.error(error.message); return; }
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status, completed_at: updates.completed_at } : t));
  };

  const deleteTask = async (taskId: string) => {
    await supabase.from("tasks").delete().eq("id", taskId);
    fetchTasks();
  };

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;
    const newStatus = over.id as string;
    const task = tasks.find((t) => t.id === active.id);
    if (!task || task.status === newStatus) return;
    updateTaskStatus(task.id, newStatus);
  };

  const sortByDue = (arr: Task[]) => [...arr].sort((a, b) => {
    if (!a.due_date && !b.due_date) return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    const diff = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    if (diff !== 0) return diff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const sortByCompleted = (arr: Task[]) => [...arr].sort((a, b) => {
    const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
    const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
    return bTime - aTime;
  });
  const todoTasks = sortByDue(tasks.filter((t) => t.status === "todo"));
  const inProgressTasks = sortByDue(tasks.filter((t) => t.status === "in_progress"));
  const doneTasks = sortByCompleted(tasks.filter((t) => t.status === "done"));

  const renderFormFields = (f: typeof emptyForm, setF: (fn: (prev: typeof emptyForm) => typeof emptyForm) => void) => (
    <>
      <div className="space-y-2">
        <Label>Title *</Label>
        <Input value={f.title} onChange={(e) => setF((p) => ({ ...p, title: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <MentionTextarea value={f.description} onChange={(v) => setF((p) => ({ ...p, description: v }))} placeholder="Add description… (type @ to mention)" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={f.priority} onValueChange={(v) => setF((p) => ({ ...p, priority: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={f.status} onValueChange={(v) => setF((p) => ({ ...p, status: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 col-span-2">
          <Label>Due Date</Label>
          <Input type="date" value={f.due_date} onChange={(e) => setF((p) => ({ ...p, due_date: e.target.value }))} />
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-md border p-3 bg-muted/30">
        <Checkbox
          id="is_internal"
          checked={f.is_internal}
          onCheckedChange={(v) => setF((p) => ({ ...p, is_internal: !!v, client_profile_id: v ? "" : p.client_profile_id }))}
        />
        <Label htmlFor="is_internal" className="cursor-pointer font-normal">
          Internal task <span className="text-xs text-muted-foreground">(no client)</span>
        </Label>
      </div>
      {!f.is_internal && (
        <div className="space-y-2">
          <Label>Assign to Client</Label>
          <Select value={f.client_profile_id} onValueChange={(v) => setF((p) => ({ ...p, client_profile_id: v === "none" ? "" : v }))}>
            <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-2">
        <Label>Assign to Staff Member</Label>
        <Select value={f.assigned_to} onValueChange={(v) => setF((p) => ({ ...p, assigned_to: v }))}>
          <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {staffMembers.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.full_name || s.id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />New Task</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Task</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              {renderFormFields(form, setForm)}
              <Button onClick={handleCreate}>Create Task</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Task Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Task</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            {renderFormFields(editForm, setEditForm)}
            <Button onClick={handleEdit}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-48 h-8 text-xs">
            <SelectValue placeholder="All clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
           {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={assignedFilter} onValueChange={setAssignedFilter}>
          <SelectTrigger className="w-48 h-8 text-xs">
            <SelectValue placeholder="All staff" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All staff</SelectItem>
            {staffMembers.map((s) => <SelectItem key={s.id} value={s.id}>{s.id === user?.id ? "Me" : (s.full_name || s.id)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {(clientFilter !== "all" || statusFilter !== "all" || assignedFilter !== "all") && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => { setClientFilter("all"); setStatusFilter("all"); setAssignedFilter("all"); }}>
            Clear filters
          </Button>
        )}
      </div>

      <Tabs defaultValue="board">
        <TabsList className="mb-4">
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
        </TabsList>

        <TabsContent value="board">
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3 items-start">
              <DroppableColumn id="todo" label="To Do" icon={Circle} tasks={todoTasks} onStatusChange={updateTaskStatus} onEdit={openEdit} onDelete={deleteTask} onView={openView} navigate={navigate} page={boardPages.todo} pageSize={BOARD_PAGE_SIZE} onPageChange={(p) => setBoardPages((prev) => ({ ...prev, todo: p }))} />
              <DroppableColumn id="in_progress" label="In Progress" icon={Clock} tasks={inProgressTasks} onStatusChange={updateTaskStatus} onEdit={openEdit} onDelete={deleteTask} onView={openView} navigate={navigate} page={boardPages.in_progress} pageSize={BOARD_PAGE_SIZE} onPageChange={(p) => setBoardPages((prev) => ({ ...prev, in_progress: p }))} />
              <DroppableColumn id="done" label="Done" icon={CheckCircle2} tasks={doneTasks} onStatusChange={updateTaskStatus} onEdit={openEdit} onDelete={deleteTask} onView={openView} navigate={navigate} page={boardPages.done} pageSize={BOARD_PAGE_SIZE} onPageChange={(p) => setBoardPages((prev) => ({ ...prev, done: p }))} />
            </div>

            <DragOverlay>
              {activeTask && (
                <Card className="shadow-xl rotate-1 w-64">
                  <CardContent className="p-3 space-y-1">
                    <p className="font-medium text-sm">{activeTask.title}</p>
                    <Badge className={`text-[10px] ${priorityColors[activeTask.priority]}`}>{activeTask.priority}</Badge>
                  </CardContent>
                </Card>
              )}
            </DragOverlay>
          </DndContext>
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
                    <TableHead>Client</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No tasks yet</TableCell></TableRow>
                  ) : tasks.slice(listPage * LIST_PAGE_SIZE, (listPage + 1) * LIST_PAGE_SIZE).map((task) => (
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
                      <TableCell className="text-sm">
                        {task.client_profile_id && task.client_name ? (
                          <button onClick={() => navigate(`/clients/${task.client_profile_id}`)} className="text-primary underline underline-offset-2 hover:opacity-80 text-sm">
                            {task.client_name}
                          </button>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">Internal</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {task.staff_name ? (
                          <div className="flex items-center gap-2">
                            <UserAvatar avatarUrl={task.staff_avatar} fullName={task.staff_name} size="sm" />
                            {task.staff_name}
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell className={`text-sm ${getDueDateStyle(task.due_date, task.status)}`}>
                        {task.due_date ? getDueDateLabel(task.due_date) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {task.completed_at ? new Date(task.completed_at).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openView(task)} title="View task">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(task)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteTask(task.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {tasks.length > LIST_PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                Showing {listPage * LIST_PAGE_SIZE + 1}–{Math.min((listPage + 1) * LIST_PAGE_SIZE, tasks.length)} of {tasks.length}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={listPage === 0} onClick={() => setListPage(listPage - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs px-2">{listPage + 1} / {Math.ceil(tasks.length / LIST_PAGE_SIZE)}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={(listPage + 1) * LIST_PAGE_SIZE >= tasks.length} onClick={() => setListPage(listPage + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* View Task Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={(o) => { setViewDialogOpen(o); if (!o) { setViewTask(null); if (searchParams.has("task")) setSearchParams({}, { replace: true }); } }}>
        <DialogContent className="max-h-[85vh] flex flex-col">
          <DialogHeader><DialogTitle>{viewTask?.title}</DialogTitle></DialogHeader>
          {viewTask && (
            <div className="space-y-4 py-2 overflow-y-auto flex-1 pr-2">
              {viewTask.description && (
                <Collapsible defaultOpen={viewTask.description.length < 200}>
                  <div className="space-y-1">
                    <CollapsibleTrigger className="flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground transition-colors">
                      <ChevronDown className="h-3 w-3 transition-transform [&[data-state=open]]:rotate-0 [[data-state=closed]_&]:rotate-[-90deg]" />
                      Description
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <p className="text-sm whitespace-pre-wrap">
                        {viewTask.description.split(/(@\w[\w\s]*?\b)/g).map((part, i) =>
                          part.startsWith("@") ? (
                            <span key={i} className="text-primary font-medium bg-primary/10 rounded px-0.5">{part}</span>
                          ) : (
                            <span key={i}>{part}</span>
                          )
                        )}
                      </p>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <p className="text-sm">{viewTask.status}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Priority</Label>
                  <Badge className={`text-[10px] ${priorityColors[viewTask.priority]}`}>{viewTask.priority}</Badge>
                </div>
                {viewTask.due_date && (
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Due Date</Label>
                    <p className={`text-sm ${getDueDateStyle(viewTask.due_date, viewTask.status)}`}>{getDueDateLabel(viewTask.due_date)}</p>
                  </div>
                )}
                {viewTask.client_name && (
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Client</Label>
                    <p className="text-sm">{viewTask.client_name}</p>
                  </div>
                )}
                {viewTask.staff_name && (
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Assigned To</Label>
                    <p className="text-sm">{viewTask.staff_name}</p>
                  </div>
                )}
                {viewTask.stage && (
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Stage</Label>
                    <p className="text-sm">{viewTask.stage.replace(" Stage", "")}</p>
                  </div>
                )}
              </div>
              <TaskAttachments taskId={viewTask.id} />
              <TaskLinks
                taskId={viewTask.id}
                links={(viewTask.links as { title: string; url: string }[]) || []}
                onUpdate={(newLinks) => {
                  setViewTask({ ...viewTask, links: newLinks });
                  setTasks((prev) => prev.map((t) => t.id === viewTask.id ? { ...t, links: newLinks } : t));
                }}
              />
              <TaskComments taskId={viewTask.id} />
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => { setViewDialogOpen(false); openEdit(viewTask); }}>
                  <Pencil className="mr-1 h-3 w-3" />Edit
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
