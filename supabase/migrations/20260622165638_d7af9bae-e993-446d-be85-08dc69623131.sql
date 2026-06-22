
-- 1. Login audit table
CREATE TABLE IF NOT EXISTS public.login_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text,
  requested_role text NOT NULL CHECK (requested_role IN ('family','officer','admin')),
  outcome text NOT NULL CHECK (outcome IN ('success','failure')),
  reason text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.login_audit TO authenticated;
GRANT ALL ON public.login_audit TO service_role;

ALTER TABLE public.login_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own login attempts"
  ON public.login_audit FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Admins can read all login attempts"
  ON public.login_audit FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read their own login attempts"
  ON public.login_audit FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_login_audit_created_at ON public.login_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_audit_user ON public.login_audit (user_id);
CREATE INDEX IF NOT EXISTS idx_login_audit_outcome ON public.login_audit (outcome);

-- 2. Stricter NIN constraint on profiles (Uganda format: CM/CF + 12 alphanumerics = 14 chars)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_nin_format_chk;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_nin_format_chk
  CHECK (nin IS NULL OR nin ~ '^C[MF][A-Z0-9]{12}$');

-- 3. Helper to validate NIN server-side
CREATE OR REPLACE FUNCTION public.is_valid_nin(_nin text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT _nin IS NOT NULL AND upper(_nin) ~ '^C[MF][A-Z0-9]{12}$';
$$;
