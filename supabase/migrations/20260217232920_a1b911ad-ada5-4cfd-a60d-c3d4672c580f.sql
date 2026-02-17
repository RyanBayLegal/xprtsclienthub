
-- 1. Role enum
CREATE TYPE public.app_role AS ENUM ('team_admin', 'client');

-- 2. User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Profiles table (for display names etc)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Leads table
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact TEXT,
  source TEXT,
  website TEXT,
  date_reached DATE,
  follow_up_email_sent BOOLEAN DEFAULT false,
  follow_up_date DATE,
  needs TEXT,
  booked BOOLEAN DEFAULT false,
  email_sent_with_info BOOLEAN DEFAULT false,
  next_steps TEXT,
  follow_up_email_after DATE,
  stage TEXT NOT NULL DEFAULT 'New',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- 5. Client profiles table
CREATE TABLE public.client_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Basic Info
  name TEXT NOT NULL,
  role TEXT,
  company TEXT,
  practice_area TEXT,
  is_economic_buyer BOOLEAN DEFAULT false,
  -- Assessment
  key_attributes TEXT,
  attitude TEXT,
  stage TEXT DEFAULT 'Prospect',
  pain_points TEXT,
  influences TEXT,
  motivators TEXT,
  -- Relationship
  repeat_customer_probability TEXT,
  meeting_preferences TEXT,
  client_health_score INTEGER CHECK (client_health_score >= 0 AND client_health_score <= 10),
  -- Business
  future_plans TEXT,
  -- Discovery
  discovery_source TEXT,
  how_they_found_us TEXT,
  discovery_notes TEXT,
  -- Meta
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;

-- 6. Roles open sub-table
CREATE TABLE public.roles_open (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_profile_id UUID REFERENCES public.client_profiles(id) ON DELETE CASCADE NOT NULL,
  role_name TEXT NOT NULL,
  is_signed BOOLEAN DEFAULT false,
  pricing TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.roles_open ENABLE ROW LEVEL SECURITY;

-- 7. Helper: has_role (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 8. Update timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_profiles_updated_at BEFORE UPDATE ON public.client_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============

-- user_roles: only team_admin can manage
CREATE POLICY "Team can view roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'team_admin'));
CREATE POLICY "Team can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'team_admin'));
CREATE POLICY "Team can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'team_admin'));
CREATE POLICY "Team can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'team_admin'));

-- profiles: users see own, team sees all
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'team_admin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- leads: only team
CREATE POLICY "Team can view leads" ON public.leads FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'team_admin'));
CREATE POLICY "Team can insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'team_admin'));
CREATE POLICY "Team can update leads" ON public.leads FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'team_admin'));
CREATE POLICY "Team can delete leads" ON public.leads FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'team_admin'));

-- client_profiles: team full access, clients own profile only
CREATE POLICY "Team can view all client profiles" ON public.client_profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'team_admin'));
CREATE POLICY "Clients can view own profile" ON public.client_profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Team can insert client profiles" ON public.client_profiles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'team_admin'));
CREATE POLICY "Team can update client profiles" ON public.client_profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'team_admin'));
CREATE POLICY "Clients can update own profile" ON public.client_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Team can delete client profiles" ON public.client_profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'team_admin'));

-- roles_open: follows client_profiles access
CREATE POLICY "Team can manage roles_open" ON public.roles_open FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'team_admin'));
CREATE POLICY "Clients can view own roles_open" ON public.roles_open FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.client_profiles cp WHERE cp.id = client_profile_id AND cp.user_id = auth.uid())
);
