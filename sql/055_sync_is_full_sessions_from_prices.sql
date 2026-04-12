-- ============================================================
-- Migration 055 — Resync is_full : gd_stay_sessions ← gd_session_prices
-- ============================================================
-- Constat (2026-04-12) :
--   Le sync n8n/UFOVAL met à jour gd_session_prices.is_full
--   mais ne propage pas vers gd_stay_sessions.is_full.
--   18 sessions désynchronisées détectées (15 complètes affichées
--   comme dispo, 2 high-ranch bloquées à tort).
--
-- Fix ponctuel : resync depuis la source de vérité.
-- Fix structurel (TODO) : ajouter une étape dans le workflow n8n
--   pour UPDATE gd_stay_sessions.is_full en même temps que
--   gd_session_prices.is_full lors du sync UFOVAL.
-- ============================================================

UPDATE gd_stay_sessions ss
SET
  is_full    = sp_agg.any_full,
  seats_left = CASE WHEN sp_agg.any_full THEN 0 ELSE null END
FROM (
  SELECT stay_slug, start_date, end_date,
         bool_or(is_full) AS any_full
  FROM gd_session_prices
  GROUP BY stay_slug, start_date, end_date
) sp_agg
WHERE ss.stay_slug  = sp_agg.stay_slug
  AND ss.start_date = sp_agg.start_date
  AND ss.end_date   = sp_agg.end_date
  AND ss.is_full   != sp_agg.any_full;

-- Vérification post-apply : doit retourner 0
-- SELECT count(*) FROM gd_stay_sessions ss
-- LEFT JOIN (
--   SELECT stay_slug, start_date, end_date, bool_or(is_full) AS any_full
--   FROM gd_session_prices GROUP BY stay_slug, start_date, end_date
-- ) sp ON sp.stay_slug=ss.stay_slug AND sp.start_date=ss.start_date AND sp.end_date=ss.end_date
-- WHERE ss.is_full != sp.any_full;
