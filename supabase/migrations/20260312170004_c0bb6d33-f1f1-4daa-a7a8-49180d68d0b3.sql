
ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS company_name text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS phone text;
