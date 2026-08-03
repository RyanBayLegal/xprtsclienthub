import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, RefreshCw } from "lucide-react";

interface AdminAuditEntry {
  id: string;
  actor_email: string | null;
  actor_name: string | null;
  target_email: string | null;
  target_name: string | null;
  action: string;
  old_value: string | null;
  new_value: string | null;
  details: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  disable: { label: "Disabled", variant: "destructive" },
  restore: { label: "Restored", variant: "secondary" },
  remove: { label: "Removed", variant: "destructive" },
  role_change: { label: "Role changed", variant: "default" },
};

const ROLE_LABELS: Record<string, string> = {
  team_admin: "Team Admin",
  staff_member: "Staff Member",
  client: "Client",
};

export default function UserAdminAuditLog({ refreshKey = 0 }: { refreshKey?: number }) {
  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase.from as any)("user_admin_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setEntries((data as AdminAuditEntry[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [refreshKey]);

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              User Access Audit Log
            </CardTitle>
            <CardDescription>
              Every disable, restore, removal and role change — who did it and when.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target user</TableHead>
              <TableHead>Change</TableHead>
              <TableHead>Performed by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  {loading ? "Loading…" : "No user access actions recorded yet."}
                </TableCell>
              </TableRow>
            ) : (
              entries.map((e) => {
                const meta = ACTION_LABELS[e.action] || { label: e.action, variant: "outline" as const };
                const oldV = e.old_value ? ROLE_LABELS[e.old_value] || e.old_value : null;
                const newV = e.new_value ? ROLE_LABELS[e.new_value] || e.new_value : null;
                return (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={meta.variant} className="text-xs">{meta.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">{e.target_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{e.target_email || ""}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {oldV || newV ? (
                        <span className="flex items-center gap-1 flex-wrap">
                          {oldV && <span className="rounded bg-muted px-1.5 py-0.5 text-xs line-through">{oldV}</span>}
                          {oldV && newV && <span className="text-xs text-muted-foreground">→</span>}
                          {newV && <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{newV}</span>}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{e.details || "—"}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">{e.actor_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{e.actor_email || ""}</div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
