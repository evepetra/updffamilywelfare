
-- Replace insert/update policies to validate recipient_user_id against profiles
DROP POLICY IF EXISTS "Staff insert ledger" ON public.aid_ledger;
DROP POLICY IF EXISTS "Staff update ledger" ON public.aid_ledger;

CREATE POLICY "Staff insert ledger"
ON public.aid_ledger
FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'officer'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND (
    recipient_user_id IS NULL
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = recipient_user_id)
  )
);

CREATE POLICY "Staff update ledger"
ON public.aid_ledger
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'officer'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (
  (has_role(auth.uid(), 'officer'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND (
    recipient_user_id IS NULL
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = recipient_user_id)
  )
);

-- Restrict recipient SELECT to approved/disbursed entries only; staff still see everything
DROP POLICY IF EXISTS "Recipients and staff can read" ON public.aid_ledger;

CREATE POLICY "Recipients and staff can read"
ON public.aid_ledger
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'officer'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (
    auth.uid() = recipient_user_id
    AND status IN ('approved', 'disbursed')
  )
);
