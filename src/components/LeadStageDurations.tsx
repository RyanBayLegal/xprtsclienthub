import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Clock } from "lucide-react";

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

export default function LeadStageDurations() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [logs, setLogs] = useState<StageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const [{ data: leadsData }, { data: logsData }] = await Promise.all([
        supabase
          .from("leads")
          .select("id, name, stage, created_at, stage_changed_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("audit_logs")
          .select("entity_id, old_value, new_value, created_at")
          .eq("entity_type", "lead")
          .eq("field_name", "Stage")
          .order("created_at", { ascending: true }),
      ]);
      setLeads((leadsData || []) as Lead[]);
      setLogs((logsData || []) as StageLog[]);
      setLoading(false);
    };
    fetch();
  }, []);

  const durations = useMemo<LeadDuration[]>(() => {
    const now = Date.now();
    const logsByLead = new Map<string, StageLog[]>();
    logs.forEach((l) => {
      if (!logsByLead.has(l.entity_id)) logsByLead.set(l.entity_id, []);
      logsByLead.get(l.entity_id)!.push(l);
    });

    return leads.map((lead) => {
      const leadLogs = logsByLead.get(lead.id) || [];
      const segments: StageSegment[] = [];

      // First stage starts at created_at. If first log has old_value, it's the original stage.
      let cursorTime = lead.created_at;
      let cursorStage = leadLogs[0]?.old_value || lead.stage;

      for (const log of leadLogs) {
        const days = dayDiff(cursorTime, log.created_at);
        segments.push({ stage: log.old_value || cursorStage, days });
        cursorTime = log.created_at;
        cursorStage = log.new_value || cursorStage;
      }

      // Current stage segment (still ongoing)
      const currentDays = dayDiff(cursorTime, now);
      segments.push({ stage: lead.stage, days: currentDays, current: true });

      const totalDays = dayDiff(lead.created_at, now);
      return {
        id: lead.id,
        name: lead.name,
        currentStage: lead.stage,
        totalDays,
        segments,
      };
    });
  }, [leads, logs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return durations;
    return durations.filter((d) => d.name.toLowerCase().includes(q));
  }, [durations, search]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Per-Lead Stage Durations
          </CardTitle>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search lead..."
              className="pl-8 h-8 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Days each lead has stayed in every stage. Current stage is still counting.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">No leads to show.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Lead</TableHead>
                  <TableHead className="w-[160px]">Current Stage</TableHead>
                  <TableHead className="w-[90px] text-right">Total Days</TableHead>
                  <TableHead>Stage Journey</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => (
                  <TableRow key={d.id}>
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
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}