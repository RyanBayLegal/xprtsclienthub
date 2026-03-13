ALTER TABLE public.roles_open ADD COLUMN IF NOT EXISTS role_status text NOT NULL DEFAULT 'open';

ALTER TABLE public.client_projects ADD COLUMN IF NOT EXISTS category text;