
-- Fix 1: Remove public read access to talent-attachments storage bucket
DROP POLICY IF EXISTS "Public can read talent attachments" ON storage.objects;

-- Fix 2: Add INSERT, UPDATE, DELETE policies for staff on schedule_blocks
CREATE POLICY "Staff can insert own blocks"
ON public.schedule_blocks FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff can update own blocks"
ON public.schedule_blocks FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Staff can delete own blocks"
ON public.schedule_blocks FOR DELETE TO authenticated
USING (user_id = auth.uid());
