
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_name text,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  client_profile_id uuid,
  action text NOT NULL DEFAULT 'update',
  field_name text,
  old_value text,
  new_value text,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can manage audit_logs" ON public.audit_logs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'team_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'team_admin'::app_role));

CREATE POLICY "Staff can view audit_logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'staff_member'::app_role));

CREATE POLICY "Staff can insert audit_logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_client ON public.audit_logs (client_profile_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs (created_at DESC);
