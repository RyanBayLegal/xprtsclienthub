ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS contact_number text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS date_of_birth date,
ADD COLUMN IF NOT EXISTS hired_date date,
ADD COLUMN IF NOT EXISTS personal_email text;