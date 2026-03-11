
-- Add state and timezone to client_profiles
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS timezone text;

-- Add payment_mode to client_invoices
ALTER TABLE public.client_invoices ADD COLUMN IF NOT EXISTS payment_mode text;

-- Expand roles_open with new fields
ALTER TABLE public.roles_open ADD COLUMN IF NOT EXISTS date_requested date;
ALTER TABLE public.roles_open ADD COLUMN IF NOT EXISTS arrangement_hours text;
ALTER TABLE public.roles_open ADD COLUMN IF NOT EXISTS agreement text;
ALTER TABLE public.roles_open ADD COLUMN IF NOT EXISTS projected_start_date date;

-- Create key_people table
CREATE TABLE public.key_people (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_profile_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  role text,
  email text,
  contact_number text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.key_people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can manage key_people" ON public.key_people FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'team_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'team_admin'));

CREATE POLICY "Clients can view own key_people" ON public.key_people FOR SELECT TO authenticated
  USING (client_profile_id IN (SELECT id FROM public.client_profiles WHERE user_id = auth.uid()));

-- Create client_projects table
CREATE TABLE public.client_projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_profile_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_hours numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.client_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can manage client_projects" ON public.client_projects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'team_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'team_admin'));

CREATE POLICY "Staff can view client_projects" ON public.client_projects FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'staff_member'));

-- Create activity_time_entries table
CREATE TABLE public.activity_time_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_assigned uuid NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  client_profile_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.client_projects(id) ON DELETE CASCADE,
  activity_name text NOT NULL DEFAULT '',
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  total_hours numeric DEFAULT 0,
  target_hours numeric DEFAULT 0,
  remaining_hours numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'not_started',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can manage activity_time_entries" ON public.activity_time_entries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'team_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'team_admin'));

CREATE POLICY "Staff can view own entries" ON public.activity_time_entries FOR SELECT TO authenticated
  USING (staff_assigned = auth.uid());

CREATE POLICY "Staff can insert own entries" ON public.activity_time_entries FOR INSERT TO authenticated
  WITH CHECK (staff_assigned = auth.uid());

CREATE POLICY "Staff can update own entries" ON public.activity_time_entries FOR UPDATE TO authenticated
  USING (staff_assigned = auth.uid());
