import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface LogRow {
  id: string;
  created_at: string;
  channel: string;
  recipient_email: string | null;
  lead_id: string | null;
  task_id: string | null;
  subject: string | null;
  status: string;
  error_message: string | null;
  message_id: string | null;
}

export default function NotificationLogs() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [channel, setChannel] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const fetchLogs = async () => {
    setLoading(true);
    let q = (supabase as any).from("notification_logs").select("*").order("created_at", { ascending: false }).limit(500);
    if (channel !== "all") q = q.eq("channel", channel);
    if (status !== "all") q = q.eq("status", status);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    else setRows((data as LogRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); /* eslint-disable-next-line */ }, [channel, status]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notification Delivery Log</h1>
          <p className="text-muted-foreground">Every email send attempt for new leads and tasks.</p>
        </div>
        <Button variant="outline" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="w-48">
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger><SelectValue placeholder="Channel" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="task">Task</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Related</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No delivery attempts yet.</TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-sm">{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell className="capitalize">{r.channel}</TableCell>
                  <TableCell>{r.recipient_email || "—"}</TableCell>
                  <TableCell className="max-w-xs truncate">{r.subject || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.lead_id || r.task_id || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "sent" ? "default" : r.status === "failed" ? "destructive" : "secondary"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-sm text-xs text-destructive truncate" title={r.error_message || ""}>
                    {r.error_message || ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}