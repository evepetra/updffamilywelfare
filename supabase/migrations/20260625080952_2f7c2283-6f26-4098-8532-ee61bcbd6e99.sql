-- Convert has_role to SECURITY INVOKER (users can read their own user_roles row via RLS,
-- and policies always call has_role(auth.uid(), ...), so invoker semantics are sufficient).
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Drop the SECURITY DEFINER admin RPC; admin listing is now served by a
-- TanStack server function that uses the service-role client behind an auth+role check.
DROP FUNCTION IF EXISTS public.admin_list_users();
