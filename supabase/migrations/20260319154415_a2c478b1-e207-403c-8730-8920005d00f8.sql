
-- Add new columns to talent_pool
ALTER TABLE public.talent_pool ADD COLUMN IF NOT EXISTS notes text DEFAULT NULL;
ALTER TABLE public.talent_pool ADD COLUMN IF NOT EXISTS links jsonb DEFAULT '[]'::jsonb;

-- Create talent-attachments storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('talent-attachments', 'talent-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Create talent_attachments table
CREATE TABLE IF NOT EXISTS public.talent_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id uuid NOT NULL REFERENCES public.talent_pool(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.talent_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can manage talent_attachments"
  ON public.talent_attachments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'team_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'team_admin'::app_role));

-- Storage RLS for talent-attachments bucket
CREATE POLICY "Team can upload talent attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'talent-attachments' AND has_role(auth.uid(), 'team_admin'::app_role));

CREATE POLICY "Team can read talent attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'talent-attachments' AND has_role(auth.uid(), 'team_admin'::app_role));

CREATE POLICY "Team can delete talent attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'talent-attachments' AND has_role(auth.uid(), 'team_admin'::app_role));

CREATE POLICY "Public can read talent attachments"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'talent-attachments');
