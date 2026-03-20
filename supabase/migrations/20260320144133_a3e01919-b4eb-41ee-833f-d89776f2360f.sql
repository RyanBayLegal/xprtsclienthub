ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS birthday date,
  ADD COLUMN IF NOT EXISTS staff_start_date date,
  ADD COLUMN IF NOT EXISTS company_established_date date;