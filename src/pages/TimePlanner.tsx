import { useEffect, useState } from 'react';
import { addWeeks, subWeeks, format } from 'date-fns';
import { ScheduleGrid } from '@/components/ScheduleGrid';
import { useSchedule, useScheduleClients, useBlocks, useTimeOffRequests, type TimeOffRequest } from '@/hooks/useScheduleData';
import { useAuth } from '@/lib/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { StaffMultiSelect } from '@/components/StaffMultiSelect';
import { getWeekDates, toDateString } from '@/lib/timezones';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { TimeOffRequestForm } from '@/components/TimeOffRequestForm';
import { TimeOffAdmin } from '@/components/TimeOffAdmin';
import { ScheduleClientManager } from '@/components/ScheduleClientManager';

interface ScheduleWithName {
  id: string;
  user_id: string;
  name: string;
  base_timezone: string;
  display_timezones: unknown;
  hour_start: number;
  hour_end: number;
  _displayName: string;
}

function StaffScheduleGrid({ schedule, weekStart, weekEnd, weekDates, clients, isAdmin, approvedTimeOff }: {
  schedule: ScheduleWithName;
  weekStart: string;
  weekEnd: string;
  weekDates: Date[];
  clients: { id: string; name: string; color: string; timezone: string }[];
  isAdmin: boolean;
  approvedTimeOff: TimeOffRequest[];
}) {
  const { blocks, addBlock, deleteBlock } = useBlocks(schedule.id, weekStart, weekEnd);
  const displayTimezones = (schedule.display_timezones as string[]) ?? ['America/Los_Angeles', 'America/Chicago', 'America/New_York'];

  return (
    <ScheduleGrid
      name={schedule._displayName}
      baseTimezone={schedule.base_timezone}
      displayTimezones={displayTimezones}
      hourStart={schedule.hour_start}
      hourEnd={schedule.hour_end}
      blocks={blocks}
      clients={clients}
      weekDates={weekDates}
      onAddBlock={(block) => {
        addBlock.mutate({ ...block, schedule_id: schedule.id, _owner_id: schedule.user_id });
      }}
      onDeleteBlock={(id) => deleteBlock.mutate(id)}
      readOnly={!isAdmin}
      approvedTimeOff={approvedTimeOff.filter(r => r.user_id === schedule.user_id)}
    />
  );
}

const TimePlanner = () => {
  const { user, role } = useAuth();
  const isAdmin = role === 'team_admin';
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);

  const { data: allSchedules = [], isLoading: allSchedsLoading } = useQuery({
    queryKey: ['all-staff-schedules', isAdmin],
    queryFn: async () => {
      const { data: scheds, error } = await (supabase
        .from('staff_schedules' as any)
        .select('*')
        .order('created_at') as any);
      if (error) throw error;
      const { data: profiles } = await supabase.from('profiles').select('*');
      return (scheds ?? []).map((s: any) => ({
        ...s,
        _displayName: profiles?.find((p: any) => p.user_id === s.user_id)?.full_name ?? s.name,
      }));
    },
    enabled: !!user && isAdmin,
  });

  const { schedule: ownSchedule, isLoading: ownSchedLoading, createSchedule } = useSchedule();
  const { clients } = useScheduleClients();

  const [currentDate, setCurrentDate] = useState(new Date());
  const weekDates = getWeekDates(currentDate);
  const weekStart = toDateString(weekDates[0]);
  const weekEnd = toDateString(weekDates[6]);

  const { requests: timeOffRequests } = useTimeOffRequests({
    allUsers: isAdmin,
    weekStart,
    weekEnd,
  });
  const approvedTimeOff = timeOffRequests.filter(r => r.status === 'approved');

  useEffect(() => {
    if (user && !ownSchedLoading && !ownSchedule && !isAdmin) {
      createSchedule.mutate();
    }
  }, [user, ownSchedLoading, ownSchedule, isAdmin]);

  useEffect(() => {
    if (isAdmin && allSchedules.length > 0 && selectedStaffIds.length === 0) {
      setSelectedStaffIds(allSchedules.map((s: any) => s.user_id));
    }
  }, [isAdmin, allSchedules, selectedStaffIds.length]);

  const isLoading = isAdmin ? allSchedsLoading : ownSchedLoading;

  const toggleStaff = (userId: string) => {
    setSelectedStaffIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const selectAll = () => setSelectedStaffIds(allSchedules.map((s: any) => s.user_id));
  const selectNone = () => setSelectedStaffIds([]);

  const goToday = () => setCurrentDate(new Date());
  const goPrev = () => setCurrentDate(d => subWeeks(d, 1));
  const goNext = () => setCurrentDate(d => addWeeks(d, 1));

  const visibleSchedules = isAdmin
    ? allSchedules.filter((s: any) => selectedStaffIds.includes(s.user_id))
    : ownSchedule ? [{ ...ownSchedule, _displayName: ownSchedule.name }] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Time Planner</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? 'Drag across cells to create blocks (30-min slots).' : 'Your schedule (read-only). Contact your admin for changes.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[180px] text-center">
            {format(weekDates[0], 'MMM d')} – {format(weekDates[6], 'MMM d, yyyy')}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isAdmin && allSchedules.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Staff:</span>
          <StaffMultiSelect
            staff={allSchedules.map((s: any) => ({ user_id: s.user_id, displayName: s._displayName }))}
            selectedIds={selectedStaffIds}
            onToggle={toggleStaff}
            onSelectAll={selectAll}
            onSelectNone={selectNone}
          />
        </div>
      )}

      {isAdmin && <ScheduleClientManager />}

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : visibleSchedules.length > 0 ? (
        <div className="space-y-8">
          {visibleSchedules.map((schedule: any) => (
            <StaffScheduleGrid
              key={schedule.id}
              schedule={schedule as ScheduleWithName}
              weekStart={weekStart}
              weekEnd={weekEnd}
              weekDates={weekDates}
              clients={clients}
              isAdmin={isAdmin}
              approvedTimeOff={approvedTimeOff}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          {isAdmin ? 'No staff schedules found. Staff members will auto-create their schedule on first visit.' : 'Setting up your schedule...'}
        </div>
      )}

      <div className="mt-8">
        {isAdmin ? <TimeOffAdmin /> : <TimeOffRequestForm />}
      </div>
    </div>
  );
};

export default TimePlanner;
