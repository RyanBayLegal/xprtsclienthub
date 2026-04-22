import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import LeadSourcesBreakdown from "@/components/LeadSourcesBreakdown";
import TasksSummaryWidget from "@/components/TasksSummaryWidget";
import VendorsSummaryWidget from "@/components/VendorsSummaryWidget";
import TalentPoolBreakdown from "@/components/TalentPoolBreakdown";

const PIPELINE_STAGES = [
  "Prospecting Stage",
  "Discovery Stage",
  "Solution Mapping Stage",
  "Proposal/Contract Stage",
  "Onboarding/Kickoff Stage",
];

const STAGE_COLORS: Record<string, string> = {
  "Prospecting Stage": "hsl(220, 70%, 55%)",
  "Discovery Stage": "hsl(38, 92%, 50%)",
  "Solution Mapping Stage": "hsl(280, 60%, 55%)",
  "Proposal/Contract Stage": "hsl(160, 60%, 40%)",
  "Onboarding/Kickoff Stage": "hsl(350, 60%, 50%)",
};

interface Lead {
  id: string;
  stage: string;
  created_at: string;
}

export default function Analytics() {
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("leads").select("id, stage, created_at");
      if (data) setLeads(data);
    };
    fetch();
  }, []);

  const total = leads.length;

  // Stage counts in pipeline order
  const stageCounts = PIPELINE_STAGES.map((stage) => ({
    name: stage.replace(" Stage", ""),
    fullName: stage,
    count: leads.filter((l) => l.stage === stage).length,
  }));

  // Conversion rates between consecutive stages
  const conversions = stageCounts.slice(0, -1).map((sc, i) => {
    const next = stageCounts[i + 1];
    const rate = sc.count > 0 ? ((next.count / sc.count) * 100).toFixed(0) : "0";
    return { from: sc.name, to: next.name, rate: `${rate}%`, fromCount: sc.count, toCount: next.count };
  });

  // Leads over time (by month)
  const monthCounts: Record<string, number> = {};
  leads.forEach((l) => {
    const month = l.created_at.substring(0, 7);
    monthCounts[month] = (monthCounts[month] || 0) + 1;
  });
  const barData = Object.entries(monthCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({
      month: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      count,
    }));

  // Key metrics
  const proposalCount = leads.filter((l) => l.stage === "Proposal/Contract Stage").length;
  const onboardingCount = leads.filter((l) => l.stage === "Onboarding/Kickoff Stage").length;
  const proposalRate = total > 0 ? ((proposalCount / total) * 100).toFixed(1) : "0";
  const onboardingRate = total > 0 ? ((onboardingCount / total) * 100).toFixed(1) : "0";

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">Pipeline Analytics</h1>

      {/* Key metrics */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Proposal Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-accent">{proposalRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">{proposalCount} of {total} reached proposal</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Onboarding Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{onboardingRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">{onboardingCount} of {total} onboarding</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Funnel chart */}
        <Card>
          <CardHeader>
            <CardTitle>Pipeline Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            {total === 0 ? (
              <p className="text-center text-muted-foreground py-12">No data yet. Add some leads to see analytics.</p>
            ) : (
              <div className="space-y-2">
                {stageCounts.map((sc, i) => {
                  const maxCount = Math.max(...stageCounts.map((s) => s.count), 1);
                  const widthPct = Math.max((sc.count / maxCount) * 100, 8);
                  return (
                    <div key={sc.fullName}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium">{sc.name}</span>
                        <span className="text-muted-foreground">{sc.count}</span>
                      </div>
                      <div
                        className="h-8 rounded-md flex items-center px-3 text-xs font-medium text-white transition-all"
                        style={{
                          width: `${widthPct}%`,
                          backgroundColor: STAGE_COLORS[sc.fullName],
                        }}
                      >
                        {sc.count > 0 ? sc.count : ""}
                      </div>
                      {i < conversions.length && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 ml-2">
                          → {conversions[i].to}: {conversions[i].rate} conversion
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
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

      <div className="mt-6">
        <LeadSourcesBreakdown />
      </div>

      <div className="mt-6">
        <TasksSummaryWidget />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <VendorsSummaryWidget />
        <TalentPoolBreakdown />
      </div>
    </div>
  );
}
