
-- Add payout account fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payout_method text,
  ADD COLUMN IF NOT EXISTS payout_provider text,
  ADD COLUMN IF NOT EXISTS payout_account_name text,
  ADD COLUMN IF NOT EXISTS payout_account_number text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_payout_method_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_payout_method_check
  CHECK (payout_method IS NULL OR payout_method IN ('bank','mobile_money'));

-- Track approved-amount on requests so admin knows how much to disburse
ALTER TABLE public.support_requests
  ADD COLUMN IF NOT EXISTS amount_approved numeric;

-- Link ledger entries to their originating request and capture snapshot
ALTER TABLE public.aid_ledger
  ADD COLUMN IF NOT EXISTS request_id uuid REFERENCES public.support_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payout_method text,
  ADD COLUMN IF NOT EXISTS payout_provider text,
  ADD COLUMN IF NOT EXISTS payout_account_name text,
  ADD COLUMN IF NOT EXISTS payout_account_number text;

-- Restrict ledger writes to admins only (officers approve; admins disburse)
DROP POLICY IF EXISTS "Staff insert ledger v2" ON public.aid_ledger;
DROP POLICY IF EXISTS "Staff update ledger v2" ON public.aid_ledger;
DROP POLICY IF EXISTS "Staff insert ledger" ON public.aid_ledger;
DROP POLICY IF EXISTS "Staff update ledger" ON public.aid_ledger;
DROP POLICY IF EXISTS "Admins insert ledger" ON public.aid_ledger;
DROP POLICY IF EXISTS "Admins update ledger" ON public.aid_ledger;

CREATE POLICY "Admins insert ledger"
ON public.aid_ledger FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'admin')
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = aid_ledger.recipient_user_id)
);

CREATE POLICY "Admins update ledger"
ON public.aid_ledger FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (
  public.has_role(auth.uid(),'admin')
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = aid_ledger.recipient_user_id)
);
