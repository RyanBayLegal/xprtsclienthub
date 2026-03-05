
CREATE TABLE public.team_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  url text NOT NULL,
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can manage team_links"
  ON public.team_links
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'team_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'team_admin'));
