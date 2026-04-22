import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Inbox } from "lucide-react";

const COLORS = [
  "hsl(220, 70%, 55%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 60%, 55%)",
  "hsl(160, 60%, 40%)",
  "hsl(350, 60%, 50%)",
  "hsl(190, 70%, 45%)",
  "hsl(45, 80%, 50%)",
  "hsl(310, 55%, 50%)",
  "hsl(120, 50%, 45%)",
  "hsl(15, 75%, 55%)",
];

interface LeadRow {
  source: string | null;
  stage: string | null;
}

const ALL = "__all__";

export default function LeadSourcesBreakdown() {
  const [leads, setLeads] = useState<LeadRow[] | null>(null);
  const [stageFilter, setStageFilter] = useState<string>(ALL);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("leads").select("source, stage");
      if (!cancelled) setLeads(data || []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stages = useMemo(() => {
    if (!leads) return [];
    const s = new Set<string>();
    leads.forEach((l) => l.stage && s.add(l.stage));
    return Array.from(s).sort();
  }, [leads]);

  const filtered = useMemo(() => {
    if (!leads) return [];
    return stageFilter === ALL ? leads : leads.filter((l) => l.stage === stageFilter);
  }, [leads, stageFilter]);

  const allData = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((l) => {
      const key = (l.source && l.source.trim()) || "Unknown";
      counts[key] = (counts[key] || 0) + 1;
    });
    const t = filtered.length;
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value, pct: t > 0 ? (value / t) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const visibleData = useMemo(
    () => allData.filter((d) => !hidden.has(d.name)),
    [allData, hidden],
  );
  const visibleTotal = visibleData.reduce((s, d) => s + d.value, 0);
  const total = filtered.length;

  const colorFor = (name: string) => {
    const idx = allData.findIndex((d) => d.name === name);
    return COLORS[(idx >= 0 ? idx : 0) % COLORS.length];
  };

  const toggle = (name: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  const isLoading = leads === null;
  const isEmpty = !isLoading && total === 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base font-semibold">Leads by Source</CardTitle>
        <Select value={stageFilter} onValueChange={setStageFilter} disabled={isLoading || stages.length === 0}>
          <SelectTrigger className="h-8 w-[200px] text-xs">
            <SelectValue placeholder="All stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All stages</SelectItem>
            {stages.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 items-center">
            <div className="flex justify-center">
              <Skeleton className="h-[220px] w-[220px] rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-2/3" />
            </div>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Inbox className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No leads to show</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stageFilter === ALL
                ? "Add leads with a source to see the breakdown."
                : "No leads match this stage. Try a different filter."}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 items-center">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={visibleData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={95}
                    innerRadius={50}
                    paddingAngle={2}
                    onMouseEnter={(_, i) => setActiveIdx(i)}
                    onMouseLeave={() => setActiveIdx(null)}
                  >
                    {visibleData.map((d, i) => (
                      <Cell
                        key={d.name}
                        fill={colorFor(d.name)}
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                        opacity={activeIdx === null || activeIdx === i ? 1 : 0.45}
                        style={{ transition: "opacity 150ms" }}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const p: any = payload[0];
                      const name = p.name as string;
                      const value = p.value as number;
                      const pct = visibleTotal > 0 ? (value / visibleTotal) * 100 : 0;
                      const pctOfAll = total > 0 ? (value / total) * 100 : 0;
                      return (
                        <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                          <div className="flex items-center gap-2 font-medium">
                            <span
                              className="h-2.5 w-2.5 rounded-sm"
                              style={{ backgroundColor: colorFor(name) }}
                            />
                            {name}
                          </div>
                          <div className="mt-1 text-muted-foreground">
                            <div>Count: <span className="font-medium text-foreground tabular-nums">{value}</span></div>
                            <div>Share: <span className="font-medium text-foreground tabular-nums">{pct.toFixed(1)}%</span></div>
                            {hidden.size > 0 && (
                              <div>Of all: <span className="font-medium text-foreground tabular-nums">{pctOfAll.toFixed(1)}%</span></div>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    onClick={(e: any) => e?.value && toggle(e.value)}
                    formatter={(value: string) => (
                      <span
                        className={`cursor-pointer select-none ${hidden.has(value) ? "text-muted-foreground line-through" : "text-foreground"}`}
                      >
                        {value}
                      </span>
                    )}
                    payload={allData.map((d) => ({
                      value: d.name,
                      type: "square",
                      color: colorFor(d.name),
                      id: d.name,
                    }))}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="max-h-[260px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-9">Source</TableHead>
                    <TableHead className="h-9 text-right">Count</TableHead>
                    <TableHead className="h-9 text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allData.map((d) => {
                    const isHidden = hidden.has(d.name);
                    return (
                      <TableRow
                        key={d.name}
                        onClick={() => toggle(d.name)}
                        className={`cursor-pointer ${isHidden ? "opacity-40" : ""}`}
                      >
                        <TableCell className="py-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-sm shrink-0"
                              style={{ backgroundColor: colorFor(d.name) }}
                            />
                            <span className={`text-sm truncate ${isHidden ? "line-through" : ""}`}>{d.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 text-right text-sm tabular-nums">{d.value}</TableCell>
                        <TableCell className="py-2 text-right text-sm tabular-nums font-medium">
                          {d.pct.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow>
                    <TableCell className="py-2 font-semibold">Total</TableCell>
                    <TableCell className="py-2 text-right font-semibold tabular-nums">{total}</TableCell>
                    <TableCell className="py-2 text-right font-semibold tabular-nums">100%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
