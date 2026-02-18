import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
import { Users } from "lucide-react";

interface StaffRow {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  assigned_count: number;
  completed_count: number;
}

export default function Staff() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStaff = async () => {
      // Get team_admin and staff_member roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["team_admin", "staff_member"]);
      if (!roles || roles.length === 0) { setLoading(false); return; }

      const userIds = roles.map((r) => r.user_id);

      // Fetch profiles and tasks in parallel
      const [profilesRes, tasksRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds),
        supabase.from("tasks").select("assigned_to, status").in("assigned_to", userIds),
      ]);

      const profileMap = Object.fromEntries(
        (profilesRes.data || []).map((p) => [p.user_id, p])
      );

      // Count tasks per staff
      const assignedCounts: Record<string, number> = {};
      const completedCounts: Record<string, number> = {};
      (tasksRes.data || []).forEach((t) => {
        if (!t.assigned_to) return;
        assignedCounts[t.assigned_to] = (assignedCounts[t.assigned_to] || 0) + 1;
        if (t.status === "done") {
          completedCounts[t.assigned_to] = (completedCounts[t.assigned_to] || 0) + 1;
        }
      });

      const staffRows: StaffRow[] = roles.map((r) => {
        const profile = profileMap[r.user_id];
        return {
          user_id: r.user_id,
          full_name: profile?.full_name || null,
          avatar_url: profile?.avatar_url || null,
          role: r.role,
          assigned_count: assignedCounts[r.user_id] || 0,
          completed_count: completedCounts[r.user_id] || 0,
        };
      });

      setStaff(staffRows);
      setLoading(false);
    };
    fetchStaff();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Staff Directory</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Staff</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{staff.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Assigned Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{staff.reduce((s, m) => s + m.assigned_count, 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{staff.reduce((s, m) => s + m.completed_count, 0)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Assigned Tasks</TableHead>
                <TableHead>Completed Tasks</TableHead>
                <TableHead>Completion Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No staff members found</TableCell>
                </TableRow>
              ) : staff.map((s) => {
                const rate = s.assigned_count > 0 ? Math.round((s.completed_count / s.assigned_count) * 100) : 0;
                return (
                  <TableRow key={s.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <UserAvatar avatarUrl={s.avatar_url} fullName={s.full_name} size="md" />
                        <span className="font-medium">{s.full_name || "Unnamed"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {s.role.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>{s.assigned_count}</TableCell>
                    <TableCell>{s.completed_count}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{rate}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
