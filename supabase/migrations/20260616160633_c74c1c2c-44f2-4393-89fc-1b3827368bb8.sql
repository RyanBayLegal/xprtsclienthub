
-- Tighten workflow_automation_logs INSERT: only team_admins or staff_members may insert
DROP POLICY IF EXISTS "Authenticated users can insert automation logs" ON public.workflow_automation_logs;
CREATE POLICY "Team can insert automation logs"
  ON public.workflow_automation_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user() AND (
      has_role(auth.uid(), 'team_admin'::app_role)
      OR has_role(auth.uid(), 'staff_member'::app_role)
    )
  );

-- Remove notifications from the realtime publication. The app polls notifications,
-- so unscoped realtime subscriptions are not needed and were a leak vector.
ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications;
