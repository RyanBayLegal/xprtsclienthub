import { useEffect, useState } from 'react';
import { addWeeks, subWeeks, format } from 'date-fns';
import { ScheduleGrid } from '@/components/ScheduleGrid';
import { useSchedule, useScheduleClients, useBlocks, useTimeOffRequests, type TimeOffRequest } from '@/hooks/useScheduleData';
import { useAuth } from '@/lib/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Copy, Settings2, Trash2, UserPlus } from 'lucide-react';
import { StaffMultiSelect } from '@/components/StaffMultiSelect';
import { getWeekDates, toDateString } from '@/lib/timezones';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TimeOffRequestForm } from '@/components/TimeOffRequestForm';
import { TimeOffAdmin } from '@/components/TimeOffAdmin';
import { ScheduleColorPicker } from '@/components/ScheduleColorPicker';
import { CopyWeekDialog } from '@/components/CopyWeekDialog';
import { ScheduleConfigDialog } from '@/components/ScheduleConfigDialog';
import { toast } from 'sonner';

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
  const [copyOpen, setCopyOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const queryClient = useQueryClient();

  const clearWeek = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase
        .from('schedule_blocks' as any)
        .delete()
        .eq('schedule_id', schedule.id)
        .gte('block_date', weekStart)
        .lte('block_date', weekEnd) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-blocks'] });
      toast.success('Week cleared');
    },
    onError: () => toast.error('Failed to clear week'),
  });

  return (
    <div className="space-y-2">
      {isAdmin && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCopyOpen(true)} className="gap-1.5">
            <Copy className="h-3.5 w-3.5" /> Copy Week
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)} className="gap-1.5">
            <Settings2 className="h-3.5 w-3.5" /> Configure
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-destructive hover:text-destructive"
            onClick={() => {
              if (window.confirm(`Clear all blocks for ${schedule._displayName} this week?`)) {
                clearWeek.mutate();
              }
            }}
            disabled={clearWeek.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear Week
          </Button>
        </div>
      )}
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
      <CopyWeekDialog
        open={copyOpen}
        onOpenChange={setCopyOpen}
        sourceWeekDates={weekDates}
        scheduleId={schedule.id}
        userId={schedule.user_id}
      />
      <ScheduleConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        schedule={schedule}
      />
    </div>
  );
}

const TimePlanner = () => {
  const { user, role, roleLoading } = useAuth();
  const isAdmin = role === 'team_admin';
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data: allProfiles = [] } = useQuery({
    queryKey: ['all-profiles-for-schedule', isAdmin],
    queryFn: async () => {
      const { data: profiles } = await supabase.from('profiles').select('*');
      const { data: roles } = await (supabase.from('user_roles').select('user_id, role') as any);
      // Only staff_member and team_admin roles
      const staffUserIds = new Set((roles ?? []).filter((r: any) => r.role === 'staff_member' || r.role === 'team_admin').map((r: any) => r.user_id));
      return (profiles ?? []).filter((p: any) => staffUserIds.has(p.user_id));
    },
    enabled: !!user && !roleLoading && isAdmin,
  });

  const { data: allSchedules = [], isLoading: allSchedsLoading, isFetching: allSchedsFetching } = useQuery({
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
    enabled: !!user && !roleLoading && isAdmin,
  });

  const staffWithoutSchedule = allProfiles.filter(
    (p: any) => !allSchedules.some((s: any) => s.user_id === p.user_id)
  );

  const createScheduleForStaff = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await (supabase
        .from('staff_schedules' as any)
        .insert({ user_id: userId }) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-staff-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['all-profiles-for-schedule'] });
      toast.success('Schedule created');
    },
    onError: () => toast.error('Failed to create schedule'),
  });

  const createAllMissing = useMutation({
    mutationFn: async () => {
      const inserts = staffWithoutSchedule.map((p: any) => ({ user_id: p.user_id }));
      if (inserts.length === 0) return;
      const { error } = await (supabase
        .from('staff_schedules' as any)
        .insert(inserts) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-staff-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['all-profiles-for-schedule'] });
      toast.success('All schedules created');
    },
    onError: () => toast.error('Failed to create schedules'),
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
    if (user && !ownSchedLoading && !ownSchedule) {
      createSchedule.mutate();
    }
  }, [user, ownSchedLoading, ownSchedule]);

  // Build unified staff list from all profiles
  const allStaffList = allProfiles.map((p: any) => ({
    user_id: p.user_id,
    displayName: p.full_name || 'Unknown',
    hasSchedule: allSchedules.some((s: any) => s.user_id === p.user_id),
  }));

  useEffect(() => {
    if (isAdmin && allStaffList.length > 0 && selectedStaffIds.length === 0) {
      setSelectedStaffIds(allStaffList.map(s => s.user_id));
    }
  }, [isAdmin, allStaffList.length, selectedStaffIds.length]);

  const isLoading = roleLoading || (isAdmin ? (allSchedsLoading && allSchedsFetching) : ownSchedLoading);

  const toggleStaff = (userId: string) => {
    const isSelecting = !selectedStaffIds.includes(userId);
    setSelectedStaffIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
    // Auto-create schedule if selecting a staff member without one
    if (isSelecting) {
      const staff = allStaffList.find(s => s.user_id === userId);
      if (staff && !staff.hasSchedule) {
        createScheduleForStaff.mutate(userId);
      }
    }
  };

  const selectAll = () => setSelectedStaffIds(allStaffList.map(s => s.user_id));
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
            {isAdmin ? 'Click or drag cells to select, then assign blocks (30-min slots).' : 'Your schedule (read-only). Contact your admin for changes.'}
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

      {isAdmin && allStaffList.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Staff:</span>
          <StaffMultiSelect
            staff={allStaffList.map(s => ({ user_id: s.user_id, displayName: s.displayName }))}
            selectedIds={selectedStaffIds}
            onToggle={toggleStaff}
            onSelectAll={selectAll}
            onSelectNone={selectNone}
          />
        </div>
      )}

      {isAdmin && staffWithoutSchedule.length > 0 && (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-muted-foreground">Staff without schedules:</p>
            <Button
              variant="default"
              size="sm"
              className="gap-1.5"
              onClick={() => createAllMissing.mutate()}
              disabled={createAllMissing.isPending}
            >
              <UserPlus className="h-3.5 w-3.5" /> Create All ({staffWithoutSchedule.length})
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {staffWithoutSchedule.map((p: any) => (
              <Button
                key={p.user_id}
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => createScheduleForStaff.mutate(p.user_id)}
                disabled={createScheduleForStaff.isPending}
              >
                <UserPlus className="h-3.5 w-3.5" />
                {p.full_name || 'Unknown'}
              </Button>
            ))}
          </div>
        </div>
      )}

      {isAdmin && clients.length > 0 && (
        <ScheduleColorPicker clients={clients} />
      )}

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
