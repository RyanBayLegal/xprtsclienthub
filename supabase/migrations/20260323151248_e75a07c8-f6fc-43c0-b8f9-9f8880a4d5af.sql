-- Allow comment authors to update their own comments
CREATE POLICY "Users can update own comments"
ON public.task_comments
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow comment authors to delete their own comments
CREATE POLICY "Users can delete own comments"
ON public.task_comments
FOR DELETE
TO authenticated
USING (user_id = auth.uid());