import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, TrendingUp } from "lucide-react";
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

export default function PipelineAgingWidget() {
  const [leadAging, setLeadAging] = useState<StageAging[]>([]);
  const [clientAging, setClientAging] = useState<StageAging[]>([]);
  const [leadsByStage, setLeadsByStage] = useState<Record<string, EntityInStage[]>>({});
  const [clientsByStage, setClientsByStage] = useState<Record<string, EntityInStage[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAging = async () => {
      setLoading(true);

      const { data: leads } = await supabase
        .from("leads")
        .select("id, name, stage, stage_changed_at, created_at");

      const { data: leadLogs } = await (supabase.from as any)("audit_logs")
        .select("entity_id, old_value, new_value, description, created_at")
        .eq("entity_type", "lead")
        .eq("field_name", "Stage")
        .order("created_at", { ascending: false });

      const leadStageMap: Record<string, { totalDays: number; count: number }> = {};
      const leadEntities: Record<string, EntityInStage[]> = {};
      LEAD_STAGES.forEach((s) => {
        leadStageMap[s] = { totalDays: 0, count: 0 };
        leadEntities[s] = [];
      });

      (leads || []).forEach((l) => {
        if (leadStageMap[l.stage]) {
          const changedAt = l.stage_changed_at || l.created_at;
          const days = Math.max(0, Math.floor((Date.now() - new Date(changedAt).getTime()) / 86400000));
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

      // Sort entities by days descending
      Object.values(leadEntities).forEach((arr) => arr.sort((a, b) => b.daysInStage - a.daysInStage));
      setLeadsByStage(leadEntities);
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
        .select("id, name, stage, stage_changed_at, created_at");

      const { data: clientLogs } = await (supabase.from as any)("audit_logs")
        .select("entity_id, old_value, new_value, description, created_at")
        .eq("entity_type", "client_profile")
        .eq("field_name", "Stage")
        .order("created_at", { ascending: false });

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
          const days = Math.max(0, Math.floor((Date.now() - new Date(changedAt).getTime()) / 86400000));
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
  );
}
