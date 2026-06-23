GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_valid_nin(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated, service_role;