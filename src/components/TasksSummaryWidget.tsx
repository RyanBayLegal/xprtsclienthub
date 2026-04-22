import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CalendarClock, CheckCircle2, ListTodo, Inbox } from "lucide-react";

interface TaskRow {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  assigned_to_name: string | null;
  priority: string | null;
}

function ymd(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function TasksSummaryWidget() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, status, due_date, assigned_to_name, priority");
      if (!cancelled) setTasks(data || []);
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    if (!tasks) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr = ymd(today);
    const t1 = new Date(today); t1.setDate(t1.getDate() + 1);
    const t2 = new Date(today); t2.setDate(t2.getDate() + 2);
    const t1Str = ymd(t1);
    const t2Str = ymd(t2);

    const open = tasks.filter((t) => t.status !== "done");
    const byStatus: Record<string, number> = {};
    tasks.forEach((t) => { byStatus[t.status] = (byStatus[t.status] || 0) + 1; });

    const overdue = open.filter((t) => t.due_date && t.due_date < todayStr);
    const dueToday = open.filter((t) => t.due_date === todayStr);
    const dueTomorrow = open.filter((t) => t.due_date === t1Str);
    const dueDayAfter = open.filter((t) => t.due_date === t2Str);
    const upcoming = [...dueToday, ...dueTomorrow, ...dueDayAfter];

    return {
      total: tasks.length,
      open: open.length,
      done: byStatus.done || 0,
      inProgress: byStatus.in_progress || 0,
      todo: byStatus.todo || 0,
      overdue,
      dueToday,
      dueTomorrow,
      dueDayAfter,
      upcoming,
      todayStr,
      t1Str,
      t2Str,
    };
  }, [tasks]);

  if (!stats) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base font-semibold">Tasks Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[0,1,2,3].map((i) => <Skeleton key={i} className="h-20" />)}
          </div>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const labelFor = (dateStr: string | null) => {
    if (!dateStr) return "";
    if (dateStr === stats.todayStr) return "Today";
    if (dateStr === stats.t1Str) return "Tomorrow";
    if (dateStr === stats.t2Str) return "In 2 days";
    return dateStr;
  };

  const tone = (dateStr: string | null) => {
    if (dateStr === stats.todayStr) return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    if (dateStr === stats.t1Str) return "bg-primary/10 text-primary";
    return "bg-muted text-muted-foreground";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold">Tasks Summary</CardTitle>
        <button
          onClick={() => navigate("/tasks")}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          View all
        </button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 mb-1">
              <ListTodo className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">To Do</span>
            </div>
            <p className="text-2xl font-bold">{stats.todo}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 mb-1">
              <CalendarClock className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">In Progress</span>
            </div>
            <p className="text-2xl font-bold">{stats.inProgress}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Done</span>
            </div>
            <p className="text-2xl font-bold">{stats.done}</p>
          </div>
          <div className={`rounded-lg border p-3 ${stats.overdue.length > 0 ? "border-destructive/40 bg-destructive/5" : "bg-card"}`}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className={`h-4 w-4 ${stats.overdue.length > 0 ? "text-destructive" : "text-muted-foreground"}`} />
              <span className={`text-xs font-medium ${stats.overdue.length > 0 ? "text-destructive" : "text-muted-foreground"}`}>Overdue</span>
            </div>
            <p className={`text-2xl font-bold ${stats.overdue.length > 0 ? "text-destructive" : ""}`}>{stats.overdue.length}</p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold">Upcoming (next 2 days)</h4>
            <span className="text-xs text-muted-foreground">{stats.upcoming.length} task{stats.upcoming.length === 1 ? "" : "s"}</span>
          </div>
          {stats.upcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-2">
                <Inbox className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No tasks due in the next 2 days</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[240px] overflow-auto pr-1">
              {stats.upcoming.slice(0, 12).map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate("/tasks")}
                  className="flex items-center justify-between w-full text-left p-2 rounded hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    {t.assigned_to_name && (
                      <p className="text-xs text-muted-foreground truncate">{t.assigned_to_name}</p>
                    )}
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded ml-2 shrink-0 ${tone(t.due_date)}`}>
                    {labelFor(t.due_date)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}