import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Entry {
  id: string;
  actor_name: string | null;
  actor_email: string | null;
  old_value: string | null;
  new_value: string | null;
  details: string | null;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  team_admin: "Team Admin",
  staff_member: "Staff Member",
  client: "Client",
};

export default function UserRoleHistoryDialog({
  userId,
  userName,
  open,
  onOpenChange,
}: {
  userId: string | null;
  userName?: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase.from as any)("user_admin_audit_logs")
        .select("*")
        .eq("target_user_id", userId)
        .eq("action", "role_change")
        .order("created_at", { ascending: false })
        .limit(50);
      setEntries((data as Entry[]) || []);
      setLoading(false);
    })();
  }, [open, userId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Role change history</DialogTitle>
          <DialogDescription>Recent role changes for {userName || "this user"}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No role changes recorded.</p>
          ) : (
            entries.map((e) => (
              <div key={e.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  {e.old_value && (
                    <Badge variant="outline" className="text-xs line-through">
                      {ROLE_LABELS[e.old_value] || e.old_value}
                    </Badge>
                  )}
                  {e.old_value && e.new_value && <span className="text-xs text-muted-foreground">→</span>}
                  {e.new_value && (
                    <Badge variant="secondary" className="text-xs">
                      {ROLE_LABELS[e.new_value] || e.new_value}
                    </Badge>
                  )}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleString()} · by {e.actor_name || e.actor_email || "—"}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
