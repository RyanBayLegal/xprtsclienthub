import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, TrendingUp, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, subDays, subMonths, startOfDay, endOfDay } from "date-fns";
import StageRow from "@/components/pipeline-aging/StageRow";

interface StageAging {
  stage: string;
  avgDays: number;
  count: number;
}

interface EntityInStage {
  id: string;
  name: string;
  daysInStage: number;
}

const LEAD_STAGES = [
  "Prospecting Stage",
  "Discovery Stage",
  "Solution Mapping Stage",
  "Proposal/Contract Stage",
  "Onboarding/Kickoff Stage",
];

const CLIENT_STAGES = ["Prospect", "Active", "On Hold", "Offboarding", "Completed"];

const stageShortLabel = (s: string) => s.replace(" Stage", "");

type PresetKey = "all" | "7d" | "30d" | "90d" | "custom";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "all", label: "All Time" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "90d", label: "90 Days" },
  { key: "custom", label: "Custom" },
];

export default function PipelineAgingWidget() {
  const [leadAging, setLeadAging] = useState<StageAging[]>([]);
  const [clientAging, setClientAging] = useState<StageAging[]>([]);
  const [leadsByStage, setLeadsByStage] = useState<Record<string, EntityInStage[]>>({});
  const [clientsByStage, setClientsByStage] = useState<Record<string, EntityInStage[]>>({});
  const [loading, setLoading] = useState(true);

  const [preset, setPreset] = useState<PresetKey>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [showFromCal, setShowFromCal] = useState(false);
  const [showToCal, setShowToCal] = useState(false);

  const getDateRange = (): { from: Date | null; to: Date | null } => {
    if (preset === "all") return { from: null, to: null };
    if (preset === "custom") return { from: dateFrom || null, to: dateTo || null };
    const daysMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
    return { from: subDays(new Date(), daysMap[preset]), to: new Date() };
  };

  useEffect(() => {
    const fetchAging = async () => {
      setLoading(true);
      const { from, to } = getDateRange();

      // Build audit log queries with date filter
      let leadLogQuery = (supabase.from as any)("audit_logs")
        .select("entity_id, old_value, new_value, description, created_at")
        .eq("entity_type", "lead")
        .eq("field_name", "Stage")
        .order("created_at", { ascending: false });

      let clientLogQuery = (supabase.from as any)("audit_logs")
        .select("entity_id, old_value, new_value, description, created_at")
        .eq("entity_type", "client_profile")
        .eq("field_name", "Stage")
        .order("created_at", { ascending: false });

      if (from) {
        const fromISO = startOfDay(from).toISOString();
        leadLogQuery = leadLogQuery.gte("created_at", fromISO);
        clientLogQuery = clientLogQuery.gte("created_at", fromISO);
      }
      if (to) {
        const toISO = endOfDay(to).toISOString();
        leadLogQuery = leadLogQuery.lte("created_at", toISO);
        clientLogQuery = clientLogQuery.lte("created_at", toISO);
      }

      const [
        { data: leads },
        { data: leadLogs },
        { data: clients },
        { data: clientLogs },
      ] = await Promise.all([
        supabase.from("leads").select("id, name, stage, stage_changed_at, created_at"),
        leadLogQuery,
        supabase.from("client_profiles").select("id, name, stage, stage_changed_at, created_at"),
        clientLogQuery,
      ]);

      // --- Leads ---
      const leadStageMap: Record<string, { totalDays: number; count: number }> = {};
      const leadEntities: Record<string, EntityInStage[]> = {};
      LEAD_STAGES.forEach((s) => {
        leadStageMap[s] = { totalDays: 0, count: 0 };
        leadEntities[s] = [];
      });

      const now = to ? endOfDay(to).getTime() : Date.now();
      const filterFrom = from ? startOfDay(from).getTime() : null;

      (leads || []).forEach((l) => {
        if (leadStageMap[l.stage]) {
          const changedAt = l.stage_changed_at || l.created_at;
          const changedTime = new Date(changedAt).getTime();
          // For date-filtered view, only include if the entity entered the stage within or before the range
          if (filterFrom && changedTime > now) return;
          const effectiveStart = filterFrom ? Math.max(changedTime, filterFrom) : changedTime;
          const days = Math.max(0, Math.floor((now - effectiveStart) / 86400000));
          leadStageMap[l.stage].totalDays += days;
          leadStageMap[l.stage].count += 1;
          leadEntities[l.stage].push({ id: l.id, name: l.name, daysInStage: days });
        }
      });

      (leadLogs || []).forEach((log: any) => {
        const match = log.description?.match(/was in (.+?) for (\d+) days?/i);
        if (match) {
          const stage = match[1];
          const days = parseInt(match[2], 10);
          if (leadStageMap[stage]) {
            leadStageMap[stage].totalDays += days;
            leadStageMap[stage].count += 1;
          }
        }
      });

      Object.values(leadEntities).forEach((arr) => arr.sort((a, b) => b.daysInStage - a.daysInStage));
      setLeadsByStage(leadEntities);
      setLeadAging(
        LEAD_STAGES.map((s) => ({
          stage: s,
          avgDays: leadStageMap[s].count > 0 ? Math.round(leadStageMap[s].totalDays / leadStageMap[s].count) : 0,
          count: leadStageMap[s].count,
        }))
      );

      // --- Clients ---
      const clientStageMap: Record<string, { totalDays: number; count: number }> = {};
      const clientEntities: Record<string, EntityInStage[]> = {};
      CLIENT_STAGES.forEach((s) => {
        clientStageMap[s] = { totalDays: 0, count: 0 };
        clientEntities[s] = [];
      });

      (clients || []).forEach((c) => {
        const stage = c.stage || "Prospect";
        if (clientStageMap[stage]) {
          const changedAt = c.stage_changed_at || c.created_at;
          const changedTime = new Date(changedAt).getTime();
          if (filterFrom && changedTime > now) return;
          const effectiveStart = filterFrom ? Math.max(changedTime, filterFrom) : changedTime;
          const days = Math.max(0, Math.floor((now - effectiveStart) / 86400000));
          clientStageMap[stage].totalDays += days;
          clientStageMap[stage].count += 1;
          clientEntities[stage].push({ id: c.id, name: c.name, daysInStage: days });
        }
      });

      (clientLogs || []).forEach((log: any) => {
        const match = log.description?.match(/was in (.+?) for (\d+) days?/i);
        if (match) {
          const stage = match[1];
          const days = parseInt(match[2], 10);
          if (clientStageMap[stage]) {
            clientStageMap[stage].totalDays += days;
            clientStageMap[stage].count += 1;
          }
        }
      });

      Object.values(clientEntities).forEach((arr) => arr.sort((a, b) => b.daysInStage - a.daysInStage));
      setClientsByStage(clientEntities);
      setClientAging(
        CLIENT_STAGES.map((s) => ({
          stage: s,
          avgDays: clientStageMap[s].count > 0 ? Math.round(clientStageMap[s].totalDays / clientStageMap[s].count) : 0,
          count: clientStageMap[s].count,
        }))
      );

      setLoading(false);
    };

    fetchAging();
  }, [preset, dateFrom, dateTo]);

  const maxLeadDays = Math.max(...leadAging.map((s) => s.avgDays), 1);
  const maxClientDays = Math.max(...clientAging.map((s) => s.avgDays), 1);
  const totalLeadEntries = leadAging.reduce((sum, s) => sum + s.count, 0);
  const totalClientEntries = clientAging.reduce((sum, s) => sum + s.count, 0);

  const rangeLabel = (() => {
    if (preset === "all") return "All Time";
    if (preset === "custom") {
      if (dateFrom && dateTo) return `${format(dateFrom, "MMM d")} – ${format(dateTo, "MMM d, yyyy")}`;
      if (dateFrom) return `From ${format(dateFrom, "MMM d, yyyy")}`;
      if (dateTo) return `Until ${format(dateTo, "MMM d, yyyy")}`;
      return "Custom";
    }
    return `Last ${preset.replace("d", " days")}`;
  })();

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.filter((p) => p.key !== "custom").map((p) => (
          <Button
            key={p.key}
            size="sm"
            variant={preset === p.key ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => { setPreset(p.key); setDateFrom(undefined); setDateTo(undefined); }}
          >
            {p.label}
          </Button>
        ))}
        <div className="flex items-center gap-1">
          <Popover open={showFromCal} onOpenChange={setShowFromCal}>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant={preset === "custom" && dateFrom ? "default" : "outline"}
                className="h-7 text-xs gap-1"
              >
                <CalendarIcon className="h-3 w-3" />
                {dateFrom ? format(dateFrom, "MMM d") : "From"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={(d) => { setDateFrom(d); setPreset("custom"); setShowFromCal(false); }}
                disabled={(d) => d > new Date() || (dateTo ? d > dateTo : false)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">–</span>
          <Popover open={showToCal} onOpenChange={setShowToCal}>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant={preset === "custom" && dateTo ? "default" : "outline"}
                className="h-7 text-xs gap-1"
              >
                <CalendarIcon className="h-3 w-3" />
                {dateTo ? format(dateTo, "MMM d") : "To"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={(d) => { setDateTo(d); setPreset("custom"); setShowToCal(false); }}
                disabled={(d) => d > new Date() || (dateFrom ? d < dateFrom : false)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
        <span className="text-[10px] text-muted-foreground ml-1">{rangeLabel}</span>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground text-sm">Loading pipeline aging data...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-primary" />
                Lead Pipeline Aging
              </CardTitle>
              <p className="text-xs text-muted-foreground">Click a stage to see individual leads</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {leadAging.map((s) => (
                <StageRow
                  key={s.stage}
                  label={stageShortLabel(s.stage)}
                  avgDays={s.avgDays}
                  count={s.count}
                  pct={totalLeadEntries > 0 ? Math.round((s.count / totalLeadEntries) * 100) : 0}
                  maxDays={maxLeadDays}
                  entities={leadsByStage[s.stage] || []}
                  entityType="lead"
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-primary" />
                Client Pipeline Aging
              </CardTitle>
              <p className="text-xs text-muted-foreground">Click a stage to see individual clients</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {clientAging.map((s) => (
                <StageRow
                  key={s.stage}
                  label={s.stage}
                  avgDays={s.avgDays}
                  count={s.count}
                  pct={totalClientEntries > 0 ? Math.round((s.count / totalClientEntries) * 100) : 0}
                  maxDays={maxClientDays}
                  entities={clientsByStage[s.stage] || []}
                  entityType="client"
                />
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
