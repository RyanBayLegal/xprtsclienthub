
-- Engagement agreements table
CREATE TABLE public.engagement_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  client_profile_id uuid REFERENCES public.client_profiles(id) ON DELETE SET NULL,
  sent_by uuid,
  sent_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'draft',
  agreement_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.engagement_agreements ENABLE ROW LEVEL SECURITY;

-- RLS for engagement_agreements
CREATE POLICY "Team can manage engagement_agreements"
ON public.engagement_agreements FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'team_admin'))
WITH CHECK (public.has_role(auth.uid(), 'team_admin'));

CREATE POLICY "Clients can view own agreements"
ON public.engagement_agreements FOR SELECT TO authenticated
USING (client_profile_id IN (
  SELECT id FROM public.client_profiles WHERE user_id = auth.uid()
));

-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  read boolean NOT NULL DEFAULT false,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS for notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Team can insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'team_admin'));

-- Update trigger for engagement_agreements
CREATE TRIGGER update_engagement_agreements_updated_at
BEFORE UPDATE ON public.engagement_agreements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate old lead stages
UPDATE public.leads SET stage = 'Prospecting Stage'
WHERE stage NOT IN (
  'Prospecting Stage','Discovery Stage',
  'Solution Mapping Stage','Proposal/Contract Stage',
  'Onboarding/Kickoff Stage'
);
