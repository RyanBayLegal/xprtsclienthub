
-- Fix 1: Restrict avatars bucket read access to authenticated users only
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
CREATE POLICY "Authenticated users can view avatars"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');

-- Fix 2: Scope audit_logs SELECT to staff viewing only their own entries
DROP POLICY IF EXISTS "Staff can view audit_logs" ON public.audit_logs;
CREATE POLICY "Staff can view own audit_logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Fix 3: Restrict audit_logs INSERT to staff_member and team_admin only (not clients)
DROP POLICY IF EXISTS "Staff can insert audit_logs" ON public.audit_logs;
CREATE POLICY "Staff and admins can insert audit_logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      has_role(auth.uid(), 'team_admin'::app_role)
      OR has_role(auth.uid(), 'staff_member'::app_role)
    )
  );
