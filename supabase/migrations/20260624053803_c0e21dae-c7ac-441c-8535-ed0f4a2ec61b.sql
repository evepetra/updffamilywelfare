
CREATE TABLE public.request_status_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.support_requests(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  old_status text,
  new_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.request_status_audit TO authenticated;
GRANT ALL ON public.request_status_audit TO service_role;

ALTER TABLE public.request_status_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read status audit"
  ON public.request_status_audit FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'officer') OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.tg_audit_request_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.request_status_audit (request_id, actor_id, old_status, new_status)
    VALUES (NEW.id, auth.uid(), OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_request_status ON public.support_requests;
CREATE TRIGGER audit_request_status
  AFTER UPDATE ON public.support_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_request_status();
