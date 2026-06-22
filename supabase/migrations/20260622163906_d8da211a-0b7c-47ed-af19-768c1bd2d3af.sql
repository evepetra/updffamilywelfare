
-- Add NIN and army number to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nin text,
  ADD COLUMN IF NOT EXISTS army_number text;

-- Update signup trigger to capture NIN and army number, with validation
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
BEGIN
  IF v_service_number <> ''
     AND v_service_number !~ '^(RA|RO|RAV|ROV|CIV)/[A-Za-z0-9-]{1,32}$' THEN
    RAISE EXCEPTION 'Invalid service number: must start with RA/, RO/, RAV/, ROV/ or CIV/';
  END IF;

  -- NIN is mandatory for every signup; must match Uganda NIN format (14 chars, starts with CM or CF)
  IF v_nin = '' OR v_nin !~ '^C[MF][A-Z0-9]{12}$' THEN
    RAISE EXCEPTION 'Invalid National ID Number (NIN): must be 14 characters starting with CM or CF';
  END IF;

  -- Soldier (officer) signups also require an Army number
  IF v_role = 'officer' AND (v_army_number = '' OR v_army_number !~ '^(RA|RO|RAV|ROV)/[A-Za-z0-9-]{1,32}$') THEN
    RAISE EXCEPTION 'Soldier accounts require a valid Army Number (RA/, RO/, RAV/ or ROV/)';
  END IF;

  INSERT INTO public.profiles (id, full_name, service_number, nin, army_number)
  VALUES (
    NEW.id,
    v_full_name,
    NULLIF(v_service_number, ''),
    v_nin,
    NULLIF(v_army_number, '')
  );

  -- Always create as family. Officer/admin roles are granted by directorate, not self-assigned.
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'family');
  RETURN NEW;
END;
$function$;
