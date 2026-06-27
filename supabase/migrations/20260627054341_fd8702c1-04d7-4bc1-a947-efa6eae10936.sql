
-- Defense-in-depth: explicit RESTRICTIVE policies that hard-block any user
-- whose ONLY privileged role is system_admin from writing to support_requests
-- status changes (approve/reject) or aid_ledger (disburse). This stacks on top
-- of the existing permissive policies which already require officer/admin.

-- support_requests UPDATE: must hold officer OR admin (system_admin alone is rejected)
DROP POLICY IF EXISTS "Block system_admin only from request updates" ON public.support_requests;
CREATE POLICY "Block system_admin only from request updates"
  ON public.support_requests
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'officer'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'officer'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- aid_ledger INSERT/UPDATE/DELETE: must hold admin (system_admin alone is rejected)
DROP POLICY IF EXISTS "Block system_admin only from ledger writes ins" ON public.aid_ledger;
CREATE POLICY "Block system_admin only from ledger writes ins"
  ON public.aid_ledger
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Block system_admin only from ledger writes upd" ON public.aid_ledger;
CREATE POLICY "Block system_admin only from ledger writes upd"
  ON public.aid_ledger
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Block system_admin only from ledger writes del" ON public.aid_ledger;
CREATE POLICY "Block system_admin only from ledger writes del"
  ON public.aid_ledger
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
