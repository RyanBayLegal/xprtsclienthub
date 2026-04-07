
-- 1. Storage policies for task-attachments bucket
CREATE POLICY "Team admins can select task attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'task-attachments' AND public.has_role(auth.uid(), 'team_admin'));

CREATE POLICY "Assigned staff can select task attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND (storage.foldername(name))[1] IN (
    SELECT t.id::text FROM public.tasks t WHERE t.assigned_to = auth.uid()
  )
);

CREATE POLICY "Team admins can insert task attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-attachments' AND public.has_role(auth.uid(), 'team_admin'));

CREATE POLICY "Assigned staff can insert task attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-attachments'
  AND (storage.foldername(name))[1] IN (
    SELECT t.id::text FROM public.tasks t WHERE t.assigned_to = auth.uid()
  )
);

CREATE POLICY "Team admins can update task attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'task-attachments' AND public.has_role(auth.uid(), 'team_admin'));

CREATE POLICY "Team admins can delete task attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'task-attachments' AND public.has_role(auth.uid(), 'team_admin'));

-- 2. Allow users to read their own role
CREATE POLICY "Users can view own role"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 3. Scope staff access to client_projects they're involved with
DROP POLICY IF EXISTS "Staff can view client_projects" ON public.client_projects;

CREATE POLICY "Staff can view assigned client_projects"
ON public.client_projects FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'staff_member') AND (
    client_profile_id IN (
      SELECT DISTINCT t.client_profile_id FROM public.tasks t WHERE t.assigned_to = auth.uid() AND t.client_profile_id IS NOT NULL
    )
    OR
    client_profile_id IN (
      SELECT DISTINCT ate.client_profile_id FROM public.activity_time_entries ate WHERE ate.staff_assigned = auth.uid()
    )
  )
);
