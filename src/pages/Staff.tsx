import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
import { Users, UserX } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface StaffRow {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  assigned_count: number;
  completed_count: number;
  is_active: boolean;
}

export default function Staff() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{ userId: string; name: string; activate: boolean } | null>(null);

  const fetchStaff = async () => {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["team_admin", "staff_member"]);
    if (!roles || roles.length === 0) { setLoading(false); return; }

    const userIds = roles.map((r) => r.user_id);

    const [profilesRes, tasksRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, avatar_url, is_active").in("user_id", userIds),
      supabase.from("tasks").select("assigned_to, status").in("assigned_to", userIds),
    ]);

    const profileMap = Object.fromEntries(
      (profilesRes.data || []).map((p) => [p.user_id, p])
    );

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
        is_active: profile?.is_active ?? true,
      };
    });

    setStaff(staffRows);
    setLoading(false);
  };

  useEffect(() => { fetchStaff(); }, []);

  const handleToggleActive = async (userId: string, activate: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: activate })
      .eq("user_id", userId);

    if (error) {
      toast.error("Failed to update staff status");
    } else {
      toast.success(activate ? "Staff member reactivated" : "Staff member deactivated");
      fetchStaff();
    }
    setConfirmDialog(null);
  };

  const activeStaff = staff.filter((s) => s.is_active);
  const previousStaff = staff.filter((s) => !s.is_active);

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  const StaffTable = ({ rows, showToggle = true }: { rows: StaffRow[]; showToggle?: boolean }) => (
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
              {showToggle && <TableHead className="text-right">Active</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showToggle ? 6 : 5} className="text-center text-muted-foreground py-8">
                  No staff members found
                </TableCell>
              </TableRow>
            ) : rows.map((s) => {
              const rate = s.assigned_count > 0 ? Math.round((s.completed_count / s.assigned_count) * 100) : 0;
              return (
                <TableRow key={s.user_id} className={!s.is_active ? "opacity-60" : ""}>
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
                  {showToggle && (
                    <TableCell className="text-right">
                      <Switch
                        checked={s.is_active}
                        onCheckedChange={(checked) =>
                          setConfirmDialog({
                            userId: s.user_id,
                            name: s.full_name || "this staff member",
                            activate: checked,
                          })
                        }
                      />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Staff Directory</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Staff</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeStaff.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Assigned Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeStaff.reduce((s, m) => s + m.assigned_count, 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeStaff.reduce((s, m) => s + m.completed_count, 0)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            <Users className="h-4 w-4" /> Active ({activeStaff.length})
          </TabsTrigger>
          <TabsTrigger value="previous" className="gap-2">
            <UserX className="h-4 w-4" /> Previous ({previousStaff.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          <StaffTable rows={activeStaff} />
        </TabsContent>
        <TabsContent value="previous">
          <StaffTable rows={previousStaff} />
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog?.activate ? "Reactivate Staff Member" : "Deactivate Staff Member"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog?.activate
                ? `Are you sure you want to reactivate ${confirmDialog.name}? They will be able to log in again.`
                : `Are you sure you want to deactivate ${confirmDialog?.name}? They will be moved to "Previous Staff" and will no longer be able to access the application.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDialog && handleToggleActive(confirmDialog.userId, confirmDialog.activate)}
            >
              {confirmDialog?.activate ? "Reactivate" : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
