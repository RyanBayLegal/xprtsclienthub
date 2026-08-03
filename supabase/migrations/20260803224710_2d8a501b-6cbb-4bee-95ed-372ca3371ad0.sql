CREATE TABLE public.user_admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  actor_email text,
  actor_name text,
  target_user_id uuid,
  target_email text,
  target_name text,
  action text NOT NULL,
  old_value text,
  new_value text,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_admin_audit_logs TO authenticated;
GRANT ALL ON public.user_admin_audit_logs TO service_role;

ALTER TABLE public.user_admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can view user admin audit logs"
ON public.user_admin_audit_logs
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE INDEX idx_user_admin_audit_logs_created_at ON public.user_admin_audit_logs (created_at DESC);