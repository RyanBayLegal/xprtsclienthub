-- Allow team admins to update any profile (for avatar management)
CREATE POLICY "Team admins can update any profile"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'team_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'team_admin'::app_role));