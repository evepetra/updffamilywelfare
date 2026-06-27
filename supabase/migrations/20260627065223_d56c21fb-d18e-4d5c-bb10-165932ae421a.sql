CREATE INDEX IF NOT EXISTS idx_profiles_service ON public.profiles (service);
CREATE INDEX IF NOT EXISTS idx_profiles_service_full_name ON public.profiles (service, full_name);
CREATE INDEX IF NOT EXISTS idx_profiles_service_created_at ON public.profiles (service, created_at DESC);