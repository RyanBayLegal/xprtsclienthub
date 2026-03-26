
-- Add links column to tasks
ALTER TABLE public.tasks ADD COLUMN links jsonb DEFAULT '[]'::jsonb;

-- Create task_attachments table
CREATE TABLE public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can manage task_attachments" ON public.task_attachments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'team_admin'))
  WITH CHECK (has_role(auth.uid(), 'team_admin'));

CREATE POLICY "Assigned users can view task_attachments" ON public.task_attachments
  FOR SELECT TO authenticated
  USING (task_id IN (SELECT id FROM tasks WHERE assigned_to = auth.uid()));

CREATE POLICY "Assigned users can insert task_attachments" ON public.task_attachments
  FOR INSERT TO authenticated
  WITH CHECK (task_id IN (SELECT id FROM tasks WHERE assigned_to = auth.uid()));

-- Storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('task-attachments', 'task-attachments', true);
