import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Clock, TrendingUp } from "lucide-react";

interface StageAging {
  stage: string;
  avgDays: number;
  count: number;
}

const LEAD_STAGES = [
  "Prospecting Stage",
  "Discovery Stage",
  "Solution Mapping Stage",
  "Proposal/Contract Stage",
  "Onboarding/Kickoff Stage",
];

const CLIENT_STAGES = [
  "Prospect",
  "Active",
  "On Hold",
  "Offboarding",
  "Completed",
];

const stageShortLabel = (s: string) => s.replace(" Stage", "");

export default function PipelineAgingWidget() {
  const [leadAging, setLeadAging] = useState<StageAging[]>([]);
  const [clientAging, setClientAging] = useState<StageAging[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAging = async () => {
      setLoading(true);

      // Get current leads with stage_changed_at to compute current stage duration
      const { data: leads } = await supabase
        .from("leads")
        .select("id, stage, stage_changed_at, created_at");

      // Get historical stage transitions from audit_logs
      const { data: leadLogs } = await (supabase.from as any)("audit_logs")
        .select("entity_id, old_value, new_value, description, created_at")
        .eq("entity_type", "lead")
        .eq("field_name", "Stage")
        .order("created_at", { ascending: false });

      // Compute lead stage aging
      const leadStageMap: Record<string, { totalDays: number; count: number }> = {};
      LEAD_STAGES.forEach((s) => (leadStageMap[s] = { totalDays: 0, count: 0 }));

      // From current leads: days in current stage
      (leads || []).forEach((l) => {
        if (leadStageMap[l.stage]) {
          const changedAt = l.stage_changed_at || l.created_at;
          const days = Math.max(0, Math.floor((Date.now() - new Date(changedAt).getTime()) / 86400000));
          leadStageMap[l.stage].totalDays += days;
          leadStageMap[l.stage].count += 1;
        }
      });

      // From audit logs: extract historical durations
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

      setLeadAging(
        LEAD_STAGES.map((s) => ({
          stage: s,
          avgDays: leadStageMap[s].count > 0 ? Math.round(leadStageMap[s].totalDays / leadStageMap[s].count) : 0,
          count: leadStageMap[s].count,
        }))
      );

      // Client profiles
      const { data: clients } = await supabase
        .from("client_profiles")
        .select("id, stage, stage_changed_at, created_at");

      const { data: clientLogs } = await (supabase.from as any)("audit_logs")
        .select("entity_id, old_value, new_value, description, created_at")
        .eq("entity_type", "client_profile")
        .eq("field_name", "Stage")
        .order("created_at", { ascending: false });

      const clientStageMap: Record<string, { totalDays: number; count: number }> = {};
      CLIENT_STAGES.forEach((s) => (clientStageMap[s] = { totalDays: 0, count: 0 }));

      (clients || []).forEach((c) => {
        const stage = c.stage || "Prospect";
        if (clientStageMap[stage]) {
          const changedAt = c.stage_changed_at || c.created_at;
          const days = Math.max(0, Math.floor((Date.now() - new Date(changedAt).getTime()) / 86400000));
          clientStageMap[stage].totalDays += days;
          clientStageMap[stage].count += 1;
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
  }, []);

  const maxLeadDays = Math.max(...leadAging.map((s) => s.avgDays), 1);
  const maxClientDays = Math.max(...clientAging.map((s) => s.avgDays), 1);
  const totalLeadEntries = leadAging.reduce((sum, s) => sum + s.count, 0);
  const totalClientEntries = clientAging.reduce((sum, s) => sum + s.count, 0);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground text-sm">Loading pipeline aging data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Lead Pipeline Aging */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-primary" />
            Lead Pipeline Aging
          </CardTitle>
          <p className="text-xs text-muted-foreground">Average days spent in each stage</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {leadAging.map((s) => {
            const pct = totalLeadEntries > 0 ? Math.round((s.count / totalLeadEntries) * 100) : 0;
            return (
              <div key={s.stage}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{stageShortLabel(s.stage)}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{pct}%</span>
                    <span className="text-sm font-bold">{s.avgDays}d</span>
                  </div>
                </div>
                <Progress value={maxLeadDays > 0 ? (s.avgDays / maxLeadDays) * 100 : 0} className="h-2" />
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.count} lead{s.count !== 1 ? "s" : ""} recorded</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Client Pipeline Aging */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Client Pipeline Aging
          </CardTitle>
          <p className="text-xs text-muted-foreground">Average days spent in each stage</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {clientAging.map((s) => {
            const pct = totalClientEntries > 0 ? Math.round((s.count / totalClientEntries) * 100) : 0;
            return (
              <div key={s.stage}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{s.stage}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{pct}%</span>
                    <span className="text-sm font-bold">{s.avgDays}d</span>
                  </div>
                </div>
                <Progress value={maxClientDays > 0 ? (s.avgDays / maxClientDays) * 100 : 0} className="h-2" />
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.count} client{s.count !== 1 ? "s" : ""} recorded</p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
