import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Clock, Download, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, History, Inbox, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToCSV } from "@/lib/csv-export";
import { format, formatDistanceToNow } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const PIPELINE_STAGES = [
  "New",
  "Prospecting Stage",
  "Discovery Stage",
  "Solution Mapping Stage",
  "Proposal/Contract Stage",
  "Onboarding/Kickoff Stage",
  "Lost Stage",
];

interface Lead {
  id: string;
  name: string;
  stage: string;
  created_at: string;
  stage_changed_at: string | null;
}

interface StageLog {
  entity_id: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

interface StageSegment {
  stage: string;
  days: number;
  startDate: string;
  endDate: string;
  current?: boolean;
}

interface LeadDuration {
  id: string;
  name: string;
  currentStage: string;
  totalDays: number;
  segments: StageSegment[];
}

const dayDiff = (from: string, to: string | number) => {
  const t = typeof to === "number" ? to : new Date(to).getTime();
  return Math.max(0, Math.floor((t - new Date(from).getTime()) / (1000 * 60 * 60 * 24)));
};

const PAGE_SIZE = 15;

const TIMELINE_COLORS = [
  "hsl(220, 70%, 55%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 60%, 55%)",
  "hsl(160, 60%, 40%)",
  "hsl(350, 60%, 50%)",
  "hsl(195, 70%, 45%)",
  "hsl(25, 85%, 55%)",
];

function buildSegments(lead: Lead, leadLogs: StageLog[], now: number): StageSegment[] {
  const nowIso = new Date(now).toISOString();
  const segments: StageSegment[] = [];
  let cursorTime = lead.created_at;
  let cursorStage = leadLogs[0]?.old_value || lead.stage;
  for (const log of leadLogs) {
    segments.push({
      stage: log.old_value || cursorStage,
      days: dayDiff(cursorTime, log.created_at),
      startDate: cursorTime,
      endDate: log.created_at,
    });
    cursorTime = log.created_at;
    cursorStage = log.new_value || cursorStage;
  }
  segments.push({
    stage: lead.stage,
    days: dayDiff(cursorTime, now),
    startDate: cursorTime,
    endDate: nowIso,
    current: true,
  });
  return segments;
}

export default function LeadStageDurations() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [logs, setLogs] = useState<StageLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [detailLead, setDetailLead] = useState<{ id: string; name: string; segment: StageSegment } | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset to first page when filters change
  useEffect(() => {
    setPage(1);
  }, [stageFilter, fromDate, toDate]);

  // Server-side fetch: only the current page of leads + their stage logs
  useEffect(() => {
    const fetchPage = async () => {
      setLoading(true);
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("leads")
        .select("id, name, stage, created_at, stage_changed_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (search) query = query.ilike("name", `%${search}%`);
      if (stageFilter !== "all") query = query.eq("stage", stageFilter);
      if (fromDate) query = query.gte("created_at", fromDate);
      if (toDate) query = query.lte("created_at", `${toDate}T23:59:59`);

      const { data: leadsData, count } = await query;
      const pageLeads = (leadsData || []) as Lead[];
      setLeads(pageLeads);
      setTotalCount(count || 0);

      if (pageLeads.length > 0) {
        const ids = pageLeads.map((l) => l.id);
        const { data: logsData } = await supabase
          .from("audit_logs")
          .select("entity_id, old_value, new_value, created_at")
          .eq("entity_type", "lead")
          .eq("field_name", "Stage")
          .in("entity_id", ids)
          .order("created_at", { ascending: true });
        setLogs((logsData || []) as StageLog[]);
      } else {
        setLogs([]);
      }
      setLoading(false);
    };
    fetchPage();
  }, [page, search, stageFilter, fromDate, toDate]);

  const durations = useMemo<LeadDuration[]>(() => {
    const now = Date.now();
    const logsByLead = new Map<string, StageLog[]>();
    logs.forEach((l) => {
      if (!logsByLead.has(l.entity_id)) logsByLead.set(l.entity_id, []);
      logsByLead.get(l.entity_id)!.push(l);
    });
    return leads.map((lead) => {
      const segments = buildSegments(lead, logsByLead.get(lead.id) || [], now);
      return {
        id: lead.id,
        name: lead.name,
        currentStage: lead.stage,
        totalDays: dayDiff(lead.created_at, now),
        segments,
      };
    });
  }, [leads, logs]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);

  const handleExport = async () => {
    let leadsQuery = supabase
      .from("leads")
      .select("id, name, stage, created_at, stage_changed_at")
      .order("created_at", { ascending: false });
    if (search) leadsQuery = leadsQuery.ilike("name", `%${search}%`);
    if (stageFilter !== "all") leadsQuery = leadsQuery.eq("stage", stageFilter);
    if (fromDate) leadsQuery = leadsQuery.gte("created_at", fromDate);
    if (toDate) leadsQuery = leadsQuery.lte("created_at", `${toDate}T23:59:59`);
    const { data: allLeads } = await leadsQuery;
    const leadsArr = (allLeads || []) as Lead[];
    if (leadsArr.length === 0) return;

    const ids = leadsArr.map((l) => l.id);
    const { data: allLogs } = await supabase
      .from("audit_logs")
      .select("entity_id, old_value, new_value, created_at")
      .eq("entity_type", "lead")
      .eq("field_name", "Stage")
      .in("entity_id", ids)
      .order("created_at", { ascending: true });
    const logsArr = (allLogs || []) as StageLog[];

    const now = Date.now();
    const logsByLead = new Map<string, StageLog[]>();
    logsArr.forEach((l) => {
      if (!logsByLead.has(l.entity_id)) logsByLead.set(l.entity_id, []);
      logsByLead.get(l.entity_id)!.push(l);
    });

    const headers = ["Lead", "Current Stage", "Total Days", "Stage Journey"];
    const rows = leadsArr.map((lead) => {
      const segs = buildSegments(lead, logsByLead.get(lead.id) || [], now);
      return [
        lead.name,
        lead.stage,
        dayDiff(lead.created_at, now),
        segs.map((s) => `${s.stage}: ${s.days}d${s.current ? " (current)" : ""}`).join(" → "),
      ];
    });
    exportToCSV("lead-stage-durations", headers, rows);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Per-Lead Stage Durations
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search lead..."
                className="pl-8 h-8 text-sm w-56"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={totalCount === 0}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Days each lead has stayed in every stage. Click a row to see the day-by-day timeline.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : durations.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">No leads to show.</p>
        ) : (
          <>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30px]"></TableHead>
                    <TableHead className="w-[200px]">Lead</TableHead>
                    <TableHead className="w-[160px]">Current Stage</TableHead>
                    <TableHead className="w-[90px] text-right">Total Days</TableHead>
                    <TableHead>Stage Journey</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {durations.map((d) => {
                    const isOpen = expandedId === d.id;
                    return (
                      <Fragment key={d.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => setExpandedId(isOpen ? null : d.id)}
                        >
                          <TableCell className="text-muted-foreground">
                            {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </TableCell>
                          <TableCell className="font-medium">{d.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] bg-primary/10 border-primary/20 text-primary">
                              {d.currentStage}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold">{d.totalDays}d</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {d.segments.map((s, i) => (
                                <span key={i} className="inline-flex items-center gap-1">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${
                                      s.current
                                        ? "bg-emerald-500/10 border-emerald-300 text-emerald-700"
                                        : "bg-muted/50 border-border"
                                    }`}
                                    title={s.current ? "Current stage (ongoing)" : "Past stage"}
                                  >
                                    {s.stage}: {s.days}d{s.current ? " •" : ""}
                                  </Badge>
                                  {i < d.segments.length - 1 && (
                                    <span className="text-muted-foreground text-[10px]">→</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                        {isOpen && (
                          <TableRow className="bg-muted/20 hover:bg-muted/20">
                            <TableCell colSpan={5} className="py-4">
                              <StageTimeline segments={d.segments} totalDays={Math.max(d.totalDays, 1)} />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                <span>
                  Showing {(pageSafe - 1) * PAGE_SIZE + 1}–{Math.min(pageSafe * PAGE_SIZE, totalCount)} of {totalCount}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pageSafe <= 1}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span>Page {pageSafe} / {totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={pageSafe >= totalPages}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StageTimeline({ segments, totalDays }: { segments: StageSegment[]; totalDays: number }) {
  const stageColor = new Map<string, string>();
  segments.forEach((s) => {
    if (!stageColor.has(s.stage)) {
      stageColor.set(s.stage, TIMELINE_COLORS[stageColor.size % TIMELINE_COLORS.length]);
    }
  });

  return (
    <div className="space-y-3">
      <div className="flex h-9 w-full overflow-hidden rounded-md border border-border">
        {segments.map((s, i) => {
          const widthPct = Math.max((s.days / totalDays) * 100, 2);
          return (
            <div
              key={i}
              className={`flex items-center justify-center text-[10px] font-medium text-white ${
                s.current ? "ring-2 ring-emerald-400 ring-inset" : ""
              }`}
              style={{ width: `${widthPct}%`, backgroundColor: stageColor.get(s.stage) }}
              title={`${s.stage} • ${s.days}d (${format(new Date(s.startDate), "MMM d, yyyy")} → ${
                s.current ? "now" : format(new Date(s.endDate), "MMM d, yyyy")
              })`}
            >
              {s.days >= 1 ? `${s.days}d` : ""}
            </div>
          );
        })}
      </div>

      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {segments.map((s, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 text-xs rounded-md border px-2 py-1.5 ${
              s.current ? "bg-emerald-500/5 border-emerald-300" : "bg-background border-border"
            }`}
          >
            <span
              className="h-3 w-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: stageColor.get(s.stage) }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-medium truncate">{s.stage}</span>
                {s.current && (
                  <Badge variant="outline" className="text-[9px] py-0 h-4 bg-emerald-500/10 border-emerald-300 text-emerald-700">
                    Current
                  </Badge>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {format(new Date(s.startDate), "MMM d, yyyy")} →{" "}
                {s.current ? "now" : format(new Date(s.endDate), "MMM d, yyyy")} ·{" "}
                <span className="font-semibold text-foreground">{s.days}d</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
