import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

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

export default function LeadSourcesBreakdown() {
  const [data, setData] = useState<{ name: string; value: number; pct: number }[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      const { data: leads } = await supabase.from("leads").select("source");
      if (!leads) return;
      const counts: Record<string, number> = {};
      leads.forEach((l) => {
        const key = (l.source && l.source.trim()) || "Unknown";
        counts[key] = (counts[key] || 0) + 1;
      });
      const t = leads.length;
      setTotal(t);
      const arr = Object.entries(counts)
        .map(([name, value]) => ({ name, value, pct: t > 0 ? (value / t) * 100 : 0 }))
        .sort((a, b) => b.value - a.value);
      setData(arr);
    };
    fetch();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Leads by Source</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">No leads yet.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 items-center">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={45}
                    paddingAngle={2}
                  >
                    {data.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value} (${((value / total) * 100).toFixed(1)}%)`,
                      name,
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
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
                  {data.map((d, i) => (
                    <TableRow key={d.name}>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: COLORS[i % COLORS.length] }}
                          />
                          <span className="text-sm truncate">{d.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-right text-sm tabular-nums">{d.value}</TableCell>
                      <TableCell className="py-2 text-right text-sm tabular-nums font-medium">
                        {d.pct.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
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
