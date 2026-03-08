import { useState } from 'react';
import { addWeeks, subWeeks, format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { getWeekDates, toDateString } from '@/lib/timezones';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface CopyWeekDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceWeekDates: Date[];
  scheduleId: string;
  userId: string;
}

export function CopyWeekDialog({ open, onOpenChange, sourceWeekDates, scheduleId, userId }: CopyWeekDialogProps) {
  const [targetDate, setTargetDate] = useState(() => addWeeks(sourceWeekDates[0], 1));
  const [copying, setCopying] = useState(false);
  const queryClient = useQueryClient();

  const targetWeek = getWeekDates(targetDate);
  const sourceStart = toDateString(sourceWeekDates[0]);
  const sourceEnd = toDateString(sourceWeekDates[6]);

  const handleCopy = async () => {
    setCopying(true);
    try {
      // Fetch source blocks
      const { data: sourceBlocks, error: fetchErr } = await (supabase
        .from('schedule_blocks' as any)
        .select('*')
        .eq('schedule_id', scheduleId)
        .gte('block_date', sourceStart)
        .lte('block_date', sourceEnd) as any);
      if (fetchErr) throw fetchErr;
      if (!sourceBlocks || sourceBlocks.length === 0) {
        toast.error('No blocks to copy in the source week');
        setCopying(false);
        return;
      }

      // Map day offsets
      const sourceMonday = sourceWeekDates[0].getTime();
      const targetMonday = targetWeek[0].getTime();
      const dayMs = 86400000;

      const newBlocks = sourceBlocks.map((b: any) => {
        const blockDate = new Date(b.block_date + 'T00:00:00');
        const dayOffset = Math.round((blockDate.getTime() - sourceMonday) / dayMs);
        const newDate = new Date(targetMonday + dayOffset * dayMs);
        return {
          schedule_id: scheduleId,
          user_id: userId,
          client_id: b.client_id,
          block_date: toDateString(newDate),
          day_of_week: b.day_of_week,
          start_hour: b.start_hour,
          end_hour: b.end_hour,
          label: b.label,
        };
      });

      const { error: insertErr } = await (supabase
        .from('schedule_blocks' as any)
        .insert(newBlocks) as any);
      if (insertErr) throw insertErr;

      queryClient.invalidateQueries({ queryKey: ['schedule-blocks'] });
      toast.success(`Copied ${newBlocks.length} blocks to week of ${format(targetWeek[0], 'MMM d')}`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to copy week');
    } finally {
      setCopying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Copy className="h-4 w-4" /> Copy Week</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Source week</p>
            <p className="text-sm font-medium">
              {format(sourceWeekDates[0], 'MMM d')} – {format(sourceWeekDates[6], 'MMM d, yyyy')}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Paste into week</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setTargetDate(d => subWeeks(d, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[160px] text-center">
                {format(targetWeek[0], 'MMM d')} – {format(targetWeek[6], 'MMM d, yyyy')}
              </span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setTargetDate(d => addWeeks(d, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Button onClick={handleCopy} disabled={copying} className="w-full">
            {copying ? 'Copying...' : 'Copy Blocks'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
