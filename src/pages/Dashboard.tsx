import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, Clock, Star, Search, FileText } from "lucide-react";

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

export default function Dashboard() {
  const { user } = useAuth();
  const [stageCounts, setStageCounts] = useState<{ stage: string; count: number }[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);

  useEffect(() => {
    const fetchCounts = async () => {
      const { data } = await supabase.from("leads").select("stage");
      if (data) {
        setTotalLeads(data.length);
        const counts: Record<string, number> = {};
        data.forEach((l) => {
          counts[l.stage] = (counts[l.stage] || 0) + 1;
        });
        setStageCounts(
          STAGES.map((stage) => ({ stage, count: counts[stage] || 0 }))
        );
      }
    };
    fetchCounts();
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

      // Check existing notifications for today to avoid duplicates
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
          user_id: user.id,
          type: "follow_up_due",
          title: "Follow-up due",
          message: `${l.name} — follow-up was due ${l.follow_up_date}`,
          lead_id: l.id,
        }));

      if (newNotifications.length > 0) {
        await supabase.from("notifications").insert(newNotifications);
      }

      // Check for overdue tasks
      const { data: overdueTasks } = await supabase
        .from("tasks")
        .select("id, title, due_date, assigned_to_name")
        .lt("due_date", today)
        .neq("status", "done")
        .not("due_date", "is", null);

      if (overdueTasks && overdueTasks.length > 0) {
        const { data: existingTaskNotifs } = await supabase
          .from("notifications")
          .select("lead_id")
          .eq("user_id", user.id)
          .eq("type", "task_overdue")
          .gte("created_at", todayStart.toISOString());

        const existingTaskIds = new Set((existingTaskNotifs || []).map((n) => n.lead_id));

        const taskNotifications = overdueTasks
          .filter((t) => !existingTaskIds.has(t.id))
          .map((t) => ({
            user_id: user.id,
            type: "task_overdue",
            title: "Task overdue",
            message: `"${t.title}"${t.assigned_to_name ? ` (${t.assigned_to_name})` : ""} was due ${t.due_date}`,
            lead_id: t.id,
          }));

        if (taskNotifications.length > 0) {
          await supabase.from("notifications").insert(taskNotifications);
        }
      }
    };
    checkFollowUps();
  }, [user]);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalLeads}</div>
          </CardContent>
        </Card>
        {stageCounts.map((sc) => {
          const Icon = stageIcons[sc.stage] || Star;
          return (
            <Card key={sc.stage}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {sc.stage.replace(" Stage", "")}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{sc.count}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
