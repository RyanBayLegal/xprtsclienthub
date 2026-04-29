
CREATE TABLE public.lead_notification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  label text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_notification_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team admins can manage lead_notification_recipients"
ON public.lead_notification_recipients
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'team_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'team_admin'::app_role));
