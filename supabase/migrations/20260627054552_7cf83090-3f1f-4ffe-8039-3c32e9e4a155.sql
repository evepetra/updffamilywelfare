
-- 1. Reason fields on operational tables
ALTER TABLE public.support_requests
  ADD COLUMN IF NOT EXISTS decision_reason text;

ALTER TABLE public.request_status_audit
  ADD COLUMN IF NOT EXISTS reason text;

ALTER TABLE public.aid_ledger
  ADD COLUMN IF NOT EXISTS reason text;

-- 2. Update the request-status audit trigger to capture decision_reason
CREATE OR REPLACE FUNCTION public.tg_audit_request_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.request_status_audit (request_id, actor_id, old_status, new_status, reason)
    VALUES (NEW.id, auth.uid(), OLD.status, NEW.status, NEW.decision_reason);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_request_status ON public.support_requests;
CREATE TRIGGER trg_audit_request_status
AFTER UPDATE ON public.support_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_request_status();

-- 3. New aid_ledger_audit table
CREATE TABLE IF NOT EXISTS public.aid_ledger_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,                 -- insert | update
  old_status text,
  new_status text,
  amount numeric,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.aid_ledger_audit TO authenticated;
GRANT ALL ON public.aid_ledger_audit TO service_role;
ALTER TABLE public.aid_ledger_audit ENABLE ROW LEVEL SECURITY;

-- Only privileged roles may read
DROP POLICY IF EXISTS "Staff can view ledger audit" ON public.aid_ledger_audit;
CREATE POLICY "Staff can view ledger audit"
  ON public.aid_ledger_audit
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'officer'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'system_admin'::app_role)
  );

-- No direct inserts/updates/deletes from clients — trigger-only
DROP POLICY IF EXISTS "Block direct writes to ledger audit" ON public.aid_ledger_audit;
CREATE POLICY "Block direct writes to ledger audit"
  ON public.aid_ledger_audit
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- 4. Trigger that records all ledger changes
CREATE OR REPLACE FUNCTION public.tg_audit_aid_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.aid_ledger_audit (ledger_id, actor_id, action, old_status, new_status, amount, reason)
    VALUES (NEW.id, auth.uid(), 'insert', NULL, NEW.status, NEW.amount, NEW.reason);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.aid_ledger_audit (ledger_id, actor_id, action, old_status, new_status, amount, reason)
    VALUES (NEW.id, auth.uid(), 'update', OLD.status, NEW.status, NEW.amount, NEW.reason);
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_aid_ledger ON public.aid_ledger;
CREATE TRIGGER trg_audit_aid_ledger
AFTER INSERT OR UPDATE ON public.aid_ledger
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_aid_ledger();
