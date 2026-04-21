CREATE TABLE public.lead_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view lead_sources"
ON public.lead_sources FOR SELECT
TO authenticated
USING (is_active_user());

CREATE POLICY "Team admins can manage lead_sources"
ON public.lead_sources FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'team_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'team_admin'::app_role));

CREATE TRIGGER update_lead_sources_updated_at
BEFORE UPDATE ON public.lead_sources
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.lead_sources (name)
SELECT DISTINCT TRIM(source) FROM public.leads
WHERE source IS NOT NULL AND TRIM(source) <> ''
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.lead_sources (name) VALUES
  ('Strategy Review Form'),
  ('Referral'),
  ('Website'),
  ('Cold Outreach'),
  ('LinkedIn')
ON CONFLICT (name) DO NOTHING;