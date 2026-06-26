
-- 1. Extend role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'soldier';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'system_admin';

COMMIT;
BEGIN;

-- 2. Tighten user_roles management: only system_admin may grant/revoke admin or system_admin
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

CREATE POLICY "Admins manage non-privileged roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND role NOT IN ('admin','system_admin')
);

CREATE POLICY "Admins delete non-privileged roles"
ON public.user_roles FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND role NOT IN ('admin','system_admin')
);

CREATE POLICY "System admins manage all roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'system_admin'));

CREATE POLICY "System admins update all roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'system_admin'))
WITH CHECK (public.has_role(auth.uid(), 'system_admin'));

CREATE POLICY "System admins delete all roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'system_admin'));

-- 3. system_admin can read all roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users and admins view roles"
ON public.user_roles FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'system_admin')
);

-- 4. Treat soldier like family across data policies (soldier = beneficiary)
--    Existing self-scoped policies (auth.uid()=user_id) already cover soldiers.
--    Extend welfare-officer/admin read scopes to include system_admin where applicable.
DROP POLICY IF EXISTS "Recipients and staff can read" ON public.aid_ledger;
CREATE POLICY "Recipients and staff can read"
ON public.aid_ledger FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'officer')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'system_admin')
  OR (auth.uid() = recipient_user_id AND status = ANY (ARRAY['approved','disbursed']))
);

DROP POLICY IF EXISTS "Officers and admins can view all profiles" ON public.profiles;
CREATE POLICY "Staff view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'officer')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'system_admin')
);

DROP POLICY IF EXISTS "Officers and admins read all documents" ON public.request_documents;
CREATE POLICY "Staff read all documents"
ON public.request_documents FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'officer')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'system_admin')
);

DROP POLICY IF EXISTS "Staff can read status audit" ON public.request_status_audit;
CREATE POLICY "Staff read status audit"
ON public.request_status_audit FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'officer')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'system_admin')
);

DROP POLICY IF EXISTS "Admins can view role audit" ON public.role_change_audit;
CREATE POLICY "Admins view role audit"
ON public.role_change_audit FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'system_admin')
);

DROP POLICY IF EXISTS "Admins can read all login attempts" ON public.login_audit;
CREATE POLICY "Admins read login audit"
ON public.login_audit FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'system_admin')
);

DROP POLICY IF EXISTS "Owners read own requests" ON public.support_requests;
CREATE POLICY "Owners and staff read requests"
ON public.support_requests FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'officer')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'system_admin')
);

-- 5. Update handle_new_user to support soldier self-signup (same as family permissions)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_full_name text := COALESCE(NEW.raw_user_meta_data ->> 'full_name', '');
  v_service_number text := upper(COALESCE(NEW.raw_user_meta_data ->> 'service_number', ''));
  v_nin text := upper(COALESCE(NEW.raw_user_meta_data ->> 'nin', ''));
  v_army_number text := upper(COALESCE(NEW.raw_user_meta_data ->> 'army_number', ''));
  v_rank text := COALESCE(NEW.raw_user_meta_data ->> 'rank', '');
  v_role text := lower(COALESCE(NEW.raw_user_meta_data ->> 'signup_role', ''));
  v_admin_created boolean :=
    COALESCE((NEW.raw_user_meta_data ->> 'admin_created')::boolean, false)
    OR v_role = '';
  army_re text := '^(RA|RAV)/[0-9]{6}$|^(RO|ROV)/[0-9]{5}$';
  service_re text := '^(RA|RAV)/[0-9]{6}$|^(RO|ROV)/[0-9]{5}$|^CIV/[A-Za-z0-9-]{1,32}$';
BEGIN
  IF v_service_number <> '' AND v_service_number !~ service_re THEN
    RAISE EXCEPTION 'Invalid service number: RA/RAV need 6 digits, RO/ROV need 5 digits, or use CIV/ prefix';
  END IF;

  IF NOT v_admin_created THEN
    -- Self-signup is restricted to family and soldier
    IF v_role NOT IN ('family','soldier') THEN
      RAISE EXCEPTION 'Self-registration is only allowed for family or soldier accounts';
    END IF;
    IF v_nin = '' OR v_nin !~ '^C[MF][A-Z0-9]{12}$' THEN
      RAISE EXCEPTION 'Invalid National ID Number (NIN): must be 14 characters starting with CM or CF';
    END IF;
    IF v_role = 'soldier' AND (v_army_number = '' OR v_army_number !~ army_re) THEN
      RAISE EXCEPTION 'Soldier accounts require a valid Army Number: RA/ or RAV/ + 6 digits, or RO/ or ROV/ + 5 digits';
    END IF;
  ELSE
    IF v_nin <> '' AND v_nin !~ '^C[MF][A-Z0-9]{12}$' THEN
      RAISE EXCEPTION 'Invalid National ID Number (NIN): must be 14 characters starting with CM or CF';
    END IF;
    IF v_army_number <> '' AND v_army_number !~ army_re THEN
      RAISE EXCEPTION 'Invalid Army Number: RA/ or RAV/ + 6 digits, or RO/ or ROV/ + 5 digits';
    END IF;
  END IF;

  INSERT INTO public.profiles (id, full_name, service_number, nin, army_number, rank)
  VALUES (
    NEW.id,
    v_full_name,
    NULLIF(v_service_number, ''),
    NULLIF(v_nin, ''),
    NULLIF(v_army_number, ''),
    NULLIF(v_rank, '')
  );

  IF v_admin_created AND v_role IN ('family','soldier','officer','admin','system_admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role::app_role);
  ELSIF v_role = 'soldier' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'soldier');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'family');
  END IF;

  RETURN NEW;
END;
$function$;
