ALTER TABLE public.notification_logs ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.inbound_emails ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.inbound_emails ADD COLUMN IF NOT EXISTS message_uid text;
CREATE UNIQUE INDEX IF NOT EXISTS inbound_emails_message_uid_key ON public.inbound_emails(message_uid) WHERE message_uid IS NOT NULL;

DROP POLICY IF EXISTS "Staff view inbound emails" ON public.inbound_emails;
CREATE POLICY "Staff view inbound emails" ON public.inbound_emails FOR SELECT TO authenticated
USING ((has_role(auth.uid(),'team_admin'::app_role) OR has_role(auth.uid(),'staff_member'::app_role)) AND is_active_user());

DROP POLICY IF EXISTS "Staff view notification logs" ON public.notification_logs;
CREATE POLICY "Staff view notification logs" ON public.notification_logs FOR SELECT TO authenticated
USING ((has_role(auth.uid(),'team_admin'::app_role) OR has_role(auth.uid(),'staff_member'::app_role)) AND is_active_user());

CREATE TABLE IF NOT EXISTS public.email_sync_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  last_checked_at timestamptz,
  last_uid bigint,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_sync_state TO authenticated;
GRANT ALL ON public.email_sync_state TO service_role;
ALTER TABLE public.email_sync_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view email sync state" ON public.email_sync_state;
CREATE POLICY "Staff view email sync state" ON public.email_sync_state FOR SELECT TO authenticated
USING ((has_role(auth.uid(),'team_admin'::app_role) OR has_role(auth.uid(),'staff_member'::app_role)) AND is_active_user());
INSERT INTO public.email_sync_state (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Staff read email attachments" ON storage.objects;
CREATE POLICY "Staff read email attachments" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'email-attachments' AND (has_role(auth.uid(),'team_admin'::app_role) OR has_role(auth.uid(),'staff_member'::app_role)) AND is_active_user());

DROP POLICY IF EXISTS "Staff upload email attachments" ON storage.objects;
CREATE POLICY "Staff upload email attachments" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'email-attachments' AND (has_role(auth.uid(),'team_admin'::app_role) OR has_role(auth.uid(),'staff_member'::app_role)) AND is_active_user());

DROP POLICY IF EXISTS "Staff delete email attachments" ON storage.objects;
CREATE POLICY "Staff delete email attachments" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'email-attachments' AND has_role(auth.uid(),'team_admin'::app_role) AND is_active_user());