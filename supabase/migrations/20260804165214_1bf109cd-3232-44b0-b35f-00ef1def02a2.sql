
CREATE TABLE public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL,
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  graph jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automations TO authenticated;
GRANT ALL ON public.automations TO service_role;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage automations" ON public.automations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'team_admin') AND public.is_active_user())
  WITH CHECK (public.has_role(auth.uid(), 'team_admin') AND public.is_active_user());
CREATE TRIGGER set_automations_updated_at BEFORE UPDATE ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES public.automations(id) ON DELETE SET NULL,
  automation_name text NOT NULL,
  trigger_type text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  executed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.automation_runs TO authenticated;
GRANT ALL ON public.automation_runs TO service_role;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view automation runs" ON public.automation_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'team_admin') AND public.is_active_user());
CREATE POLICY "Admins insert automation runs" ON public.automation_runs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'team_admin') AND public.is_active_user());

CREATE TABLE public.inbound_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_email text,
  from_name text,
  to_email text,
  subject text,
  body_text text,
  body_html text,
  raw_payload jsonb,
  matched_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  matched_client_id uuid REFERENCES public.client_profiles(id) ON DELETE SET NULL,
  processed boolean NOT NULL DEFAULT false,
  received_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.inbound_emails TO authenticated;
GRANT ALL ON public.inbound_emails TO service_role;
ALTER TABLE public.inbound_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view inbound emails" ON public.inbound_emails FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'team_admin') AND public.is_active_user());

CREATE INDEX idx_automations_trigger ON public.automations (trigger_type) WHERE is_active;
CREATE INDEX idx_automation_runs_created ON public.automation_runs (created_at DESC);

INSERT INTO public.automations (name, description, trigger_type, trigger_config, graph, is_active, created_by, created_at)
SELECT
  w.name,
  'Migrated from Workflow Automations',
  'lead_stage_change',
  jsonb_build_object('stage', w.trigger_stage),
  jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object(
        'id', 'trigger',
        'type', 'automationNode',
        'position', jsonb_build_object('x', 80, 'y', 120),
        'data', jsonb_build_object('kind', 'trigger', 'config', jsonb_build_object('trigger_type', 'lead_stage_change', 'stage', w.trigger_stage))
      ),
      jsonb_build_object(
        'id', 'action-1',
        'type', 'automationNode',
        'position', jsonb_build_object('x', 420, 'y', 120),
        'data', jsonb_build_object('kind', w.action_type, 'config', w.action_config)
      )
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('id', 'e-trigger-action-1', 'source', 'trigger', 'target', 'action-1')
    )
  ),
  w.is_active,
  w.created_by,
  w.created_at
FROM public.workflow_automations w;
