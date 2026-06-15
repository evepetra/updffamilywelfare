
CREATE TABLE public.request_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.support_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.request_documents TO authenticated;
GRANT ALL ON public.request_documents TO service_role;

ALTER TABLE public.request_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own documents"
  ON public.request_documents FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Officers and admins read all documents"
  ON public.request_documents FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'officer') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners insert own documents"
  ON public.request_documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners delete own documents"
  ON public.request_documents FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX request_documents_request_id_idx ON public.request_documents(request_id);

-- Storage policies on support-documents bucket
-- Path convention: {user_id}/{request_id}/{filename}

CREATE POLICY "Families upload to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'support-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Families read own files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'support-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Families delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'support-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Officers and admins read all support files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'support-documents'
    AND (public.has_role(auth.uid(), 'officer') OR public.has_role(auth.uid(), 'admin'))
  );
