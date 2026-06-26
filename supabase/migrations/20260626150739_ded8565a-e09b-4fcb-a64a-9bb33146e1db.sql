
-- 1) Enforce recipient_user_id NOT NULL on aid_ledger
ALTER TABLE public.aid_ledger
  ALTER COLUMN recipient_user_id SET NOT NULL;

-- 2) Allow request owners to read their own request_status_audit rows
CREATE POLICY "Owners read own request status history"
ON public.request_status_audit
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.support_requests sr
    WHERE sr.id = request_status_audit.request_id
      AND sr.user_id = auth.uid()
  )
);
