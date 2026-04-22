-- 086 — DROP tables zombies gd_suivi_*
--
-- Contexte : audit déterministe 2026-04-22 (Axe 3.4).
-- Ces tables ont été créées lors d'une phase de prototypage du dashboard
-- structure. Elles ont ensuite été remplacées par les vraies tables :
--   gd_suivi_incidents  → gd_incidents        (2 rows en prod)
--   gd_suivi_medical    → gd_medical_events   (0 rows, schéma actif)
--   gd_suivi_appels     → gd_calls            (10 rows en prod)
--   gd_suivi_messages   → gd_notes            (3 rows en prod)
--   gd_suivi_sejour     → (pas de remplacement — fonctionnalité abandonnée)
--
-- Vérifications préalables (MCP Supabase, 2026-04-22) :
--   ✅ 5 × 0 rows (zéro donnée perdue)
--   ✅ 0 FK entrante depuis d'autres tables
--   ✅ 0 trigger
--   ✅ 0 vue référentielle
--   ✅ 1 policy par table (auto-dropped avec la table)
--   ✅ FK sortantes vers gd_inscriptions/gd_structures disparaissent avec les tables
--
-- Impact types : types/database.types.ts à régénérer après application
-- (`npx supabase gen types typescript` ou équivalent).
--
-- Rollback : ROLLBACK_086.sql (restaure les 5 tables vides avec FK).

BEGIN;

DROP TABLE IF EXISTS public.gd_suivi_sejour;
DROP TABLE IF EXISTS public.gd_suivi_appels;
DROP TABLE IF EXISTS public.gd_suivi_incidents;
DROP TABLE IF EXISTS public.gd_suivi_messages;
DROP TABLE IF EXISTS public.gd_suivi_medical;

COMMIT;
