
-- 1) Add rank column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rank text;

-- 2) Updated handle_new_user with stricter army-number rules and rank capture
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
  -- Strict army-number rule: RA/RAV require 6 digits, RO/ROV require 5 digits.
  army_re text := '^(RA|RAV)/[0-9]{6}$|^(RO|ROV)/[0-9]{5}$';
  -- Service numbers additionally permit the CIV/ civilian prefix.
  service_re text := '^(RA|RAV)/[0-9]{6}$|^(RO|ROV)/[0-9]{5}$|^CIV/[A-Za-z0-9-]{1,32}$';
BEGIN
  IF v_service_number <> '' AND v_service_number !~ service_re THEN
    RAISE EXCEPTION 'Invalid service number: RA/RAV need 6 digits, RO/ROV need 5 digits, or use CIV/ prefix';
  END IF;

  IF NOT v_admin_created THEN
    IF v_nin = '' OR v_nin !~ '^C[MF][A-Z0-9]{12}$' THEN
      RAISE EXCEPTION 'Invalid National ID Number (NIN): must be 14 characters starting with CM or CF';
    END IF;
    IF v_role = 'officer' AND (v_army_number = '' OR v_army_number !~ army_re) THEN
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

  IF v_admin_created AND v_role IN ('family', 'officer', 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role::app_role);
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'family');
  END IF;

  RETURN NEW;
END;
$function$;
