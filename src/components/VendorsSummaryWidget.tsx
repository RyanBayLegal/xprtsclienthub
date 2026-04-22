import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Inbox } from "lucide-react";

interface VendorRow {
  stage: string;
}

const COLORS = [
  "hsl(220, 70%, 55%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 60%, 55%)",
  "hsl(160, 60%, 40%)",
  "hsl(350, 60%, 50%)",
  "hsl(190, 70%, 45%)",
];

export default function VendorsSummaryWidget() {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<VendorRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("vendors").select("stage");
      if (!cancelled) setVendors(data || []);
    })();
    return () => { cancelled = true; };
  }, []);

  const data = useMemo(() => {
    if (!vendors) return null;
    const counts: Record<string, number> = {};
    vendors.forEach((v) => {
      const k = v.stage || "Unknown";
      counts[k] = (counts[k] || 0) + 1;
    });
    const total = vendors.length;
    const rows = Object.entries(counts)
      .map(([name, value]) => ({ name, value, pct: total > 0 ? (value / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
    return { rows, total };
  }, [vendors]);

  if (!data) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base font-semibold">Vendors Summary</CardTitle></CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-32 mb-4" />
          <div className="space-y-2">
            <Skeleton className="h-8" /><Skeleton className="h-8" /><Skeleton className="h-8" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold">Vendors Summary</CardTitle>
        <button
          onClick={() => navigate("/vendors")}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          View all
        </button>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-4">
          <span className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-primary" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Vendors</p>
            <p className="text-2xl font-bold">{data.total}</p>
          </div>
        </div>

        {data.total === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-2">
              <Inbox className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No vendors yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.rows.map((r, i) => (
              <div key={r.name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="truncate font-medium">{r.name}</span>
                  </div>
                  <span className="tabular-nums text-muted-foreground ml-2">
                    {r.value} · {r.pct.toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${r.pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}