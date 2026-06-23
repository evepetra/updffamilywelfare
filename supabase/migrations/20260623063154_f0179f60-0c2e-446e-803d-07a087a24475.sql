
-- Helper RPC for the admin console: list all users with their roles + email.
-- SECURITY DEFINER so it can read auth.users; gated to admins only.
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  service_number text,
  roles app_role[],
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin access required';
  END IF;

  RETURN QUERY
    SELECT
      u.id,
      u.email::text,
      COALESCE(p.full_name, '') AS full_name,
      COALESCE(p.service_number, '') AS service_number,
      COALESCE(
        (SELECT array_agg(ur.role ORDER BY ur.role)
         FROM public.user_roles ur WHERE ur.user_id = u.id),
        ARRAY[]::app_role[]
      ) AS roles,
      u.created_at
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
