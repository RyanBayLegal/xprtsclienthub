
-- Create branding_settings table
CREATE TABLE public.branding_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  logo_url text,
  primary_color text DEFAULT '#005b2f',
  accent_color text DEFAULT '#f2c865',
  sidebar_color text DEFAULT '#08331c',
  app_name text DEFAULT 'XPRTS CRM',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.branding_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view branding" ON public.branding_settings
  FOR SELECT USING (true);

CREATE POLICY "Team can manage branding" ON public.branding_settings
  FOR ALL USING (has_role(auth.uid(), 'team_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'team_admin'::app_role));

-- Seed default row
INSERT INTO public.branding_settings (primary_color, accent_color, sidebar_color, app_name)
VALUES ('#005b2f', '#f2c865', '#08331c', 'XPRTS CRM');

-- Create storage bucket for branding assets
INSERT INTO storage.buckets (id, name, public) VALUES ('branding', 'branding', true);

CREATE POLICY "Anyone can view branding assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'branding');

CREATE POLICY "Team can upload branding assets" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'branding' AND has_role(auth.uid(), 'team_admin'::app_role));

CREATE POLICY "Team can update branding assets" ON storage.objects
  FOR UPDATE USING (bucket_id = 'branding' AND has_role(auth.uid(), 'team_admin'::app_role));

CREATE POLICY "Team can delete branding assets" ON storage.objects
  FOR DELETE USING (bucket_id = 'branding' AND has_role(auth.uid(), 'team_admin'::app_role));
