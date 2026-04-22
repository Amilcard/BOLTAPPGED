-- ROLLBACK 086 — restaure les 5 tables zombies gd_suivi_*
--
-- ATTENTION : les données sont perdues (0 rows au moment du DROP, donc no-op).
-- Ce rollback recrée la structure pour compatibilité typage uniquement.
--
-- Schémas reconstitués depuis types/database.types.ts état 2026-04-22
-- (avant migration 086).

BEGIN;

CREATE TABLE IF NOT EXISTS public.gd_suivi_sejour (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inscription_id UUID REFERENCES public.gd_inscriptions(id) ON DELETE CASCADE,
  structure_id UUID REFERENCES public.gd_structures(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gd_suivi_sejour ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.gd_suivi_appels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inscription_id UUID REFERENCES public.gd_inscriptions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gd_suivi_appels ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.gd_suivi_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inscription_id UUID REFERENCES public.gd_inscriptions(id) ON DELETE CASCADE,
  structure_id UUID REFERENCES public.gd_structures(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gd_suivi_incidents ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.gd_suivi_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inscription_id UUID REFERENCES public.gd_inscriptions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gd_suivi_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.gd_suivi_medical (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inscription_id UUID REFERENCES public.gd_inscriptions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gd_suivi_medical ENABLE ROW LEVEL SECURITY;

COMMIT;
