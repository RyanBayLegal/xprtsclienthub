import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';
import { useTimeOffRequests } from '@/hooks/useScheduleData';
import { toast } from 'sonner';

export function TimeOffAdmin() {
  const { requests, updateRequestStatus } = useTimeOffRequests({ allUsers: true });

  const pending = requests.filter(r => r.status === 'pending');
  const resolved = requests.filter(r => r.status !== 'pending');

  const handleAction = (id: string, status: 'approved' | 'rejected') => {
    updateRequestStatus.mutate({ id, status }, {
      onSuccess: () => toast.success(`Request ${status}`),
      onError: () => toast.error('Failed to update request'),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-3">Pending Requests</h2>
        {pending.length === 0 ? (
          <Card><CardContent className="py-6 text-center text-muted-foreground text-sm">No pending requests.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {pending.map(req => (
              <Card key={req.id}>
                <CardContent className="flex items-center justify-between py-3 px-4">
                  <div>
                    <p className="text-sm font-medium">
                      {req._displayName} — {format(new Date(req.block_date + 'T00:00'), 'EEE, MMM d')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {req.start_hour}:00 – {req.end_hour}:00
                      {req.reason && ` · ${req.reason}`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="default" className="gap-1 h-7" onClick={() => handleAction(req.id, 'approved')}>
                      <Check className="h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" className="gap-1 h-7" onClick={() => handleAction(req.id, 'rejected')}>
                      <X className="h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {resolved.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Recent Decisions</h2>
          <div className="space-y-2">
            {resolved.slice(0, 20).map(req => (
              <Card key={req.id}>
                <CardContent className="flex items-center justify-between py-3 px-4">
                  <div>
                    <p className="text-sm font-medium">
                      {req._displayName} — {format(new Date(req.block_date + 'T00:00'), 'EEE, MMM d')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {req.start_hour}:00 – {req.end_hour}:00
                      {req.reason && ` · ${req.reason}`}
                    </p>
                  </div>
                  <Badge variant={req.status === 'approved' ? 'default' : 'destructive'}>{req.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
