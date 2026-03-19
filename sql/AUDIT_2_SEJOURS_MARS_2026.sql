-- =============================================================================
-- AUDIT CIBLÉ : Alpine Sky Camp + West Coast Surf Camp
-- Dates précises + Complétude
-- À exécuter dans Supabase SQL Editor — 5 mars 2026
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- QUERY A : Toutes les sessions gd_session_prices (dates + is_full + ville)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  gs.marketing_title AS "Séjour",
  gs.slug,
  TO_CHAR(sp.start_date, 'DD/MM/YYYY') AS "Début",
  TO_CHAR(sp.end_date, 'DD/MM/YYYY') AS "Fin",
  (sp.end_date::date - sp.start_date::date) AS "Delta jours",
  (sp.end_date::date - sp.start_date::date + 1) AS "Durée inclusive",
  sp.is_full AS "Complet (prices)?",
  sp.city_departure AS "Ville départ",
  sp.price_ged_total AS "Prix total"
FROM gd_stays gs
JOIN gd_session_prices sp ON sp.stay_slug = gs.slug
WHERE gs.slug IN ('annecy-element', 'surf-sur-le-bassin')
ORDER BY gs.slug, sp.start_date, sp.end_date, sp.city_departure;


-- ─────────────────────────────────────────────────────────────────────────────
-- QUERY B : Toutes les sessions gd_stay_sessions (dates + âges + is_full)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  gs.marketing_title AS "Séjour",
  gs.slug,
  TO_CHAR(ss.start_date, 'DD/MM/YYYY') AS "Début",
  TO_CHAR(ss.end_date, 'DD/MM/YYYY') AS "Fin",
  (ss.end_date::date - ss.start_date::date) AS "Delta jours",
  (ss.end_date::date - ss.start_date::date + 1) AS "Durée inclusive",
  ss.age_min AS "Age min",
  ss.age_max AS "Age max",
  ss.is_full AS "Complet (sessions)?",
  ss.seats_left AS "Places restantes"
FROM gd_stays gs
JOIN gd_stay_sessions ss ON ss.stay_slug = gs.slug
WHERE gs.slug IN ('annecy-element', 'surf-sur-le-bassin')
ORDER BY gs.slug, ss.start_date, ss.end_date;


-- ─────────────────────────────────────────────────────────────────────────────
-- QUERY C : Infos niveau séjour (gd_stays)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  slug,
  marketing_title AS "Séjour",
  age_min,
  age_max,
  carousel_group,
  is_full AS "Séjour complet global?",
  source_url
FROM gd_stays
WHERE slug IN ('annecy-element', 'surf-sur-le-bassin');
