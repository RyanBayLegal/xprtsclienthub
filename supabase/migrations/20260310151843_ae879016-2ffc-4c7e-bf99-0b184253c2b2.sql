
CREATE TABLE public.client_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_profile_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  amount numeric NULL,
  for_month text NULL,
  status text NOT NULL DEFAULT 'sent',
  sent_at timestamptz NOT NULL DEFAULT now(),
  due_date date NULL,
  paid_at timestamptz NULL,
  notes text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can manage client_invoices"
  ON public.client_invoices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'team_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'team_admin'));

CREATE POLICY "Clients can view own invoices"
  ON public.client_invoices FOR SELECT TO authenticated
  USING (client_profile_id IN (
    SELECT id FROM public.client_profiles WHERE user_id = auth.uid()
  ));
