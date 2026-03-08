CREATE TABLE public.workflow_automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES public.workflow_automations(id) ON DELETE SET NULL,
  automation_name text NOT NULL,
  trigger_stage text NOT NULL,
  action_type text NOT NULL,
  lead_id uuid,
  lead_name text NOT NULL,
  result text,
  status text NOT NULL DEFAULT 'success',
  executed_by uuid,
  executed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team admins can manage automation logs"
  ON public.workflow_automation_logs
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'team_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'team_admin'));