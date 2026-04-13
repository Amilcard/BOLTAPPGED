-- ============================================================
-- Migration 053 — RLS gd_session_prices : restaurer accès anon
-- ============================================================
-- Constat (2026-04-12) :
--   La policy "authenticated_read_prices" (SELECT TO authenticated)
--   bloquait le rôle anon → getSessionPrices() retournait [] pour
--   tous les séjours → "Aucune session disponible" sur le catalogue.
--
--   L'ancienne policy "anon_read_prices" avait été droppée/remplacée
--   par erreur lors d'un audit RLS antérieur.
--
-- Fix : recréer la policy anon SELECT.
--   Les prix du catalogue sont des données publiques (pas PII).
--   Les données sensibles (inscriptions, dossiers) restent service_role only.
-- ============================================================

CREATE POLICY "anon_read_prices"
  ON gd_session_prices
  FOR SELECT
  TO anon
  USING (true);

-- Vérification post-apply :
-- SELECT polname, polroles::regrole[]
-- FROM pg_policy
-- WHERE polrelid = 'gd_session_prices'::regclass;
-- → doit retourner : authenticated_read_prices + anon_read_prices
