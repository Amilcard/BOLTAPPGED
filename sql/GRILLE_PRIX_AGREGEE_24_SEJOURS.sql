-- =============================================================================
-- GRILLE TARIFAIRE AGRÉGÉE : 24 séjours × durées × villes
-- 1 ligne par séjour / durée / ville — Prix UFOVAL → Markup → Transport → GED
-- Date: 2026-02-22
-- =============================================================================

SELECT
  s.carousel_group AS "Carrousel",
  s.marketing_title AS "Séjour",
  (sp.end_date::date - sp.start_date::date) + 1 AS "Durée",
  sp.city_departure AS "Ville",

  -- AVANT MARGE
  ROUND(AVG(sp.base_price_eur)) AS "Prix UFOVAL",

  -- MARKUP DURÉE
  CASE
    WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 5 AND 8 THEN 180
    WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 11 AND 15 THEN 240
    WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 18 AND 22 THEN 410
    ELSE 0
  END AS "+Durée",

  -- TRANSPORT
  ROUND(AVG(sp.transport_surcharge_ufoval)) AS "Transp UFOVAL",
  CASE WHEN sp.city_departure = 'sans_transport' THEN 0 ELSE 18 END AS "+Marge 18€",
  ROUND(AVG(sp.transport_surcharge_ged)) AS "Transp GED",

  -- APRÈS MARGE
  ROUND(AVG(sp.price_ged_total)) AS "PRIX GED",

  -- CHECK
  CASE
    WHEN ROUND(AVG(sp.price_ged_total)) =
      ROUND(AVG(sp.base_price_eur))
      + CASE
          WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 5 AND 8 THEN 180
          WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 11 AND 15 THEN 240
          WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 18 AND 22 THEN 410
          ELSE 0
        END
      + ROUND(AVG(COALESCE(sp.transport_surcharge_ged, 0)))
    THEN '✅'
    ELSE '❌'
  END AS "OK"

FROM gd_session_prices sp
JOIN gd_stays s ON s.slug = sp.stay_slug
GROUP BY
  s.carousel_group,
  s.marketing_title,
  (sp.end_date::date - sp.start_date::date) + 1,
  sp.city_departure
ORDER BY
  CASE s.carousel_group
    WHEN 'ADRENALINE_SENSATIONS' THEN 1
    WHEN 'AVENTURE_DECOUVERTE' THEN 2
    WHEN 'MA_PREMIERE_COLO' THEN 3
    ELSE 4
  END,
  s.marketing_title,
  (sp.end_date::date - sp.start_date::date) + 1,
  CASE sp.city_departure WHEN 'sans_transport' THEN '0' ELSE sp.city_departure END;
