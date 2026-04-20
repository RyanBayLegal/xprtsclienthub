-- Add new vendor pipeline fields
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS vendor_type text,
  ADD COLUMN IF NOT EXISTS main_contact text,
  ADD COLUMN IF NOT EXISTS service_offered text,
  ADD COLUMN IF NOT EXISTS pricing text,
  ADD COLUMN IF NOT EXISTS discovery_call_date date,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS next_step text,
  ADD COLUMN IF NOT EXISTS owner text,
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'Outreach Sent',
  ADD COLUMN IF NOT EXISTS stage_changed_at timestamp with time zone DEFAULT now();

-- Stage change tracker trigger
CREATE OR REPLACE FUNCTION public.set_vendor_stage_changed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    NEW.stage_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendor_stage_changed ON public.vendors;
CREATE TRIGGER trg_vendor_stage_changed
BEFORE UPDATE ON public.vendors
FOR EACH ROW EXECUTE FUNCTION public.set_vendor_stage_changed_at();

-- Link tasks to vendors
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.vendors(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tasks_vendor_id ON public.tasks(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendors_stage ON public.vendors(stage);