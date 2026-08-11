import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { History, RefreshCw, Search, X, Eye } from "lucide-react";

interface AdminAuditEntry {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  target_user_id: string | null;
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
  invite_email_sent: { label: "Invite emailed", variant: "secondary" },
  invite_email_failed: { label: "Invite email failed", variant: "destructive" },
  invite_resend_sent: { label: "Invite resent", variant: "secondary" },
  invite_resend_failed: { label: "Invite resend failed", variant: "destructive" },
};

const ROLE_LABELS: Record<string, string> = {
  team_admin: "Team Admin",
  staff_member: "Staff Member",
  client: "Client",
};

export default function UserAdminAuditLog({ refreshKey = 0 }: { refreshKey?: number }) {
  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actorFilter, setActorFilter] = useState("all");
  const [targetFilter, setTargetFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [detail, setDetail] = useState<AdminAuditEntry | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase.from as any)("user_admin_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setEntries((data as AdminAuditEntry[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [refreshKey]);

  const actors = useMemo(
    () => Array.from(new Set(entries.map((e) => e.actor_email).filter(Boolean) as string[])),
    [entries]
  );
  const targets = useMemo(
    () => Array.from(new Set(entries.map((e) => e.target_email).filter(Boolean) as string[])),
    [entries]
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (actorFilter !== "all" && e.actor_email !== actorFilter) return false;
      if (targetFilter !== "all" && e.target_email !== targetFilter) return false;
      if (actionFilter !== "all" && e.action !== actionFilter) return false;
      const created = new Date(e.created_at);
      if (fromDate && created < new Date(`${fromDate}T00:00:00`)) return false;
      if (toDate && created > new Date(`${toDate}T23:59:59`)) return false;
      if (!s) return true;
      return [
        e.actor_email, e.actor_name, e.target_email, e.target_name,
        e.action, e.old_value, e.new_value, e.details,
      ].some((v) => v?.toLowerCase().includes(s));
    });
  }, [entries, search, actorFilter, targetFilter, actionFilter, fromDate, toDate]);

  const clearFilters = () => {
    setSearch(""); setActorFilter("all"); setTargetFilter("all");
    setActionFilter("all"); setFromDate(""); setToDate("");
  };

  const hasFilters =
    !!search || actorFilter !== "all" || targetFilter !== "all" || actionFilter !== "all" || !!fromDate || !!toDate;

  const beforeAfter = (e: AdminAuditEntry) => ({
    before: { value: e.old_value, role: e.old_value ? ROLE_LABELS[e.old_value] ?? e.old_value : null },
    after: { value: e.new_value, role: e.new_value ? ROLE_LABELS[e.new_value] ?? e.new_value : null },
  });

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
        <div className="flex flex-wrap items-center gap-2 pt-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-52 pl-8 text-sm"
            />
          </div>
          <Select value={actorFilter} onValueChange={setActorFilter}>
            <SelectTrigger className="h-8 w-[190px] text-xs"><SelectValue placeholder="Actor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actors</SelectItem>
              {actors.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={targetFilter} onValueChange={setTargetFilter}>
            <SelectTrigger className="h-8 w-[190px] text-xs"><SelectValue placeholder="Target" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All target users</SelectItem>
              {targets.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Action" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="disable">Disabled</SelectItem>
              <SelectItem value="restore">Restored</SelectItem>
              <SelectItem value="remove">Removed</SelectItem>
              <SelectItem value="role_change">Role changed</SelectItem>
              <SelectItem value="invite_email_sent">Invite emailed</SelectItem>
              <SelectItem value="invite_email_failed">Invite email failed</SelectItem>
              <SelectItem value="invite_resend_sent">Invite resent</SelectItem>
              <SelectItem value="invite_resend_failed">Invite resend failed</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 w-[150px] text-xs" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 w-[150px] text-xs" />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8">
              <X className="h-3.5 w-3.5 mr-1" />Clear
            </Button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} of {entries.length}</span>
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
              <TableHead className="text-right">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {loading ? "Loading…" : hasFilters ? "No entries match these filters." : "No user access actions recorded yet."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((e) => {
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
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setDetail(e)} title="View full details">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit event details</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Action:</span> {ACTION_LABELS[detail.action]?.label || detail.action}</div>
                <div><span className="text-muted-foreground">When:</span> {new Date(detail.created_at).toLocaleString()}</div>
                <div><span className="text-muted-foreground">Actor:</span> {detail.actor_name || "—"} ({detail.actor_email || "—"})</div>
                <div><span className="text-muted-foreground">Target:</span> {detail.target_name || "—"} ({detail.target_email || "—"})</div>
                <div className="col-span-2"><span className="text-muted-foreground">Notes:</span> {detail.details || "—"}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium mb-1">Before</p>
                  <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
{JSON.stringify(beforeAfter(detail).before, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">After</p>
                  <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
{JSON.stringify(beforeAfter(detail).after, null, 2)}
                  </pre>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium mb-1">Raw event</p>
                <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
{JSON.stringify(detail, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
