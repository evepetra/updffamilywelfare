REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_valid_nin(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM anon, PUBLIC;