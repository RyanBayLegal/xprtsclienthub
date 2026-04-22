import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users, UserCheck, Clock, Star, Search, FileText, AlertTriangle,
  CalendarClock, CheckCircle2, ListTodo, ChevronRight, TrendingUp, BarChart3
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { UserAvatar } from "@/components/UserAvatar";
import PipelineAgingWidget from "@/components/PipelineAgingWidget";
import LeadSourcesBreakdown from "@/components/LeadSourcesBreakdown";
import TasksSummaryWidget from "@/components/TasksSummaryWidget";
import VendorsSummaryWidget from "@/components/VendorsSummaryWidget";
import TalentPoolBreakdown from "@/components/TalentPoolBreakdown";

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

const stageLabels: Record<string, string> = {
  "Prospecting Stage": "Prospecting",
  "Discovery Stage": "Discovery",
  "Solution Mapping Stage": "Solution Mapping",
  "Proposal/Contract Stage": "Proposal/Contract",
  "Onboarding/Kickoff Stage": "Onboarding",
};

// --- Admin Dashboard ---
function AdminDashboard({ user, profile }: { user: any; profile: any }) {
  const navigate = useNavigate();
  const [stageCounts, setStageCounts] = useState<{ stage: string; count: number }[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [dueTodayCount, setDueTodayCount] = useState(0);
  const [newThisWeek, setNewThisWeek] = useState(0);
  const [conversionRate, setConversionRate] = useState(0);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      // Leads
      const { data: leads } = await supabase.from("leads").select("stage, created_at");
      if (leads) {
        setTotalLeads(leads.length);
        const counts: Record<string, number> = {};
        leads.forEach((l) => { counts[l.stage] = (counts[l.stage] || 0) + 1; });
        setStageCounts(STAGES.map((stage) => ({ stage, count: counts[stage] || 0 })));

        // New this week
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const newLeads = leads.filter(l => new Date(l.created_at) >= weekAgo);
        setNewThisWeek(newLeads.length);

        // Conversion rate (onboarding / total)
        const onboarded = counts["Onboarding/Kickoff Stage"] || 0;
        setConversionRate(leads.length > 0 ? Math.round((onboarded / leads.length) * 100) : 0);
      }

      // Tasks
      const today = new Date().toISOString().split("T")[0];
      const { data: overdue } = await supabase.from("tasks").select("id").lt("due_date", today).neq("status", "done").not("due_date", "is", null);
      setOverdueCount(overdue?.length ?? 0);
      const { data: dueToday } = await supabase.from("tasks").select("id").eq("due_date", today).neq("status", "done");
      setDueTodayCount(dueToday?.length ?? 0);

      // Recent leads for timeline
      const { data: recent } = await supabase.from("leads").select("id, name, stage, stage_changed_at, updated_at")
        .order("updated_at", { ascending: false }).limit(5);
      setRecentActivity(recent || []);

      // Staff
      const { data: staff } = await supabase.from("profiles").select("user_id, full_name, avatar_url, is_active")
        .eq("is_active", true).limit(6);
      setStaffList(staff || []);
    };

    fetchAll();
  }, []);

  // Follow-up notifications
  useEffect(() => {
    if (!user) return;
    const checkFollowUps = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data: dueLeads } = await supabase
        .from("leads").select("id, name, follow_up_date")
        .lte("follow_up_date", today).not("follow_up_date", "is", null);
      if (!dueLeads || dueLeads.length === 0) return;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data: existing } = await supabase
        .from("notifications").select("lead_id")
        .eq("user_id", user.id).eq("type", "follow_up_due")
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

  const criticalCount = overdueCount + dueTodayCount;

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Yesterday";
    return `${days}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Top row: Overdue + Pipeline */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Overdue Tasks Card */}
        <button onClick={() => navigate("/tasks")} className="text-left w-full">
          <Card className={`h-full transition-colors ${criticalCount > 0 ? "border-destructive/40 bg-destructive/5 hover:bg-destructive/10" : "hover:bg-muted/50"}`}>
            <CardContent className="pt-6 pb-6 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold uppercase tracking-wider text-destructive">Overdue Tasks</span>
                {criticalCount > 0 && (
                  <span className="h-8 w-8 rounded-full bg-destructive/15 flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </span>
                )}
              </div>
              <div>
                <div className="text-4xl font-bold text-destructive">{criticalCount}</div>
                <p className="text-sm text-muted-foreground mt-1">Critical Items</p>
              </div>
              <div className="mt-4 flex items-center text-sm font-medium text-primary">
                View details <ChevronRight className="h-4 w-4 ml-1" />
              </div>
            </CardContent>
          </Card>
        </button>

        {/* Pipeline Performance Card */}
        <Card className="h-full">
          <CardContent className="pt-6 pb-6 flex flex-col justify-between h-full">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Pipeline Performance</span>
            <div className="flex items-end justify-between mt-2">
              <div>
                <p className="text-lg font-semibold text-foreground">Total Active Leads</p>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="text-4xl font-bold text-primary">{totalLeads}</span>
                  {totalLeads > 0 && (
                    <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Active
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-6 text-right">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">New this week</p>
                  <p className="text-xl font-bold">{newThisWeek}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Conversion</p>
                  <p className="text-xl font-bold">{conversionRate}%</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lead Status Distribution */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-foreground" />
          <h2 className="text-lg font-semibold">Lead Status Distribution</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {stageCounts.map((sc, idx) => {
            const Icon = stageIcons[sc.stage] || Star;
            return (
              <Card key={sc.stage} className="relative overflow-hidden">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-primary" />
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Phase {String(idx + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{stageLabels[sc.stage]}</p>
                  <p className="text-3xl font-bold">{sc.count}</p>
                  <div className="mt-2 h-1 w-8 rounded-full bg-primary/30" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Pipeline Aging */}
      <PipelineAgingWidget />

      {/* Leads by Source */}
      <LeadSourcesBreakdown />

      {/* Tasks Summary */}
      <TasksSummaryWidget />

      {/* Vendors + Talent Pool */}
      <div className="grid gap-4 md:grid-cols-2">
        <VendorsSummaryWidget />
        <TalentPoolBreakdown />
      </div>

      {/* Bottom: Timeline + Staff */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Active Project Timeline */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">Active Project Timeline</CardTitle>
            <button onClick={() => navigate("/leads")} className="text-xs font-medium text-muted-foreground hover:text-foreground uppercase tracking-wider">
              Expand All
            </button>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivity.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No recent activity</p>
            )}
            {recentActivity.map((item) => {
              const timeAgo = getTimeAgo(item.stage_changed_at || item.updated_at);
              const isRecent = timeAgo === "Just now" || timeAgo.includes("m ago");
              return (
                <div key={item.id} className="flex gap-3 items-start">
                  <div className="mt-1.5 flex flex-col items-center">
                    <div className={`h-2.5 w-2.5 rounded-full ${isRecent ? "bg-primary" : "bg-muted-foreground/40"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{timeAgo}</p>
                    <p className="text-sm font-semibold truncate">{item.name} — {stageLabels[item.stage] || item.stage}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Stage updated</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Staff Availability */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Staff Availability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {staffList.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No staff found</p>
            )}
            {staffList.map((s) => (
              <div key={s.user_id} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <UserAvatar avatarUrl={s.avatar_url} fullName={s.full_name || "Staff"} size="sm" />
                  <span className="text-sm font-medium truncate max-w-[120px]">
                    {s.full_name ? s.full_name.split(" ").map((n: string) => n[0] ? `${n[0]}.` : "").join(" ").replace(/\.\s*$/, '') || s.full_name : "Staff"}
                  </span>
                </div>
                <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${s.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {s.is_active ? "Active" : "Offline"}
                </span>
              </div>
            ))}
            <button onClick={() => navigate("/staff")} className="w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground pt-2 border-t border-border mt-2">
              Manage Team
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- Staff Dashboard ---
function StaffDashboard({ user }: { user: any }) {
  const navigate = useNavigate();
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [doneCount, setDoneCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase.from("tasks").select("id, title, status, due_date, priority")
        .eq("assigned_to", user.id).neq("status", "done").order("due_date", { ascending: true }).limit(10);
      setMyTasks(data || []);
      setOverdueCount((data || []).filter(t => t.due_date && t.due_date < today).length);

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
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, avatar_url").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) setProfile(data);
    });
  }, [user]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "";

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">☰ Workspace Dashboard</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {greeting}{displayName ? `, ${displayName}` : ""}!
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here's a snapshot of your team performance and active leads today.
          </p>
        </div>
      </div>

      {role === "team_admin" && <AdminDashboard user={user} profile={profile} />}
      {role === "staff_member" && <StaffDashboard user={user} />}
      {role === "client" && <ClientDashboard user={user} />}
      {!role && <p className="text-muted-foreground text-center py-12">Loading your dashboard...</p>}
    </div>
  );
}
