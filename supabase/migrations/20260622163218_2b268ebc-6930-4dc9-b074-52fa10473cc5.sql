ALTER TABLE public.support_requests ADD CONSTRAINT support_requests_status_check CHECK (status IN ('pending','verifying','approved','rejected','completed','cancelled'));

ALTER TABLE public.aid_ledger ADD CONSTRAINT aid_ledger_status_check CHECK (status IN ('pending','approved','disbursed','rejected'));