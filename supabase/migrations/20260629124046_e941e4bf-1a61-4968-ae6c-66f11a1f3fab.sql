-- Restrict role grants/revokes to system_admin only. Admin can no longer manage roles.
DROP POLICY IF EXISTS "Admins manage non-privileged roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins delete non-privileged roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
-- Keep only system_admin write policies (already exist):
--   "System admins manage all roles" (INSERT)
--   "System admins update all roles" (UPDATE)
--   "System admins delete all roles" (DELETE)
