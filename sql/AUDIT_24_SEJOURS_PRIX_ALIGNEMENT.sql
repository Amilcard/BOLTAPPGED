-- =============================================================================
-- AUDIT COMPLET : 24 séjours — Alignement prix/sessions + surcharges transport
-- Date: 2026-02-22
-- Objectif: Vérifier TOUS les séjours, pas seulement les 8 UFOVAL corrigés
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ÉTAT GLOBAL : Chaque session a-t-elle des prix ?
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  ss.stay_slug,
  s.marketing_title AS "Titre GED",
  ss.start_date,
  ss.end_date,
  (ss.end_date::date - ss.start_date::date) + 1 AS duree_jours,
  (SELECT COUNT(*) FROM gd_session_prices sp
   WHERE sp.stay_slug = ss.stay_slug
     AND sp.start_date = ss.start_date
     AND sp.end_date = ss.end_date) AS nb_prix_alignes,
  (SELECT COUNT(*) FROM gd_session_prices sp2
   WHERE sp2.stay_slug = ss.stay_slug
     AND sp2.start_date = ss.start_date) AS nb_prix_meme_start,
  CASE
    WHEN (SELECT COUNT(*) FROM gd_session_prices sp
          WHERE sp.stay_slug = ss.stay_slug
            AND sp.start_date = ss.start_date
            AND sp.end_date = ss.end_date) > 0
    THEN '✅ ALIGNÉ'
    WHEN (SELECT COUNT(*) FROM gd_session_prices sp2
          WHERE sp2.stay_slug = ss.stay_slug
            AND sp2.start_date = ss.start_date) > 0
    THEN '🔴 DÉCALÉ end_date (prix existent mais dates ≠)'
    ELSE '❌ AUCUN PRIX'
  END AS statut
FROM gd_stay_sessions ss
JOIN gd_stays s ON s.slug = ss.stay_slug
ORDER BY
  CASE
    WHEN (SELECT COUNT(*) FROM gd_session_prices sp
          WHERE sp.stay_slug = ss.stay_slug
            AND sp.start_date = ss.start_date
            AND sp.end_date = ss.end_date) > 0 THEN 3
    WHEN (SELECT COUNT(*) FROM gd_session_prices sp2
          WHERE sp2.stay_slug = ss.stay_slug
            AND sp2.start_date = ss.start_date) > 0 THEN 1
    ELSE 2
  END,
  ss.stay_slug, ss.start_date;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RÉSUMÉ PAR SÉJOUR : Combien de sessions avec/sans prix ?
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  ss.stay_slug,
  s.marketing_title AS "Titre GED",
  COUNT(*) AS "Total sessions",
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM gd_session_prices sp
    WHERE sp.stay_slug = ss.stay_slug
      AND sp.start_date = ss.start_date
      AND sp.end_date = ss.end_date
  )) AS "Sessions avec prix ✅",
  COUNT(*) FILTER (WHERE NOT EXISTS (
    SELECT 1 FROM gd_session_prices sp
    WHERE sp.stay_slug = ss.stay_slug
      AND sp.start_date = ss.start_date
      AND sp.end_date = ss.end_date
  ) AND EXISTS (
    SELECT 1 FROM gd_session_prices sp2
    WHERE sp2.stay_slug = ss.stay_slug
      AND sp2.start_date = ss.start_date
  )) AS "Sessions DÉCALÉES 🔴",
  COUNT(*) FILTER (WHERE NOT EXISTS (
    SELECT 1 FROM gd_session_prices sp
    WHERE sp.stay_slug = ss.stay_slug
      AND sp.start_date = ss.start_date
  )) AS "Sessions sans prix ❌",
  CASE
    WHEN COUNT(*) FILTER (WHERE NOT EXISTS (
      SELECT 1 FROM gd_session_prices sp
      WHERE sp.stay_slug = ss.stay_slug
        AND sp.start_date = ss.start_date
        AND sp.end_date = ss.end_date
    )) = 0 THEN '✅ TOUT OK'
    ELSE '⚠️ À CORRIGER'
  END AS "Statut global"
FROM gd_stay_sessions ss
JOIN gd_stays s ON s.slug = ss.stay_slug
GROUP BY ss.stay_slug, s.marketing_title
ORDER BY
  COUNT(*) FILTER (WHERE NOT EXISTS (
    SELECT 1 FROM gd_session_prices sp
    WHERE sp.stay_slug = ss.stay_slug
      AND sp.start_date = ss.start_date
      AND sp.end_date = ss.end_date
  )) DESC,
  ss.stay_slug;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TRANSPORT : Vérification marge 18€ sur TOUS les séjours
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  city_departure,
  transport_surcharge_ufoval,
  transport_surcharge_ged,
  transport_surcharge_ged - transport_surcharge_ufoval AS marge,
  CASE
    WHEN city_departure = 'sans_transport' THEN '✅ Sans transport'
    WHEN transport_surcharge_ged IS NULL THEN '❌ SURCHARGE GED MANQUANTE'
    WHEN transport_surcharge_ged - transport_surcharge_ufoval = 18 THEN '✅ Marge 18€'
    ELSE '⚠️ Marge ≠ 18€'
  END AS statut,
  COUNT(*) AS nb_lignes,
  COUNT(DISTINCT stay_slug) AS nb_sejours
FROM gd_session_prices
GROUP BY city_departure, transport_surcharge_ufoval, transport_surcharge_ged
ORDER BY city_departure;
