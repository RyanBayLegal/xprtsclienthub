ALTER TABLE public.inbound_emails
  ADD COLUMN IF NOT EXISTS message_id text,
  ADD COLUMN IF NOT EXISTS in_reply_to text,
  ADD COLUMN IF NOT EXISTS references_header text,
  ADD COLUMN IF NOT EXISTS thread_id text,
  ADD COLUMN IF NOT EXISTS match_method text,
  ADD COLUMN IF NOT EXISTS match_debug jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.notification_logs
  ADD COLUMN IF NOT EXISTS thread_id text;

CREATE INDEX IF NOT EXISTS idx_inbound_emails_message_id ON public.inbound_emails (message_id);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_thread_id ON public.inbound_emails (thread_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_message_id ON public.notification_logs (message_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_thread_id ON public.notification_logs (thread_id);