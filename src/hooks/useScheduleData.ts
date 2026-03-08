import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export function useSchedule() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const scheduleQuery = useQuery({
    queryKey: ['staff-schedule', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await (supabase
        .from('staff_schedules' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle() as any);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createSchedule = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await (supabase
        .from('staff_schedules' as any)
        .insert({ user_id: user.id })
        .select()
        .single() as any);
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff-schedule'] }),
  });

  return { schedule: scheduleQuery.data, isLoading: scheduleQuery.isLoading, createSchedule };
}

const CLIENT_COLORS = [
  '#FBBF24', '#F472B6', '#60A5FA', '#34D399', '#A78BFA',
  '#FB923C', '#F87171', '#2DD4BF', '#E879F9', '#818CF8',
];

export function useScheduleClients() {
  const { user } = useAuth();

  const clientsQuery = useQuery({
    queryKey: ['schedule-clients-from-profiles', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('client_profiles')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return (data ?? []).map((c, i) => ({
        id: c.id,
        name: c.name,
        color: CLIENT_COLORS[i % CLIENT_COLORS.length],
        timezone: 'America/New_York',
      }));
    },
    enabled: !!user,
  });

  return { clients: clientsQuery.data ?? [], isLoading: clientsQuery.isLoading };
}

export function useBlocks(scheduleId: string | undefined, weekStartDate?: string, weekEndDate?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const blocksQuery = useQuery({
    queryKey: ['schedule-blocks', scheduleId, weekStartDate, weekEndDate],
    queryFn: async () => {
      if (!scheduleId) return [];
      let query = (supabase
        .from('schedule_blocks' as any)
        .select('*, client_profiles(id, name)') as any)
        .eq('schedule_id', scheduleId);
      
      if (weekStartDate && weekEndDate) {
        query = query.gte('block_date', weekStartDate).lte('block_date', weekEndDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      // Rename joined key from schedule_clients to clients for ScheduleGrid compatibility
      return (data ?? []).map((b: any) => ({ ...b, clients: b.schedule_clients }));
    },
    enabled: !!scheduleId,
  });

  const addBlock = useMutation({
    mutationFn: async (block: {
      schedule_id: string;
      client_id?: string;
      day_of_week?: number;
      start_hour: number;
      end_hour: number;
      label?: string;
      block_date?: string;
      _owner_id?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const { _owner_id, ...rest } = block;
      const { data, error } = await (supabase
        .from('schedule_blocks' as any)
        .insert({ ...rest, user_id: _owner_id ?? user.id })
        .select('*, schedule_clients(*)')
        .single() as any);
      if (error) throw error;
      return { ...data, clients: data.schedule_clients };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedule-blocks'] }),
  });

  const deleteBlock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('schedule_blocks' as any).delete().eq('id', id) as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedule-blocks'] }),
  });

  return { blocks: blocksQuery.data ?? [], isLoading: blocksQuery.isLoading, addBlock, deleteBlock };
}

export interface TimeOffRequest {
  id: string;
  user_id: string;
  block_date: string;
  start_hour: number;
  end_hour: number;
  reason: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  _displayName?: string;
}

export function useTimeOffRequests(options?: { allUsers?: boolean; weekStart?: string; weekEnd?: string }) {
  const { user, role } = useAuth();
  const isAdmin = role === 'team_admin';
  const queryClient = useQueryClient();

  const requestsQuery = useQuery<TimeOffRequest[]>({
    queryKey: ['time-off-requests', user?.id, options?.allUsers, options?.weekStart, options?.weekEnd],
    queryFn: async (): Promise<TimeOffRequest[]> => {
      if (!user) return [];
      let query = (supabase.from('time_off_requests' as any).select('*').order('created_at', { ascending: false }) as any);
      
      if (!options?.allUsers) {
        query = query.eq('user_id', user.id);
      }
      if (options?.weekStart && options?.weekEnd) {
        query = query.gte('block_date', options.weekStart).lte('block_date', options.weekEnd);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (options?.allUsers && isAdmin) {
        const { data: profiles } = await supabase.from('profiles').select('*');
        return (data ?? []).map((r: any) => ({
          ...r,
          _displayName: profiles?.find((p: any) => p.user_id === r.user_id)?.full_name ?? 'Unknown',
        }));
      }

      return data ?? [];
    },
    enabled: !!user,
  });

  const createRequest = useMutation({
    mutationFn: async (req: { block_date: string; start_hour: number; end_hour: number; reason?: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await (supabase
        .from('time_off_requests' as any)
        .insert({ ...req, user_id: user.id })
        .select()
        .single() as any);
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['time-off-requests'] }),
  });

  const updateRequestStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await (supabase
        .from('time_off_requests' as any)
        .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single() as any);
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['time-off-requests'] }),
  });

  const deleteRequest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('time_off_requests' as any).delete().eq('id', id) as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['time-off-requests'] }),
  });

  return {
    requests: requestsQuery.data ?? [],
    isLoading: requestsQuery.isLoading,
    createRequest,
    updateRequestStatus,
    deleteRequest,
  };
}
