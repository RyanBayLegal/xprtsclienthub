import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, Clock, Star, Search, FileText, AlertTriangle, CalendarClock, CheckCircle2, ListTodo } from "lucide-react";
import { useNavigate } from "react-router-dom";

const STAGES = [
  "Prospecting Stage",
  "Discovery Stage",
  "Solution Mapping Stage",
  "Proposal/Contract Stage",
  "Onboarding/Kickoff Stage",
];

const stageIcons: Record<string, typeof Users> = {
  "Prospecting Stage": Search,
  "Discovery Stage": Users,
  "Solution Mapping Stage": FileText,
  "Proposal/Contract Stage": Clock,
  "Onboarding/Kickoff Stage": UserCheck,
};

// --- Admin Dashboard ---
function AdminDashboard({ user }: { user: any }) {
  const navigate = useNavigate();
  const [stageCounts, setStageCounts] = useState<{ stage: string; count: number }[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [dueTodayCount, setDueTodayCount] = useState(0);

  useEffect(() => {
    const fetchCounts = async () => {
      const { data } = await supabase.from("leads").select("stage");
      if (data) {
        setTotalLeads(data.length);
        const counts: Record<string, number> = {};
        data.forEach((l) => { counts[l.stage] = (counts[l.stage] || 0) + 1; });
        setStageCounts(STAGES.map((stage) => ({ stage, count: counts[stage] || 0 })));
      }
    };

    const fetchTaskAlerts = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data: overdue } = await supabase.from("tasks").select("id").lt("due_date", today).neq("status", "done").not("due_date", "is", null);
      setOverdueCount(overdue?.length ?? 0);
      const { data: dueToday } = await supabase.from("tasks").select("id").eq("due_date", today).neq("status", "done");
      setDueTodayCount(dueToday?.length ?? 0);
    };

    fetchCounts();
    fetchTaskAlerts();
  }, []);

  // Follow-up due notifications
  useEffect(() => {
    if (!user) return;
    const checkFollowUps = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data: dueLeads } = await supabase
        .from("leads")
        .select("id, name, follow_up_date")
        .lte("follow_up_date", today)
        .not("follow_up_date", "is", null);

      if (!dueLeads || dueLeads.length === 0) return;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data: existing } = await supabase
        .from("notifications")
        .select("lead_id")
        .eq("user_id", user.id)
        .eq("type", "follow_up_due")
        .gte("created_at", todayStart.toISOString());

      const existingLeadIds = new Set((existing || []).map((n) => n.lead_id));
      const newNotifications = dueLeads
        .filter((l) => !existingLeadIds.has(l.id))
        .map((l) => ({
          user_id: user.id, type: "follow_up_due", title: "Follow-up due",
          message: `${l.name} — follow-up was due ${l.follow_up_date}`, lead_id: l.id,
        }));
      if (newNotifications.length > 0) await supabase.from("notifications").insert(newNotifications);

      const { data: overdueTasks } = await supabase
        .from("tasks").select("id, title, due_date, assigned_to_name")
        .lt("due_date", today).neq("status", "done").not("due_date", "is", null);

      if (overdueTasks && overdueTasks.length > 0) {
        const { data: existingTaskNotifs } = await supabase
          .from("notifications").select("lead_id").eq("user_id", user.id)
          .eq("type", "task_overdue").gte("created_at", todayStart.toISOString());
        const existingTaskIds = new Set((existingTaskNotifs || []).map((n) => n.lead_id));
        const taskNotifications = overdueTasks
          .filter((t) => !existingTaskIds.has(t.id))
          .map((t) => ({
            user_id: user.id, type: "task_overdue", title: "Task overdue",
            message: `"${t.title}"${t.assigned_to_name ? ` (${t.assigned_to_name})` : ""} was due ${t.due_date}`,
            lead_id: t.id,
          }));
        if (taskNotifications.length > 0) await supabase.from("notifications").insert(taskNotifications);
      }
    };
    checkFollowUps();
  }, [user]);

  return (
    <>
      {(overdueCount > 0 || dueTodayCount > 0) && (
        <div className="grid gap-4 md:grid-cols-2 mb-4">
          {overdueCount > 0 && (
            <button onClick={() => navigate("/tasks")} className="text-left w-full">
              <Card className="border-destructive/40 bg-destructive/5 hover:bg-destructive/10 transition-colors cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-destructive">Overdue Tasks</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-destructive">{overdueCount}</div>
                  <p className="text-xs text-destructive/70 mt-1">Click to view tasks</p>
                </CardContent>
              </Card>
            </button>
          )}
          {dueTodayCount > 0 && (
            <button onClick={() => navigate("/tasks")} className="text-left w-full">
              <Card className="border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 transition-colors cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-amber-600">Due Today</CardTitle>
                  <CalendarClock className="h-4 w-4 text-amber-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-amber-600">{dueTodayCount}</div>
                  <p className="text-xs text-amber-600/70 mt-1">Click to view tasks</p>
                </CardContent>
              </Card>
            </button>
          )}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{totalLeads}</div></CardContent>
        </Card>
        {stageCounts.map((sc) => {
          const Icon = stageIcons[sc.stage] || Star;
          return (
            <Card key={sc.stage}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{sc.stage.replace(" Stage", "")}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-3xl font-bold">{sc.count}</div></CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}

// --- Staff Dashboard ---
function StaffDashboard({ user }: { user: any }) {
  const navigate = useNavigate();
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [dueTodayCount, setDueTodayCount] = useState(0);
  const [doneCount, setDoneCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase.from("tasks").select("id, title, status, due_date, priority")
        .eq("assigned_to", user.id).neq("status", "done").order("due_date", { ascending: true }).limit(10);
      setMyTasks(data || []);

      const overdue = (data || []).filter(t => t.due_date && t.due_date < today);
      setOverdueCount(overdue.length);
      const dueToday = (data || []).filter(t => t.due_date === today);
      setDueTodayCount(dueToday.length);

      const { count } = await supabase.from("tasks").select("id", { count: "exact", head: true })
        .eq("assigned_to", user.id).eq("status", "done");
      setDoneCount(count ?? 0);
    };
    fetch();
  }, [user]);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Tasks</CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{myTasks.length}</div></CardContent>
        </Card>
        {overdueCount > 0 && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-destructive">Overdue</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent><div className="text-3xl font-bold text-destructive">{overdueCount}</div></CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{doneCount}</div></CardContent>
        </Card>
      </div>
      {myTasks.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">My Upcoming Tasks</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {myTasks.map(t => {
              const today = new Date().toISOString().split("T")[0];
              const isOverdue = t.due_date && t.due_date < today;
              const isDueToday = t.due_date === today;
              return (
                <button key={t.id} onClick={() => navigate("/tasks")} className="flex items-center justify-between w-full text-left p-2 rounded hover:bg-muted/50 transition-colors">
                  <span className="text-sm font-medium truncate">{t.title}</span>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    {isOverdue && <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">Overdue</span>}
                    {isDueToday && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700">Today</span>}
                    {t.due_date && !isOverdue && !isDueToday && <span className="text-[10px] text-muted-foreground">{t.due_date}</span>}
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}
    </>
  );
}

// --- Client Dashboard ---
function ClientDashboard({ user }: { user: any }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [myTasks, setMyTasks] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: cp } = await supabase.from("client_profiles").select("id, name, stage, company")
        .eq("user_id", user.id).maybeSingle();
      setProfile(cp);

      const { data: tasks } = await supabase.from("tasks").select("id, title, status, due_date, priority")
        .eq("assigned_to", user.id).neq("status", "done").order("due_date", { ascending: true }).limit(10);
      setMyTasks(tasks || []);
    };
    fetch();
  }, [user]);

  return (
    <>
      {profile && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <p className="text-lg font-semibold">{profile.name}</p>
            {profile.company && <p className="text-sm text-muted-foreground">{profile.company}</p>}
            {profile.stage && (
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-primary/10 text-primary mt-2">
                {profile.stage}
              </span>
            )}
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Tasks</CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{myTasks.length}</div></CardContent>
        </Card>
      </div>
      {myTasks.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">My Tasks</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {myTasks.map(t => (
              <div key={t.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                <span className="text-sm font-medium truncate">{t.title}</span>
                {t.due_date && <span className="text-[10px] text-muted-foreground ml-2 shrink-0">{t.due_date}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {myTasks.length === 0 && !profile && (
        <p className="text-muted-foreground text-center py-12">Welcome! Your dashboard will show your tasks and profile information once set up.</p>
      )}
    </>
  );
}

export default function Dashboard() {
  const { user, role } = useAuth();
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">{greeting}!</h1>
      <p className="text-sm text-muted-foreground mb-6">Here's what's happening today.</p>

      {role === "team_admin" && <AdminDashboard user={user} />}
      {role === "staff_member" && <StaffDashboard user={user} />}
      {role === "client" && <ClientDashboard user={user} />}
      {!role && <p className="text-muted-foreground text-center py-12">Loading your dashboard...</p>}
    </div>
  );
}
