
-- 1. Prevent self privilege escalation on user_roles (restrictive)
CREATE POLICY "No self role grants" ON public.user_roles
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (user_id <> auth.uid());

CREATE POLICY "No self role updates" ON public.user_roles
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (user_id <> auth.uid())
  WITH CHECK (user_id <> auth.uid());

-- 2. Lock role_change_audit writes (populated only via SECURITY DEFINER trigger)
CREATE POLICY "Block audit inserts" ON public.role_change_audit
  AS RESTRICTIVE FOR INSERT TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "Block audit updates" ON public.role_change_audit
  AS RESTRICTIVE FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE POLICY "Block audit deletes" ON public.role_change_audit
  AS RESTRICTIVE FOR DELETE TO authenticated, anon
  USING (false);

-- 3. Storage: UPDATE policy on support-documents bucket
CREATE POLICY "Families update own files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'support-documents' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'support-documents' AND (auth.uid())::text = (storage.foldername(name))[1]);
