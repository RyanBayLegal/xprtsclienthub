CREATE TABLE IF NOT EXISTS public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  channel text NOT NULL,
  recipient_email text,
  lead_id uuid,
  task_id uuid,
  subject text,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  message_id text
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON public.notification_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_channel ON public.notification_logs (channel);

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team admins manage notification_logs"
  ON public.notification_logs
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'team_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'team_admin'::app_role));