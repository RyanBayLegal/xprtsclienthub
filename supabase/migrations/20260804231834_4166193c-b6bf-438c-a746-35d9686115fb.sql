ALTER TABLE public.notification_logs
  ADD COLUMN IF NOT EXISTS client_profile_id uuid,
  ADD COLUMN IF NOT EXISTS body_html text,
  ADD COLUMN IF NOT EXISTS body_text text,
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'outbound';

CREATE INDEX IF NOT EXISTS idx_notification_logs_client ON public.notification_logs (client_profile_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_lead ON public.notification_logs (lead_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_recipient ON public.notification_logs (lower(recipient_email));