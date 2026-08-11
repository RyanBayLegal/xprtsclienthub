import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Entry {
  id: string;
  actor_name: string | null;
  actor_email: string | null;
  target_email: string | null;
  action: string;
  details: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  invite_email_sent: "Invite sent",
  invite_email_failed: "Invite failed",
  invite_resend_sent: "Invite resent",
  invite_resend_failed: "Resend failed",
};

export default function UserInviteHistoryDialog({
  userId,
  userEmail,
  userName,
  open,
  onOpenChange,
}: {
  userId: string | null;
  userEmail?: string | null;
  userName?: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || (!userId && !userEmail)) return;
    (async () => {
      setLoading(true);
      const filters: string[] = [];
      if (userId) filters.push(`target_user_id.eq.${userId}`);
      if (userEmail) filters.push(`target_email.eq.${userEmail}`);
      const { data } = await (supabase.from as any)("user_admin_audit_logs")
        .select("*")
        .or(filters.join(","))
        .like("action", "invite_%")
        .order("created_at", { ascending: false })
        .limit(100);
      setEntries((data as Entry[]) || []);
      setLoading(false);
    })();
  }, [open, userId, userEmail]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite history</DialogTitle>
          <DialogDescription>
            Every invite sent or resent to {userName || userEmail || "this user"}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No invite attempts recorded.</p>
          ) : (
            entries.map((e) => {
              const failed = e.action.endsWith("_failed");
              return (
                <div key={e.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={failed ? "destructive" : "secondary"} className="text-xs">
                      {ACTION_LABELS[e.action] || e.action}
                    </Badge>
                    {e.target_email && (
                      <span className="text-xs text-muted-foreground">{e.target_email}</span>
                    )}
                  </div>
                  {e.details && <p className="mt-1 text-xs">{e.details}</p>}
                  <div className="mt-1 text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString()} · by {e.actor_name || e.actor_email || "—"}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
