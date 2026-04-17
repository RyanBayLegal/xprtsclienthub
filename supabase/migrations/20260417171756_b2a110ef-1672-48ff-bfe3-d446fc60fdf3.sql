-- Create vendor_attachments table
CREATE TABLE public.vendor_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can manage vendor_attachments"
ON public.vendor_attachments FOR ALL
USING (has_role(auth.uid(), 'team_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'team_admin'::app_role));

CREATE POLICY "Staff can view vendor_attachments"
ON public.vendor_attachments FOR SELECT
USING (has_role(auth.uid(), 'staff_member'::app_role) AND is_active_user());

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('vendor-attachments', 'vendor-attachments', false);

-- Storage policies
CREATE POLICY "Team can manage vendor attachment files"
ON storage.objects FOR ALL
USING (bucket_id = 'vendor-attachments' AND has_role(auth.uid(), 'team_admin'::app_role))
WITH CHECK (bucket_id = 'vendor-attachments' AND has_role(auth.uid(), 'team_admin'::app_role));

CREATE POLICY "Staff can view vendor attachment files"
ON storage.objects FOR SELECT
USING (bucket_id = 'vendor-attachments' AND has_role(auth.uid(), 'staff_member'::app_role) AND is_active_user());