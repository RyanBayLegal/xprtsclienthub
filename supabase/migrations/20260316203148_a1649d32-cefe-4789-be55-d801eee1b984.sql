
CREATE TABLE public.talent_pool (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  country TEXT,
  role TEXT,
  email TEXT,
  contact_number TEXT,
  rate_per_hour NUMERIC,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.talent_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can manage talent_pool"
  ON public.talent_pool
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'team_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'team_admin'));
