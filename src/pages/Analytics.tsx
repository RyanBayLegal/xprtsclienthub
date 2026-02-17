import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const STAGE_COLORS: Record<string, string> = {
  New: "hsl(220, 70%, 55%)",
  Contacted: "hsl(38, 92%, 50%)",
  "In Progress": "hsl(280, 60%, 55%)",
  Booked: "hsl(160, 60%, 40%)",
  Proposal: "hsl(200, 70%, 50%)",
  Signed: "hsl(140, 70%, 40%)",
  Lost: "hsl(0, 60%, 50%)",
};

interface Lead {
  id: string;
  stage: string;
  created_at: string;
  booked: boolean | null;
}

export default function Analytics() {
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("leads").select("id, stage, created_at, booked");
      if (data) setLeads(data);
    };
    fetch();
  }, []);

  // Stage distribution for pie chart
  const stageCounts: Record<string, number> = {};
  leads.forEach((l) => {
    stageCounts[l.stage] = (stageCounts[l.stage] || 0) + 1;
  });
  const pieData = Object.entries(stageCounts).map(([name, value]) => ({ name, value }));

  // Conversion rates
  const total = leads.length;
  const booked = leads.filter((l) => l.booked).length;
  const signed = leads.filter((l) => l.stage === "Signed").length;
  const lost = leads.filter((l) => l.stage === "Lost").length;
  const bookingRate = total > 0 ? ((booked / total) * 100).toFixed(1) : "0";
  const closeRate = total > 0 ? ((signed / total) * 100).toFixed(1) : "0";
  const lostRate = total > 0 ? ((lost / total) * 100).toFixed(1) : "0";

  // Leads over time (by month)
  const monthCounts: Record<string, number> = {};
  leads.forEach((l) => {
    const month = l.created_at.substring(0, 7); // YYYY-MM
    monthCounts[month] = (monthCounts[month] || 0) + 1;
  });
  const barData = Object.entries(monthCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({
      month: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      count,
    }));

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">Pipeline Analytics</h1>

      {/* Conversion rate cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Booking Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{bookingRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">{booked} of {total} leads booked</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Close Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-accent">{closeRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">{signed} of {total} leads signed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lost Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{lostRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">{lost} of {total} leads lost</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Stage distribution pie */}
        <Card>
          <CardHeader>
            <CardTitle>Leads by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">No data yet. Add some leads to see analytics.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={STAGE_COLORS[entry.name] || "hsl(220, 10%, 60%)"} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Leads over time bar */}
        <Card>
          <CardHeader>
            <CardTitle>Leads Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 88%)" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(220, 70%, 45%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
