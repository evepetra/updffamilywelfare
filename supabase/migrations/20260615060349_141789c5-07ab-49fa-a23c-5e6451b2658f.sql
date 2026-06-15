-- 1. Fix support_requests update policy
DROP POLICY IF EXISTS "Owners update own pending requests" ON public.support_requests;

CREATE POLICY "Owners update own pending requests"
ON public.support_requests FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id AND status IN ('pending', 'cancelled'));

CREATE POLICY "Staff update any request"
ON public.support_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'officer') OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'officer') OR public.has_role(auth.uid(), 'admin'));

-- 2. Audit log for role changes
CREATE TABLE public.role_change_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  target_user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.role_change_audit TO authenticated;
GRANT ALL ON public.role_change_audit TO service_role;
ALTER TABLE public.role_change_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view role audit"
ON public.role_change_audit FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.tg_audit_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.role_change_audit (actor_id, target_user_id, role, action)
    VALUES (auth.uid(), OLD.user_id, OLD.role, 'delete');
    RETURN OLD;
  ELSE
    INSERT INTO public.role_change_audit (actor_id, target_user_id, role, action)
    VALUES (auth.uid(), NEW.user_id, NEW.role, lower(TG_OP));
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_user_roles_audit
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_role_change();