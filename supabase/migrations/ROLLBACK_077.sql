-- Rollback migration 077
ALTER TABLE public.gd_stays ADD CONSTRAINT gd_stays_slug_unique UNIQUE (slug);
