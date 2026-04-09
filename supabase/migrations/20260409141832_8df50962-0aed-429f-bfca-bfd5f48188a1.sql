-- Fix 1: Restrict branding_settings SELECT to authenticated users
DROP POLICY IF EXISTS "Team can view branding" ON public.branding_settings;
CREATE POLICY "Authenticated can view branding"
  ON public.branding_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Fix 2: Add INSERT policy for workflow_automation_logs for authenticated users
CREATE POLICY "Authenticated users can insert automation logs"
  ON public.workflow_automation_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (is_active_user());