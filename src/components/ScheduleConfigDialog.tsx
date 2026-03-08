import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { TIMEZONE_OPTIONS } from '@/lib/timezones';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface ScheduleConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: {
    id: string;
    user_id: string;
    base_timezone: string;
    display_timezones: unknown;
    hour_start: number;
    hour_end: number;
    _displayName: string;
  };
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);

export function ScheduleConfigDialog({ open, onOpenChange, schedule }: ScheduleConfigDialogProps) {
  const queryClient = useQueryClient();
  const [hourStart, setHourStart] = useState(schedule.hour_start);
  const [hourEnd, setHourEnd] = useState(schedule.hour_end);
  const [baseTz, setBaseTz] = useState(schedule.base_timezone);
  const [displayTzs, setDisplayTzs] = useState<string[]>(
    (schedule.display_timezones as string[]) ?? ['America/Los_Angeles', 'America/Chicago', 'America/New_York']
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHourStart(schedule.hour_start);
    setHourEnd(schedule.hour_end);
    setBaseTz(schedule.base_timezone);
    setDisplayTzs((schedule.display_timezones as string[]) ?? ['America/Los_Angeles', 'America/Chicago', 'America/New_York']);
  }, [schedule]);

  const toggleTz = (tz: string) => {
    setDisplayTzs(prev => prev.includes(tz) ? prev.filter(t => t !== tz) : [...prev, tz]);
  };

  const handleSave = async () => {
    if (hourEnd <= hourStart) {
      toast.error('End hour must be after start hour');
      return;
    }
    if (displayTzs.length === 0) {
      toast.error('Select at least one display timezone');
      return;
    }
    setSaving(true);
    const { error } = await (supabase
      .from('staff_schedules' as any)
      .update({
        hour_start: hourStart,
        hour_end: hourEnd,
        base_timezone: baseTz,
        display_timezones: displayTzs,
      })
      .eq('id', schedule.id) as any);
    setSaving(false);
    if (error) {
      toast.error('Failed to save');
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['staff-schedule'] });
    queryClient.invalidateQueries({ queryKey: ['all-staff-schedules'] });
    toast.success(`Updated schedule for ${schedule._displayName}`);
    onOpenChange(false);
  };

  const formatHourLabel = (h: number) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:00 ${ampm}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configure: {schedule._displayName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Start Hour</Label>
              <Select value={String(hourStart)} onValueChange={v => setHourStart(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HOUR_OPTIONS.map(h => (
                    <SelectItem key={h} value={String(h)}>{formatHourLabel(h)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">End Hour</Label>
              <Select value={String(hourEnd)} onValueChange={v => setHourEnd(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HOUR_OPTIONS.map(h => (
                    <SelectItem key={h} value={String(h)}>{formatHourLabel(h)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Base Timezone</Label>
            <Select value={baseTz} onValueChange={setBaseTz}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONE_OPTIONS.map(tz => (
                  <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Display Timezones</Label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-2">
              {TIMEZONE_OPTIONS.map(tz => (
                <label key={tz.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={displayTzs.includes(tz.value)}
                    onCheckedChange={() => toggleTz(tz.value)}
                  />
                  {tz.short}
                </label>
              ))}
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
