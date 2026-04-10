
-- Allow staff to view profiles of other users who have staff_member or team_admin roles
CREATE POLICY "Staff can view other staff profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'staff_member'::app_role)
    AND is_active_user()
    AND user_id IN (
      SELECT ur.user_id FROM public.user_roles ur
      WHERE ur.role IN ('staff_member', 'team_admin')
    )
  );

-- Allow staff to view roles of other staff/admin users (needed to show role badges)
CREATE POLICY "Staff can view staff roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'staff_member'::app_role)
    AND is_active_user()
    AND role IN ('staff_member', 'team_admin')
  );
