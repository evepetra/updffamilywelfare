
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS family_member_full_name text,
  ADD COLUMN IF NOT EXISTS family_member_nin text,
  ADD COLUMN IF NOT EXISTS family_member_region text,
  ADD COLUMN IF NOT EXISTS family_member_relationship text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_family_member_region_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_family_member_region_check
  CHECK (family_member_region IS NULL OR family_member_region IN ('Central','Western','Northern','Eastern','West Nile'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_family_member_relationship_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_family_member_relationship_check
  CHECK (family_member_relationship IS NULL OR family_member_relationship IN (
    'Father','Mother','Wife','Husband','Son','Daughter',
    'Brother','Sister','Aunt','Uncle','Cousin','Other'
  ));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_family_member_nin_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_family_member_nin_check
  CHECK (family_member_nin IS NULL OR upper(family_member_nin) ~ '^C[MF][A-Z0-9]{12}$');

-- Allow soldiers (members) to update these new fields from their dashboard.
CREATE OR REPLACE FUNCTION public.tg_restrict_family_profile_updates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_is_staff boolean := false;
  v_is_soldier boolean := false;
BEGIN
  IF v_actor IS NULL THEN
    RETURN NEW;
  END IF;

  v_is_staff :=
    public.has_role(v_actor, 'admin')
    OR public.has_role(v_actor, 'system_admin')
    OR public.has_role(v_actor, 'officer');

  IF v_is_staff THEN
    RETURN NEW;
  END IF;

  v_is_soldier := public.has_role(v_actor, 'soldier');

  IF v_actor = NEW.id THEN
    -- Identity / military fields stay locked for self-service edits.
    IF NEW.nin IS DISTINCT FROM OLD.nin
       OR NEW.army_number IS DISTINCT FROM OLD.army_number
       OR NEW.service_number IS DISTINCT FROM OLD.service_number
       OR NEW.service IS DISTINCT FROM OLD.service
       OR NEW.rank IS DISTINCT FROM OLD.rank
    THEN
      RAISE EXCEPTION 'Members can only update full name, region, and dependant details from the dashboard';
    END IF;

    -- Family (non-soldier) members may not change soldier-relationship fields.
    IF NOT v_is_soldier THEN
      IF NEW.relationship_to_soldier IS DISTINCT FROM OLD.relationship_to_soldier
         OR NEW.related_soldier_service_number IS DISTINCT FROM OLD.related_soldier_service_number
         OR NEW.related_soldier_rank IS DISTINCT FROM OLD.related_soldier_rank
         OR NEW.related_soldier_full_name IS DISTINCT FROM OLD.related_soldier_full_name
         OR NEW.related_soldier_service IS DISTINCT FROM OLD.related_soldier_service
         OR NEW.family_member_full_name IS DISTINCT FROM OLD.family_member_full_name
         OR NEW.family_member_nin IS DISTINCT FROM OLD.family_member_nin
         OR NEW.family_member_region IS DISTINCT FROM OLD.family_member_region
         OR NEW.family_member_relationship IS DISTINCT FROM OLD.family_member_relationship
      THEN
        RAISE EXCEPTION 'Family members can only update full name and region from their dashboard';
      END IF;
    END IF;

    IF NEW.region IS NULL OR btrim(NEW.region) = '' THEN
      RAISE EXCEPTION 'Region is required';
    END IF;
    IF NEW.region !~ '^(Central|Western|Northern|Eastern|West Nile)$' THEN
      RAISE EXCEPTION 'Invalid region: choose Central, Western, Northern, Eastern, or West Nile';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
