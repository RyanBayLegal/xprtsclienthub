
-- Tasks table for staff task assignment
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo',
  priority text NOT NULL DEFAULT 'medium',
  due_date date,
  assigned_to uuid,
  assigned_to_name text,
  client_profile_id uuid REFERENCES public.client_profiles(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  created_by uuid,
  stage text,
  template_name text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can manage tasks"
  ON public.tasks FOR ALL
  USING (has_role(auth.uid(), 'team_admin'))
  WITH CHECK (has_role(auth.uid(), 'team_admin'));

CREATE POLICY "Assigned users can view own tasks"
  ON public.tasks FOR SELECT
  USING (assigned_to = auth.uid());

CREATE POLICY "Assigned users can update own tasks"
  ON public.tasks FOR UPDATE
  USING (assigned_to = auth.uid());

CREATE TRIGGER set_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Workflow templates table
CREATE TABLE public.workflow_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  stage text NOT NULL,
  tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can manage workflow_templates"
  ON public.workflow_templates FOR ALL
  USING (has_role(auth.uid(), 'team_admin'))
  WITH CHECK (has_role(auth.uid(), 'team_admin'));

CREATE TRIGGER set_workflow_templates_updated_at
  BEFORE UPDATE ON public.workflow_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
