DROP POLICY IF EXISTS "Users can insert their own login attempts" ON public.login_audit;
REVOKE INSERT ON public.login_audit FROM authenticated;