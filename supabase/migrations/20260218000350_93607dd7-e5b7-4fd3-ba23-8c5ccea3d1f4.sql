
-- Stage change timestamp
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS stage_changed_at timestamptz DEFAULT now();

-- Trigger to auto-update stage_changed_at
CREATE OR REPLACE FUNCTION public.set_stage_changed_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    NEW.stage_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stage_changed_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_stage_changed_at();

-- Scoping questionnaires table
CREATE TABLE public.scoping_questionnaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_profile_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  section_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scoping_questionnaires ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Team can manage scoping_questionnaires"
  ON public.scoping_questionnaires FOR ALL
  USING (has_role(auth.uid(), 'team_admin'))
  WITH CHECK (has_role(auth.uid(), 'team_admin'));

CREATE POLICY "Clients can view own scoping questionnaire"
  ON public.scoping_questionnaires FOR SELECT
  USING (client_profile_id IN (
    SELECT id FROM public.client_profiles WHERE user_id = auth.uid()
  ));

-- Trigger for updated_at
CREATE TRIGGER set_scoping_updated_at
  BEFORE UPDATE ON public.scoping_questionnaires
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
