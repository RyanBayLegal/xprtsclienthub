-- Add stage_changed_at to client_profiles
ALTER TABLE public.client_profiles
ADD COLUMN IF NOT EXISTS stage_changed_at timestamptz DEFAULT now();

-- Trigger to update stage_changed_at when stage changes
CREATE OR REPLACE FUNCTION public.set_client_stage_changed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    NEW.stage_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_client_profiles_stage_changed_at
BEFORE UPDATE ON public.client_profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_client_stage_changed_at();
