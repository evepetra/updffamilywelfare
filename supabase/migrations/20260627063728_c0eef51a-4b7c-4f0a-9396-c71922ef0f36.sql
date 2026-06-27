
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS service text;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_service_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_service_check
  CHECK (service IS NULL OR service IN ('Air Force','SFC','Land Force','Reserve Force'));

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
  v_region text := COALESCE(NEW.raw_user_meta_data ->> 'region', '');
  v_service text := COALESCE(NEW.raw_user_meta_data ->> 'service', '');
  v_role text := lower(COALESCE(NEW.raw_user_meta_data ->> 'signup_role', ''));
  v_admin_created boolean :=
    COALESCE((NEW.raw_user_meta_data ->> 'admin_created')::boolean, false)
    OR v_role = '';
  army_re text := '^(RA|RAV)/[0-9]{6}$|^(RO|ROV)/[0-9]{5}$';
  service_re text := '^(RA|RAV)/[0-9]{6}$|^(RO|ROV)/[0-9]{5}$|^CIV/[A-Za-z0-9-]{1,32}$';
  region_re text := '^(Central|Western|Northern|Eastern|West Nile)$';
  branch_re text := '^(Air Force|SFC|Land Force|Reserve Force)$';
BEGIN
  IF v_service_number <> '' AND v_service_number !~ service_re THEN
    RAISE EXCEPTION 'Invalid service number: RA/RAV need 6 digits, RO/ROV need 5 digits, or use CIV/ prefix';
  END IF;

  IF NOT v_admin_created THEN
    IF v_role NOT IN ('family','soldier') THEN
      RAISE EXCEPTION 'Self-registration is only allowed for family or soldier accounts';
    END IF;
    IF v_nin = '' OR v_nin !~ '^C[MF][A-Z0-9]{12}$' THEN
      RAISE EXCEPTION 'Invalid National ID Number (NIN): must be 14 characters starting with CM or CF';
    END IF;
    IF v_role = 'soldier' AND (v_army_number = '' OR v_army_number !~ army_re) THEN
      RAISE EXCEPTION 'Soldier accounts require a valid Army Number: RA/ or RAV/ + 6 digits, or RO/ or ROV/ + 5 digits';
    END IF;
    IF v_role = 'soldier' AND (v_service = '' OR v_service !~ branch_re) THEN
      RAISE EXCEPTION 'Soldier accounts require a UPDF service: Air Force, SFC, Land Force, or Reserve Force';
    END IF;
    IF v_region = '' OR v_region !~ region_re THEN
      RAISE EXCEPTION 'Region is required: choose Central, Western, Northern, Eastern, or West Nile';
    END IF;
  ELSE
    IF v_nin <> '' AND v_nin !~ '^C[MF][A-Z0-9]{12}$' THEN
      RAISE EXCEPTION 'Invalid National ID Number (NIN): must be 14 characters starting with CM or CF';
    END IF;
    IF v_army_number <> '' AND v_army_number !~ army_re THEN
      RAISE EXCEPTION 'Invalid Army Number: RA/ or RAV/ + 6 digits, or RO/ or ROV/ + 5 digits';
    END IF;
    IF v_region <> '' AND v_region !~ region_re THEN
      RAISE EXCEPTION 'Invalid region: choose Central, Western, Northern, Eastern, or West Nile';
    END IF;
    IF v_service <> '' AND v_service !~ branch_re THEN
      RAISE EXCEPTION 'Invalid service: choose Air Force, SFC, Land Force, or Reserve Force';
    END IF;
  END IF;

  INSERT INTO public.profiles (id, full_name, service_number, nin, army_number, rank, region, service)
  VALUES (
    NEW.id,
    v_full_name,
    NULLIF(v_service_number, ''),
    NULLIF(v_nin, ''),
    NULLIF(v_army_number, ''),
    NULLIF(v_rank, ''),
    NULLIF(v_region, ''),
    NULLIF(v_service, '')
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
