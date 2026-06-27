
CREATE OR REPLACE FUNCTION public.tg_restrict_family_profile_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_is_staff boolean := false;
BEGIN
  -- Service role / triggers with no auth context: allow.
  IF v_actor IS NULL THEN
    RETURN NEW;
  END IF;

  -- Staff bypass (admins, system admins, welfare officers).
  v_is_staff :=
    public.has_role(v_actor, 'admin')
    OR public.has_role(v_actor, 'system_admin')
    OR public.has_role(v_actor, 'officer');

  IF v_is_staff THEN
    RETURN NEW;
  END IF;

  -- Members editing their OWN row are limited to full_name and region.
  IF v_actor = NEW.id THEN
    IF NEW.nin IS DISTINCT FROM OLD.nin
       OR NEW.army_number IS DISTINCT FROM OLD.army_number
       OR NEW.service_number IS DISTINCT FROM OLD.service_number
       OR NEW.service IS DISTINCT FROM OLD.service
       OR NEW.rank IS DISTINCT FROM OLD.rank
       OR NEW.relationship_to_soldier IS DISTINCT FROM OLD.relationship_to_soldier
       OR NEW.soldier_service_number IS DISTINCT FROM OLD.soldier_service_number
       OR NEW.soldier_rank IS DISTINCT FROM OLD.soldier_rank
       OR NEW.soldier_full_name IS DISTINCT FROM OLD.soldier_full_name
       OR NEW.soldier_service IS DISTINCT FROM OLD.soldier_service
    THEN
      RAISE EXCEPTION 'Members can only update full name and region from their dashboard';
    END IF;

    -- Region must be set and one of the allowed values.
    IF NEW.region IS NULL OR btrim(NEW.region) = '' THEN
      RAISE EXCEPTION 'Region is required';
    END IF;
    IF NEW.region !~ '^(Central|Western|Northern|Eastern|West Nile)$' THEN
      RAISE EXCEPTION 'Invalid region: choose Central, Western, Northern, Eastern, or West Nile';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_family_profile_updates ON public.profiles;
CREATE TRIGGER trg_restrict_family_profile_updates
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.tg_restrict_family_profile_updates();
