import { useEffect, useState, DragEvent, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, X, Search, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ClientKanbanBoardProps {
  clientProfileId: string;
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

const DEFAULT_STAGES = [
  "Prospecting Stage",
  "Discovery Stage",
  "Solution Mapping Stage",
  "Proposal/Contract Stage",
  "Onboarding/Kickoff Stage",
  "Hired Stage",
  "Lost Stage",
];

const CLIENT_KANBAN_STAGES_KEY = "client_kanban_custom_stages";

const STAGE_COLORS: Record<string, string> = {
  "Prospecting Stage": "bg-blue-500/10 border-blue-500/30",
  "Discovery Stage": "bg-amber-500/10 border-amber-500/30",
  "Solution Mapping Stage": "bg-purple-500/10 border-purple-500/30",
  "Proposal/Contract Stage": "bg-emerald-500/10 border-emerald-500/30",
  "Onboarding/Kickoff Stage": "bg-rose-500/10 border-rose-500/30",
  "Hired Stage": "bg-teal-500/10 border-teal-500/30",
  "Lost Stage": "bg-gray-500/10 border-gray-500/30",
};

const STATUS_OPTIONS = ["todo", "in_progress", "done"];

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

const BOARD_PAGE_SIZE = 10;

export default function ClientKanbanBoard({ clientProfileId }: ClientKanbanBoardProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stages, setStages] = useState<string[]>(() => {
    const stored = localStorage.getItem(CLIENT_KANBAN_STAGES_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_STAGES;
  });
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [addStageDialogOpen, setAddStageDialogOpen] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [boardPages, setBoardPages] = useState<Record<string, number>>({});

  useEffect(() => {
    localStorage.setItem(CLIENT_KANBAN_STAGES_KEY, JSON.stringify(stages));
  }, [stages]);

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("client_profile_id", clientProfileId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (data) setTasks(data as Task[]);
  }, [clientProfileId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const updateStage = async (taskId: string, newStage: string) => {
    const { error } = await supabase.from("tasks").update({ stage: newStage }).eq("id", taskId);
    if (error) { toast.error("Failed to update stage"); return; }
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, stage: newStage } : t));
    toast.success(`Moved to ${newStage.replace(" Stage", "")}`);
  };

  const updateStatus = async (taskId: string, status: string) => {
    const updates: any = { status };
    if (status === "done") updates.completed_at = new Date().toISOString();
    else updates.completed_at = null;
    await supabase.from("tasks").update(updates).eq("id", taskId);
    fetchTasks();
  };

  const deleteTask = async (taskId: string) => {
    await supabase.from("tasks").delete().eq("id", taskId);
    fetchTasks();
  };

  const handleDragStart = (e: DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: DragEvent, newStage: string) => {
    e.preventDefault();
    if (!draggedId) return;
    const task = tasks.find((t) => t.id === draggedId);
    if (!task || task.stage === newStage) { setDraggedId(null); return; }
    updateStage(draggedId, newStage);
    setDraggedId(null);
  };

  const handleAddStage = () => {
    const name = newStageName.trim();
    if (!name) { toast.error("Stage name is required"); return; }
    if (stages.includes(name)) { toast.error("Stage already exists"); return; }
    setStages([...stages, name]);
    setNewStageName("");
    setAddStageDialogOpen(false);
    toast.success(`Added "${name}" stage`);
  };

  const handleRemoveStage = (stage: string) => {
    const tasksInStage = tasks.filter((t) => t.stage === stage);
    if (tasksInStage.length > 0) {
      toast.error(`Cannot remove "${stage}" — it has ${tasksInStage.length} task(s). Move them first.`);
      return;
    }
    setStages(stages.filter((s) => s !== stage));
    toast.success(`Removed "${stage}" stage`);
  };

  const filteredTasks = tasks.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return t.title.toLowerCase().includes(q) || (t.assigned_to_name || "").toLowerCase().includes(q);
  });

  const getTasksByStage = (stage: string) => sortByDueDate(filteredTasks.filter((t) => t.stage === stage));
  const unstaged = sortByDueDate(filteredTasks.filter((t) => !t.stage || !stages.includes(t.stage)));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setAddStageDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />Add Stage
        </Button>
        {JSON.stringify(stages) !== JSON.stringify(DEFAULT_STAGES) && (
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setStages(DEFAULT_STAGES); toast.success("Reset to default stages"); }}>
            Reset
          </Button>
        )}
      </div>

      <Dialog open={addStageDialogOpen} onOpenChange={setAddStageDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Custom Stage</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <Input placeholder="Stage name, e.g. 'Negotiation Stage'" value={newStageName} onChange={(e) => setNewStageName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddStage()} />
            <Button onClick={handleAddStage} className="w-full">Add Stage</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-14rem)]">
        {unstaged.length > 0 && (
          <div className="flex-shrink-0 w-72 rounded-lg border p-3 bg-muted/30 border-border" onDragOver={handleDragOver}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm truncate">Unstaged</h3>
              <Badge variant="secondary" className="text-xs">{unstaged.length}</Badge>
            </div>
            <div className="space-y-2">
              {unstaged.slice(0, 10).map((task) => (
                <TaskKanbanCard key={task.id} task={task} draggedId={draggedId} onDragStart={handleDragStart} onStatusChange={updateStatus} onDelete={deleteTask} />
              ))}
            </div>
          </div>
        )}
        {stages.map((stage) => {
          const stageTasks = getTasksByStage(stage);
          const isCustom = !DEFAULT_STAGES.includes(stage);
          const page = boardPages[stage] || 0;
          const totalPages = Math.ceil(stageTasks.length / BOARD_PAGE_SIZE);
          const paginatedTasks = stageTasks.slice(page * BOARD_PAGE_SIZE, (page + 1) * BOARD_PAGE_SIZE);
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
                  <Badge variant="secondary" className="text-xs">{stageTasks.length}</Badge>
                  {isCustom && (
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleRemoveStage(stage)} title="Remove stage">
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                {paginatedTasks.map((task) => (
                  <TaskKanbanCard key={task.id} task={task} draggedId={draggedId} onDragStart={handleDragStart} onStatusChange={updateStatus} onDelete={deleteTask} />
                ))}
                {stageTasks.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">Drop tasks here</p>
                )}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t">
                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={page === 0} onClick={() => setBoardPages((prev) => ({ ...prev, [stage]: page - 1 }))}>
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <span className="text-[10px] text-muted-foreground">{page + 1} / {totalPages}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={page >= totalPages - 1} onClick={() => setBoardPages((prev) => ({ ...prev, [stage]: page + 1 }))}>
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskKanbanCard({
  task,
  draggedId,
  onDragStart,
  onStatusChange,
  onDelete,
}: {
  task: Task;
  draggedId: string | null;
  onDragStart: (e: DragEvent<HTMLDivElement>, id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e as any, task.id)}
      className={`transition-shadow ${draggedId === task.id ? "opacity-50" : "hover:shadow-md"}`}
    >
      <CardContent className="p-3 space-y-1">
        <div className="flex items-start justify-between gap-1">
          <p className="font-medium text-sm flex-1">{task.title}</p>
          <div className="flex items-center gap-1 shrink-0">
            <Badge className={`text-[10px] ${priorityColors[task.priority]}`}>{task.priority}</Badge>
            <button onClick={() => onDelete(task.id)} className="text-muted-foreground hover:text-destructive p-0.5" title="Delete">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
        {task.description && <p className="text-xs text-muted-foreground truncate">{task.description}</p>}
        {task.assigned_to_name && <p className="text-xs text-muted-foreground">→ {task.assigned_to_name}</p>}
        {task.due_date && (
          <p className={`text-[10px] ${getDueDateStyle(task.due_date, task.status)}`}>
            {getDueDateLabel(task.due_date)}
          </p>
        )}
        <div className="flex gap-1 mt-1">
          {STATUS_OPTIONS.filter((s) => s !== task.status).map((s) => (
            <Button key={s} variant="ghost" size="sm" className="text-[10px] h-5 px-2" onClick={() => onStatusChange(task.id, s)}>
              {s === "done" ? "✓ Done" : s === "in_progress" ? "→ In Progress" : "← Todo"}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
