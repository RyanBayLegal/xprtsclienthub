import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { GitBranch } from "lucide-react";

interface StageLog {
  id: string;
  user_name: string | null;
  old_value: string | null;
  new_value: string | null;
  description: string | null;
  created_at: string;
}

interface StageHistoryTimelineProps {
  entityType: "lead" | "client_profile";
  entityId: string;
}

export default function StageHistoryTimeline({ entityType, entityId }: StageHistoryTimelineProps) {
  const [logs, setLogs] = useState<StageLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await (supabase.from as any)("audit_logs")
        .select("id, user_name, old_value, new_value, description, created_at")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .eq("field_name", "Stage")
        .order("created_at", { ascending: false });
      setLogs((data || []) as StageLog[]);
      setLoading(false);
    };
    fetch();
  }, [entityType, entityId]);

  if (loading) {
    return <p className="text-center text-muted-foreground py-8">Loading stage history...</p>;
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="h-4 w-4" /> Stage History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">No stage transitions recorded yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="h-4 w-4" /> Stage History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative pl-6">
          {/* vertical line */}
          <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-border" />

          <div className="space-y-4">
            {logs.map((log, i) => {
              // Extract duration from description like "(was in X for N days)"
              const durationMatch = log.description?.match(/was in .+ for (\d+ days?)/i);
              const duration = durationMatch ? durationMatch[1] : null;

              return (
                <div key={log.id} className="relative flex items-start gap-3">
                  {/* dot */}
                  <div className={`absolute -left-6 top-1.5 h-3 w-3 rounded-full border-2 ${i === 0 ? "bg-primary border-primary" : "bg-background border-muted-foreground/40"}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {log.old_value && (
                        <Badge variant="outline" className="text-[10px] bg-destructive/5 border-destructive/20 text-destructive">
                          {log.old_value}
                        </Badge>
                      )}
                      <span className="text-muted-foreground text-xs">→</span>
                      {log.new_value && (
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 border-emerald-200 text-emerald-600">
                          {log.new_value}
                        </Badge>
                      )}
                      {duration && (
                        <span className="text-[10px] text-muted-foreground ml-1">
                          (in previous stage for {duration})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      by <span className="font-medium">{log.user_name || "System"}</span>
                      {" · "}
                      {format(new Date(log.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
