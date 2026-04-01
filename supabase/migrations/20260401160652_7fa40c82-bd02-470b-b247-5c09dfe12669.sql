-- Fix 1: Tighten client-attachments storage SELECT policy
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone authenticated can view client attachments" ON storage.objects;

-- Create a restrictive policy: team admins can view all, clients can view their own
CREATE POLICY "Team admins can view client attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-attachments'
  AND has_role(auth.uid(), 'team_admin'::app_role)
);

CREATE POLICY "Clients can view own client attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-attachments'
  AND (storage.foldername(name))[1] IN (
    SELECT cp.id::text FROM client_profiles cp WHERE cp.user_id = auth.uid()
  )
);

-- Also fix the INSERT/DELETE policies to use authenticated role
DROP POLICY IF EXISTS "Team can upload client attachments" ON storage.objects;
CREATE POLICY "Team can upload client attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'client-attachments'
  AND has_role(auth.uid(), 'team_admin'::app_role)
);

DROP POLICY IF EXISTS "Team can delete client attachments" ON storage.objects;
CREATE POLICY "Team can delete client attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'client-attachments'
  AND has_role(auth.uid(), 'team_admin'::app_role)
);

-- Fix 2: Change profiles team admin update policy from public to authenticated
DROP POLICY IF EXISTS "Team admins can update any profile" ON public.profiles;
CREATE POLICY "Team admins can update any profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'team_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'team_admin'::app_role));