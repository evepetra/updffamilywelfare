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
  v_role text := lower(COALESCE(NEW.raw_user_meta_data ->> 'signup_role', 'family'));
  v_admin_created boolean := COALESCE((NEW.raw_user_meta_data ->> 'admin_created')::boolean, false);
BEGIN
  IF v_service_number <> ''
     AND v_service_number !~ '^(RA|RO|RAV|ROV|CIV)/[A-Za-z0-9-]{1,32}$' THEN
    RAISE EXCEPTION 'Invalid service number: must start with RA/, RO/, RAV/, ROV/ or CIV/';
  END IF;

  IF NOT v_admin_created THEN
    -- Self-signup: NIN is mandatory and must match Uganda NIN format
    IF v_nin = '' OR v_nin !~ '^C[MF][A-Z0-9]{12}$' THEN
      RAISE EXCEPTION 'Invalid National ID Number (NIN): must be 14 characters starting with CM or CF';
    END IF;

    -- Soldier self-signup also requires an Army number
    IF v_role = 'officer' AND (v_army_number = '' OR v_army_number !~ '^(RA|RO|RAV|ROV)/[A-Za-z0-9-]{1,32}$') THEN
      RAISE EXCEPTION 'Soldier accounts require a valid Army Number (RA/, RO/, RAV/ or ROV/)';
    END IF;
  ELSE
    -- Admin-created: NIN/Army number optional, but if supplied must still be valid
    IF v_nin <> '' AND v_nin !~ '^C[MF][A-Z0-9]{12}$' THEN
      RAISE EXCEPTION 'Invalid National ID Number (NIN): must be 14 characters starting with CM or CF';
    END IF;
    IF v_army_number <> '' AND v_army_number !~ '^(RA|RO|RAV|ROV)/[A-Za-z0-9-]{1,32}$' THEN
      RAISE EXCEPTION 'Invalid Army Number: must start with RA/, RO/, RAV/ or ROV/';
    END IF;
  END IF;

  INSERT INTO public.profiles (id, full_name, service_number, nin, army_number)
  VALUES (
    NEW.id,
    v_full_name,
    NULLIF(v_service_number, ''),
    NULLIF(v_nin, ''),
    NULLIF(v_army_number, '')
  );

  IF v_admin_created AND v_role IN ('family', 'officer', 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role::app_role);
  ELSE
    -- Self-signup: always family. Officer/admin roles are granted by directorate.
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'family');
  END IF;

  RETURN NEW;
END;
$function$;