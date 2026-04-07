
-- Create a SECURITY DEFINER function to check if the current user is active
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_active FROM public.profiles WHERE user_id = auth.uid() LIMIT 1),
    true
  );
$$;

-- PROFILES: update user-scoped policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING ((user_id = auth.uid() OR has_role(auth.uid(), 'team_admin')) AND is_active_user());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND is_active_user());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- TASKS: update assigned user policies
DROP POLICY IF EXISTS "Assigned users can view own tasks" ON public.tasks;
CREATE POLICY "Assigned users can view own tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (assigned_to = auth.uid() AND is_active_user());

DROP POLICY IF EXISTS "Assigned users can update own tasks" ON public.tasks;
CREATE POLICY "Assigned users can update own tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() AND is_active_user());

-- TASK_ATTACHMENTS: update assigned user policies
DROP POLICY IF EXISTS "Assigned users can view task_attachments" ON public.task_attachments;
CREATE POLICY "Assigned users can view task_attachments" ON public.task_attachments
  FOR SELECT TO authenticated
  USING (task_id IN (SELECT id FROM tasks WHERE assigned_to = auth.uid()) AND is_active_user());

DROP POLICY IF EXISTS "Assigned users can insert task_attachments" ON public.task_attachments;
CREATE POLICY "Assigned users can insert task_attachments" ON public.task_attachments
  FOR INSERT TO authenticated
  WITH CHECK (task_id IN (SELECT id FROM tasks WHERE assigned_to = auth.uid()) AND is_active_user());

-- TASK_COMMENTS: update assigned user policies
DROP POLICY IF EXISTS "Assigned users can view task comments" ON public.task_comments;
CREATE POLICY "Assigned users can view task comments" ON public.task_comments
  FOR SELECT TO authenticated
  USING (task_id IN (SELECT id FROM tasks WHERE assigned_to = auth.uid()) AND is_active_user());

DROP POLICY IF EXISTS "Assigned users can add comments" ON public.task_comments;
CREATE POLICY "Assigned users can add comments" ON public.task_comments
  FOR INSERT TO authenticated
  WITH CHECK (task_id IN (SELECT id FROM tasks WHERE assigned_to = auth.uid()) AND user_id = auth.uid() AND is_active_user());

DROP POLICY IF EXISTS "Users can update own comments" ON public.task_comments;
CREATE POLICY "Users can update own comments" ON public.task_comments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND is_active_user())
  WITH CHECK (user_id = auth.uid() AND is_active_user());

DROP POLICY IF EXISTS "Users can delete own comments" ON public.task_comments;
CREATE POLICY "Users can delete own comments" ON public.task_comments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND is_active_user());

-- SCHEDULE_BLOCKS: update staff policies
DROP POLICY IF EXISTS "Staff can view own blocks" ON public.schedule_blocks;
CREATE POLICY "Staff can view own blocks" ON public.schedule_blocks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND is_active_user());

DROP POLICY IF EXISTS "Staff can insert own blocks" ON public.schedule_blocks;
CREATE POLICY "Staff can insert own blocks" ON public.schedule_blocks
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_active_user());

DROP POLICY IF EXISTS "Staff can update own blocks" ON public.schedule_blocks;
CREATE POLICY "Staff can update own blocks" ON public.schedule_blocks
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND is_active_user());

DROP POLICY IF EXISTS "Staff can delete own blocks" ON public.schedule_blocks;
CREATE POLICY "Staff can delete own blocks" ON public.schedule_blocks
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND is_active_user());

-- SCHEDULE_CLIENTS: update staff policies
DROP POLICY IF EXISTS "Staff can view schedule_clients" ON public.schedule_clients;
CREATE POLICY "Staff can view schedule_clients" ON public.schedule_clients
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND is_active_user());

DROP POLICY IF EXISTS "Staff can manage own schedule_clients" ON public.schedule_clients;
CREATE POLICY "Staff can manage own schedule_clients" ON public.schedule_clients
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_active_user());

DROP POLICY IF EXISTS "Staff can update own schedule_clients" ON public.schedule_clients;
CREATE POLICY "Staff can update own schedule_clients" ON public.schedule_clients
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND is_active_user());

DROP POLICY IF EXISTS "Staff can delete own schedule_clients" ON public.schedule_clients;
CREATE POLICY "Staff can delete own schedule_clients" ON public.schedule_clients
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND is_active_user());

-- STAFF_SCHEDULES: update staff policies
DROP POLICY IF EXISTS "Staff can view own schedule" ON public.staff_schedules;
CREATE POLICY "Staff can view own schedule" ON public.staff_schedules
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND is_active_user());

DROP POLICY IF EXISTS "Staff can insert own schedule" ON public.staff_schedules;
CREATE POLICY "Staff can insert own schedule" ON public.staff_schedules
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_active_user());

DROP POLICY IF EXISTS "Staff can update own schedule" ON public.staff_schedules;
CREATE POLICY "Staff can update own schedule" ON public.staff_schedules
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND is_active_user());

-- TIME_OFF_REQUESTS: update staff policies
DROP POLICY IF EXISTS "Staff can view own time_off" ON public.time_off_requests;
CREATE POLICY "Staff can view own time_off" ON public.time_off_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND is_active_user());

DROP POLICY IF EXISTS "Staff can insert own time_off" ON public.time_off_requests;
CREATE POLICY "Staff can insert own time_off" ON public.time_off_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_active_user());

DROP POLICY IF EXISTS "Staff can delete own pending time_off" ON public.time_off_requests;
CREATE POLICY "Staff can delete own pending time_off" ON public.time_off_requests
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending' AND is_active_user());

-- ACTIVITY_TIME_ENTRIES: update staff policies
DROP POLICY IF EXISTS "Staff can view own entries" ON public.activity_time_entries;
CREATE POLICY "Staff can view own entries" ON public.activity_time_entries
  FOR SELECT TO authenticated
  USING (staff_assigned = auth.uid() AND is_active_user());

DROP POLICY IF EXISTS "Staff can insert own entries" ON public.activity_time_entries;
CREATE POLICY "Staff can insert own entries" ON public.activity_time_entries
  FOR INSERT TO authenticated
  WITH CHECK (staff_assigned = auth.uid() AND is_active_user());

DROP POLICY IF EXISTS "Staff can update own entries" ON public.activity_time_entries;
CREATE POLICY "Staff can update own entries" ON public.activity_time_entries
  FOR UPDATE TO authenticated
  USING (staff_assigned = auth.uid() AND is_active_user());

-- NOTIFICATIONS: update user policies
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND is_active_user());

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND is_active_user());

-- USER_ROLES: update self-read policy
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND is_active_user());

-- CLIENT_PROFILES: update client-scoped policies
DROP POLICY IF EXISTS "Clients can view own profile" ON public.client_profiles;
CREATE POLICY "Clients can view own profile" ON public.client_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND is_active_user());

DROP POLICY IF EXISTS "Clients can update own profile" ON public.client_profiles;
CREATE POLICY "Clients can update own profile" ON public.client_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND is_active_user());

-- AUDIT_LOGS: update staff policy
DROP POLICY IF EXISTS "Staff can view own audit_logs" ON public.audit_logs;
CREATE POLICY "Staff can view own audit_logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND is_active_user());

DROP POLICY IF EXISTS "Staff and admins can insert audit_logs" ON public.audit_logs;
CREATE POLICY "Staff and admins can insert audit_logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_active_user() AND (has_role(auth.uid(), 'team_admin') OR has_role(auth.uid(), 'staff_member')));

-- CLIENT_PROJECTS: update scoped staff policy
DROP POLICY IF EXISTS "Staff can view assigned client_projects" ON public.client_projects;
CREATE POLICY "Staff can view assigned client_projects" ON public.client_projects
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'staff_member') AND is_active_user() AND (
      client_profile_id IN (SELECT DISTINCT t.client_profile_id FROM tasks t WHERE t.assigned_to = auth.uid() AND t.client_profile_id IS NOT NULL)
      OR client_profile_id IN (SELECT DISTINCT ate.client_profile_id FROM activity_time_entries ate WHERE ate.staff_assigned = auth.uid())
    )
  );

-- VENDORS: update staff policy
DROP POLICY IF EXISTS "Staff can view vendors" ON public.vendors;
CREATE POLICY "Staff can view vendors" ON public.vendors
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'staff_member') AND is_active_user());
