ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_service_number_format
  CHECK (
    service_number = ''
    OR service_number ~ '^(RA|RO|RAV|ROV|CIV)/[A-Za-z0-9-]{1,32}$'
  );

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_full_name text := COALESCE(NEW.raw_user_meta_data ->> 'full_name', '');
  v_service_number text := upper(COALESCE(NEW.raw_user_meta_data ->> 'service_number', ''));
BEGIN
  IF v_service_number <> ''
     AND v_service_number !~ '^(RA|RO|RAV|ROV|CIV)/[A-Za-z0-9-]{1,32}$' THEN
    RAISE EXCEPTION 'Invalid service number: must start with RA/, RO/, RAV/, ROV/ or CIV/';
  END IF;

  INSERT INTO public.profiles (id, full_name, service_number)
  VALUES (NEW.id, v_full_name, v_service_number);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'family');
  RETURN NEW;
END;
$function$;