
-- 1. Add avatar_url to client_profiles
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Create client_attachments table
CREATE TABLE public.client_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_profile_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size bigint,
  uploaded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.client_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can manage client_attachments"
ON public.client_attachments FOR ALL
USING (has_role(auth.uid(), 'team_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'team_admin'::app_role));

CREATE POLICY "Clients can view own attachments"
ON public.client_attachments FOR SELECT
USING (client_profile_id IN (
  SELECT id FROM client_profiles WHERE user_id = auth.uid()
));

-- 3. Create task_comments table
CREATE TABLE public.task_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can manage task_comments"
ON public.task_comments FOR ALL
USING (has_role(auth.uid(), 'team_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'team_admin'::app_role));

CREATE POLICY "Assigned users can view task comments"
ON public.task_comments FOR SELECT
USING (task_id IN (
  SELECT id FROM tasks WHERE assigned_to = auth.uid()
));

CREATE POLICY "Assigned users can add comments"
ON public.task_comments FOR INSERT
WITH CHECK (task_id IN (
  SELECT id FROM tasks WHERE assigned_to = auth.uid()
) AND user_id = auth.uid());

-- 4. Create storage bucket for client attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('client-attachments', 'client-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage policies for client-attachments bucket
CREATE POLICY "Team can upload client attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'client-attachments' AND has_role(auth.uid(), 'team_admin'::app_role));

CREATE POLICY "Team can delete client attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'client-attachments' AND has_role(auth.uid(), 'team_admin'::app_role));

CREATE POLICY "Anyone authenticated can view client attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'client-attachments');
