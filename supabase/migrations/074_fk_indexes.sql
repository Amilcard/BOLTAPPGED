-- Migration 074: Add missing FK indexes (Supabase Advisor — performance/unindexed_foreign_keys)
-- Non-blocking: CONCURRENTLY + IF NOT EXISTS
-- 5 distinct (table, column) pairs; fk_inscriptions_stay and gd_inscriptions_sejour_slug_fkey
-- both cover gd_inscriptions.sejour_slug — one index satisfies both constraints.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gd_educateur_emails_structure_id
  ON public.gd_educateur_emails(structure_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gd_inscriptions_sejour_slug
  ON public.gd_inscriptions(sejour_slug);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gd_suivi_incidents_structure_id
  ON public.gd_suivi_incidents(structure_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gd_suivi_sejour_structure_id
  ON public.gd_suivi_sejour(structure_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gd_wishes_sejour_slug
  ON public.gd_wishes(sejour_slug);
