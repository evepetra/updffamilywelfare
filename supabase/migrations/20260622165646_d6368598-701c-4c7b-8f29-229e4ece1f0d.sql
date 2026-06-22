CREATE OR REPLACE FUNCTION public.is_valid_nin(_nin text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT _nin IS NOT NULL AND upper(_nin) ~ '^C[MF][A-Z0-9]{12}$';
$$;