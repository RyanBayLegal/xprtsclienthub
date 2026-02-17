import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, Clock, Star } from "lucide-react";

interface StageCount {
  stage: string;
  count: number;
}

const stageIcons: Record<string, typeof Users> = {
  New: Users,
  "In Progress": Clock,
  Booked: UserCheck,
  Signed: Star,
};

export default function Dashboard() {
  const [stageCounts, setStageCounts] = useState<StageCount[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);

  useEffect(() => {
    const fetchCounts = async () => {
      const { data } = await supabase.from("leads").select("stage");
      if (data) {
        setTotalLeads(data.length);
        const counts: Record<string, number> = {};
        data.forEach((l) => {
          counts[l.stage] = (counts[l.stage] || 0) + 1;
        });
        setStageCounts(Object.entries(counts).map(([stage, count]) => ({ stage, count })));
      }
    };
    fetchCounts();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalLeads}</div>
          </CardContent>
        </Card>
        {stageCounts.map((sc) => {
          const Icon = stageIcons[sc.stage] || Users;
          return (
            <Card key={sc.stage}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{sc.stage}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{sc.count}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
