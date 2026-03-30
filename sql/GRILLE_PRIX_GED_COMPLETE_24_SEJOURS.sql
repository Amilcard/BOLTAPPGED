-- =============================================================================
-- GRILLE TARIFAIRE COMPLÈTE : 24 séjours GED
-- Prix UFOVAL (base) → Markup durée → Prix GED (sans transport)
-- Organisé par carrousel (univers)
-- Date: 2026-02-22
-- =============================================================================

SELECT
  s.carousel_group AS "Univers",
  sp.stay_slug,
  s.marketing_title AS "Titre GED",
  (sp.end_date::date - sp.start_date::date) + 1 AS "Durée (j)",

  -- PRIX UFOVAL (avant marge)
  MIN(sp.base_price_eur) AS "Prix UFOVAL min",
  MAX(sp.base_price_eur) AS "Prix UFOVAL max",

  -- MARKUP DURÉE
  CASE
    WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 5 AND 8 THEN 180
    WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 11 AND 15 THEN 240
    WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 18 AND 22 THEN 410
    ELSE 0
  END AS "Markup durée",

  -- PRIX GED (après marge, sans transport)
  MIN(sp.price_ged_total) AS "Prix GED min",
  MAX(sp.price_ged_total) AS "Prix GED max",

  -- VÉRIFICATION
  CASE
    WHEN MIN(sp.price_ged_total) = MIN(sp.base_price_eur) +
      CASE
        WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 5 AND 8 THEN 180
        WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 11 AND 15 THEN 240
        WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 18 AND 22 THEN 410
        ELSE 0
      END
    THEN '✅'
    ELSE '⚠️'
  END AS "Check",

  COUNT(*) AS "Nb sessions"

FROM gd_session_prices sp
JOIN gd_stays s ON s.slug = sp.stay_slug
WHERE sp.city_departure = 'sans_transport'
GROUP BY s.carousel_group, sp.stay_slug, s.marketing_title,
  (sp.end_date::date - sp.start_date::date) + 1
ORDER BY
  CASE s.carousel_group
    WHEN 'ADRENALINE_SENSATIONS' THEN 1
    WHEN 'AVENTURE_DECOUVERTE' THEN 2
    WHEN 'MA_PREMIERE_COLO' THEN 3
    ELSE 4
  END,
  s.marketing_title,
  (sp.end_date::date - sp.start_date::date) + 1;
