import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search, History, ExternalLink } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Link, useSearchParams } from "react-router-dom";

interface AuditLog {
  id: string;
  user_id: string;
  user_name: string | null;
  entity_type: string;
  entity_id: string;
  client_profile_id: string | null;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  description: string | null;
  created_at: string;
}

interface AuditLogPanelProps {
  clientProfileId?: string;
  entityType?: string;
  entityId?: string;
  title?: string;
  compact?: boolean;
}

export default function AuditLogPanel({ clientProfileId, entityType, entityId, title, compact }: AuditLogPanelProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = compact ? 10 : 20;
  const [searchParams] = useSearchParams();
  const highlightAudit = searchParams.get("highlightAudit");
  const highlightRef = useRef<HTMLDivElement | null>(null);

  // After logs render, scroll the highlighted audit row into view.
  useEffect(() => {
    if (!highlightAudit || loading) return;
    const el = highlightRef.current;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightAudit, loading, logs]);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      let query = (supabase.from as any)("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (clientProfileId) query = query.eq("client_profile_id", clientProfileId);
      if (entityType) query = query.eq("entity_type", entityType);
      if (entityId) query = query.eq("entity_id", entityId);
      if (filterAction !== "all") query = query.eq("action", filterAction);

      const { data } = await query;
      setLogs((data || []) as unknown as AuditLog[]);
      setLoading(false);
    };
    fetchLogs();
  }, [clientProfileId, entityType, entityId, filterAction, page]);

  const filtered = logs.filter((l) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      l.user_name?.toLowerCase().includes(s) ||
      l.field_name?.toLowerCase().includes(s) ||
      l.entity_type?.toLowerCase().includes(s) ||
      l.description?.toLowerCase().includes(s) ||
      l.new_value?.toLowerCase().includes(s)
    );
  });

  const actionColor = (action: string) => {
    if (action === "create") return "bg-emerald-500/10 text-emerald-600 border-emerald-200";
    if (action === "delete") return "bg-destructive/10 text-destructive border-destructive/20";
    return "bg-primary/10 text-primary border-primary/20";
  };

  const actionLabel = (log: AuditLog) => {
    if (log.action === "create") return `created ${log.field_name || log.entity_type}`;
    if (log.action === "delete") return `deleted ${log.field_name || log.entity_type}`;
    return `updated ${log.field_name || log.entity_type}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            {title || "Activity Log"}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-48 pl-8 text-sm"
              />
            </div>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="h-8 w-28 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="create">Created</SelectItem>
                <SelectItem value="update">Updated</SelectItem>
                <SelectItem value="delete">Deleted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No activity logged yet.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((log) => {
              const isHighlight = highlightAudit === log.id;
              return (
              <div
                key={log.id}
                ref={isHighlight ? highlightRef : undefined}
                className={`flex items-start gap-3 p-3 border rounded-lg bg-card hover:bg-muted/30 transition-colors ${
                  isHighlight ? "ring-2 ring-primary ring-offset-2 ring-offset-background bg-primary/5" : ""
                }`}
              >
                <Badge variant="outline" className={`shrink-0 text-[10px] ${actionColor(log.action)}`}>
                  {log.action}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="font-medium">{log.user_name || "System"}</span>
                    <span className="text-muted-foreground">{actionLabel(log)}</span>
                    <span className="text-muted-foreground">on</span>
                    <Badge variant="secondary" className="text-[10px]">{log.entity_type}</Badge>
                    {log.entity_type === "lead" && log.entity_id && (
                      <Link
                        to={`/leads?leadId=${log.entity_id}`}
                        className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                      >
                        Open lead <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    )}
                    {log.entity_type === "client_profile" && log.entity_id && (
                      <Link
                        to={`/clients/${log.entity_id}`}
                        className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                      >
                        Open client <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    )}
                    {log.entity_type !== "client_profile" && log.client_profile_id && (
                      <Link
                        to={`/clients/${log.client_profile_id}`}
                        className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                      >
                        Client profile <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    )}
                  </div>
                  {(log.old_value || log.new_value) && (
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
                      {log.old_value && log.action !== "create" && (
                        <span className="line-through bg-destructive/5 px-1 rounded max-w-[200px] truncate inline-block">{log.old_value}</span>
                      )}
                      {log.old_value && log.new_value && log.action !== "create" && <span>→</span>}
                      {log.new_value && (
                        <span className="bg-emerald-500/5 px-1 rounded max-w-[200px] truncate inline-block">{log.new_value}</span>
                      )}
                    </div>
                  )}
                  {log.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{log.description}</p>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0" title={format(new Date(log.created_at), "PPpp")}>
                  {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                </span>
              </div>
              );
            })}
          </div>
        )}
        <div className="flex items-center justify-between mt-4">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-3 w-3 mr-1" />Prev
          </Button>
          <span className="text-xs text-muted-foreground">Page {page + 1}</span>
          <Button variant="outline" size="sm" disabled={filtered.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>
            Next<ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
