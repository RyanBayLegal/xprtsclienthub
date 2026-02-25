
-- client_notes table
CREATE TABLE public.client_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_profile_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_by uuid NOT NULL,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can manage client_notes" ON public.client_notes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'team_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'team_admin'::app_role));
CREATE POLICY "Clients can view own notes" ON public.client_notes FOR SELECT TO authenticated
  USING (client_profile_id IN (SELECT id FROM client_profiles WHERE user_id = auth.uid()));

-- vendors table
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  subscribed_date date,
  subscribed_by text,
  fee text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can manage vendors" ON public.vendors FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'team_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'team_admin'::app_role));
CREATE POLICY "Staff can view vendors" ON public.vendors FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'staff_member'::app_role));
