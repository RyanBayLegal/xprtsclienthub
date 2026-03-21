
CREATE TABLE public.placed_vas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_profile_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  talent_id uuid NOT NULL REFERENCES public.talent_pool(id) ON DELETE CASCADE,
  start_date date,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE(client_profile_id, talent_id)
);

ALTER TABLE public.placed_vas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can manage placed_vas" ON public.placed_vas
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'team_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'team_admin'::app_role));

CREATE POLICY "Clients can view own placed_vas" ON public.placed_vas
  FOR SELECT TO authenticated
  USING (client_profile_id IN (
    SELECT id FROM client_profiles WHERE user_id = auth.uid()
  ));
