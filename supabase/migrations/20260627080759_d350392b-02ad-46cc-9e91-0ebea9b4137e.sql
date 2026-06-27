
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS relationship_to_soldier text,
  ADD COLUMN IF NOT EXISTS related_soldier_full_name text,
  ADD COLUMN IF NOT EXISTS related_soldier_service_number text,
  ADD COLUMN IF NOT EXISTS related_soldier_rank text,
  ADD COLUMN IF NOT EXISTS related_soldier_service text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_relationship_to_soldier_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_relationship_to_soldier_check
  CHECK (
    relationship_to_soldier IS NULL OR relationship_to_soldier IN (
      'Father','Mother','Wife','Husband','Son','Daughter',
      'Brother','Sister','Aunt','Uncle','Cousin','Other'
    )
  );

ALTER TABLE public.support_requests
  ADD COLUMN IF NOT EXISTS requested_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS payment_method text;

ALTER TABLE public.support_requests
  DROP CONSTRAINT IF EXISTS support_requests_payment_method_check;
ALTER TABLE public.support_requests
  ADD CONSTRAINT support_requests_payment_method_check
  CHECK (
    payment_method IS NULL OR payment_method IN ('mobile_money','bank_transfer')
  );

ALTER TABLE public.support_requests
  DROP CONSTRAINT IF EXISTS support_requests_mobile_money_cap_check;
ALTER TABLE public.support_requests
  ADD CONSTRAINT support_requests_mobile_money_cap_check
  CHECK (
    payment_method IS DISTINCT FROM 'mobile_money'
    OR requested_amount IS NULL
    OR requested_amount <= 7000000
  );

ALTER TABLE public.support_requests
  DROP CONSTRAINT IF EXISTS support_requests_requested_amount_check;
ALTER TABLE public.support_requests
  ADD CONSTRAINT support_requests_requested_amount_check
  CHECK (requested_amount IS NULL OR requested_amount >= 0);
