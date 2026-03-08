import { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Clock, Trash2 } from 'lucide-react';
import { useTimeOffRequests } from '@/hooks/useScheduleData';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function TimeOffRequestForm() {
  const { requests, createRequest, deleteRequest } = useTimeOffRequests();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [startHour, setStartHour] = useState('9');
  const [endHour, setEndHour] = useState('17');
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (!date) { toast.error('Select a date'); return; }
    const sh = parseInt(startHour);
    const eh = parseInt(endHour);
    if (eh <= sh) { toast.error('End hour must be after start hour'); return; }

    createRequest.mutate({
      block_date: format(date, 'yyyy-MM-dd'),
      start_hour: sh,
      end_hour: eh,
      reason: reason || undefined,
    }, {
      onSuccess: () => {
        toast.success('Time-off request submitted');
        setDialogOpen(false);
        setDate(undefined);
        setReason('');
      },
      onError: () => toast.error('Failed to submit request'),
    });
  };

  const statusColor = (status: string) => {
    if (status === 'approved') return 'default' as const;
    if (status === 'rejected') return 'destructive' as const;
    return 'secondary' as const;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Time Off Requests</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Clock className="h-4 w-4" />
              Request Time Off
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Request Time Off</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-sm text-muted-foreground mb-1 block">Start</label>
                  <Select value={startHour} onValueChange={setStartHour}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {HOURS.map(h => <SelectItem key={h} value={String(h)}>{h}:00</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <label className="text-sm text-muted-foreground mb-1 block">End</label>
                  <Select value={endHour} onValueChange={setEndHour}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {HOURS.filter(h => h > 0).map(h => <SelectItem key={h} value={String(h)}>{h}:00</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Reason (optional)</label>
                <Input placeholder="e.g. Doctor's appointment" value={reason} onChange={e => setReason(e.target.value)} />
              </div>
              <Button onClick={handleSubmit} className="w-full" disabled={createRequest.isPending}>
                Submit Request
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No time-off requests yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {requests.map(req => (
            <Card key={req.id}>
              <CardContent className="flex items-center justify-between py-3 px-4">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm font-medium">{format(new Date(req.block_date + 'T00:00'), 'EEE, MMM d')}</p>
                    <p className="text-xs text-muted-foreground">
                      {req.start_hour}:00 – {req.end_hour}:00
                      {req.reason && ` · ${req.reason}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusColor(req.status)}>{req.status}</Badge>
                  {req.status === 'pending' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => { deleteRequest.mutate(req.id); toast.success('Request cancelled'); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
