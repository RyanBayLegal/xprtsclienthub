
-- Staff Schedules
CREATE TABLE public.staff_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'My Schedule',
  base_timezone text NOT NULL DEFAULT 'America/New_York',
  display_timezones jsonb NOT NULL DEFAULT '["America/Los_Angeles","America/Chicago","America/New_York"]'::jsonb,
  hour_start integer NOT NULL DEFAULT 7,
  hour_end integer NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all schedules" ON public.staff_schedules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'team_admin')) WITH CHECK (has_role(auth.uid(), 'team_admin'));

CREATE POLICY "Staff can view own schedule" ON public.staff_schedules FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Staff can insert own schedule" ON public.staff_schedules FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff can update own schedule" ON public.staff_schedules FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Schedule Clients (color-coded entries)
CREATE TABLE public.schedule_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#60A5FA',
  timezone text NOT NULL DEFAULT 'America/New_York',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage schedule_clients" ON public.schedule_clients FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'team_admin')) WITH CHECK (has_role(auth.uid(), 'team_admin'));

CREATE POLICY "Staff can view schedule_clients" ON public.schedule_clients FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Staff can manage own schedule_clients" ON public.schedule_clients FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff can update own schedule_clients" ON public.schedule_clients FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Staff can delete own schedule_clients" ON public.schedule_clients FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Schedule Blocks
CREATE TABLE public.schedule_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.staff_schedules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  client_id uuid REFERENCES public.schedule_clients(id) ON DELETE SET NULL,
  block_date date,
  day_of_week integer,
  start_hour numeric NOT NULL,
  end_hour numeric NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage schedule_blocks" ON public.schedule_blocks FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'team_admin')) WITH CHECK (has_role(auth.uid(), 'team_admin'));

CREATE POLICY "Staff can view own blocks" ON public.schedule_blocks FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Time Off Requests
CREATE TABLE public.time_off_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  block_date date NOT NULL,
  start_hour integer NOT NULL,
  end_hour integer NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage time_off_requests" ON public.time_off_requests FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'team_admin')) WITH CHECK (has_role(auth.uid(), 'team_admin'));

CREATE POLICY "Staff can view own time_off" ON public.time_off_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Staff can insert own time_off" ON public.time_off_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff can delete own pending time_off" ON public.time_off_requests FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending');
