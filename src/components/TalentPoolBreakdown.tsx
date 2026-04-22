import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Inbox } from "lucide-react";

const PLACED_COLOR = "hsl(160, 60%, 40%)";
const FREE_COLOR = "hsl(220, 70%, 55%)";

export default function TalentPoolBreakdown() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<{ total: number; placed: number; free: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: talent }, { data: placed }] = await Promise.all([
        supabase.from("talent_pool" as any).select("id"),
        supabase.from("placed_vas" as any).select("talent_id"),
      ]);
      if (cancelled) return;
      const total = (talent as any[] | null)?.length ?? 0;
      const placedIds = new Set(((placed as any[] | null) ?? []).map((p) => p.talent_id));
      const placedCount = placedIds.size;
      setCounts({ total, placed: placedCount, free: Math.max(total - placedCount, 0) });
    })();
    return () => { cancelled = true; };
  }, []);

  const data = useMemo(() => {
    if (!counts) return [];
    const t = counts.total;
    return [
      { name: "Placed", value: counts.placed, pct: t > 0 ? (counts.placed / t) * 100 : 0, color: PLACED_COLOR },
      { name: "Free", value: counts.free, pct: t > 0 ? (counts.free / t) * 100 : 0, color: FREE_COLOR },
    ];
  }, [counts]);

  if (!counts) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base font-semibold">Talent Pool</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 items-center">
            <Skeleton className="h-[220px] w-[220px] rounded-full mx-auto" />
            <div className="space-y-2">
              <Skeleton className="h-8" /><Skeleton className="h-8" /><Skeleton className="h-8" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isEmpty = counts.total === 0;
  const visibleData = data.filter((d) => d.value > 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold">Talent Pool</CardTitle>
        <button
          onClick={() => navigate("/talent-pool")}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          View all
        </button>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Inbox className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No talent yet</p>
            <p className="text-xs text-muted-foreground mt-1">Add people to your talent pool to see this breakdown.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 items-center">
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={visibleData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={2}
                  >
                    {visibleData.map((d) => (
                      <Cell
                        key={d.name}
                        fill={d.color}
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const p: any = payload[0];
                      const item = data.find((d) => d.name === p.name);
                      if (!item) return null;
                      return (
                        <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                          <div className="flex items-center gap-2 font-medium">
                            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                            {item.name}
                          </div>
                          <div className="mt-1 text-muted-foreground">
                            <div>Count: <span className="font-medium text-foreground tabular-nums">{item.value}</span></div>
                            <div>Share: <span className="font-medium text-foreground tabular-nums">{item.pct.toFixed(1)}%</span></div>
                          </div>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-9">Status</TableHead>
                    <TableHead className="h-9 text-right">Count</TableHead>
                    <TableHead className="h-9 text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((d) => (
                    <TableRow key={d.name}>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                          <span className="text-sm">{d.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-right text-sm tabular-nums">{d.value}</TableCell>
                      <TableCell className="py-2 text-right text-sm tabular-nums font-medium">{d.pct.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="py-2 font-semibold">Total</TableCell>
                    <TableCell className="py-2 text-right font-semibold tabular-nums">{counts.total}</TableCell>
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