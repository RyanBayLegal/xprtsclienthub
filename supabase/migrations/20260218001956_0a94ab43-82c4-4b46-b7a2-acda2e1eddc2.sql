
-- Systems audit table (like scoping_questionnaires)
CREATE TABLE public.systems_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_profile_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  section_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.systems_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can manage systems_audits"
  ON public.systems_audits FOR ALL
  USING (has_role(auth.uid(), 'team_admin'))
  WITH CHECK (has_role(auth.uid(), 'team_admin'));

CREATE POLICY "Clients can view own systems_audit"
  ON public.systems_audits FOR SELECT
  USING (client_profile_id IN (
    SELECT id FROM public.client_profiles WHERE user_id = auth.uid()
  ));

CREATE TRIGGER set_systems_audits_updated_at
  BEFORE UPDATE ON public.systems_audits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add content_data and signature fields to engagement_agreements
ALTER TABLE public.engagement_agreements
  ADD COLUMN IF NOT EXISTS content_data jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS client_signature text,
  ADD COLUMN IF NOT EXISTS client_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS xprts_signature text,
  ADD COLUMN IF NOT EXISTS xprts_signed_at timestamptz;
