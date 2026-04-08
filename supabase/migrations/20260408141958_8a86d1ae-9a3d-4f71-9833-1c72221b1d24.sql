
CREATE OR REPLACE FUNCTION public.is_active_user()
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT is_active FROM public.profiles
     WHERE user_id = auth.uid() LIMIT 1),
    false
  );
$$;
