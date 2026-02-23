-- =============================================================================
-- GRILLE TARIFAIRE COMPLÈTE : 24 séjours GED
-- Prix UFOVAL → + Markup durée → + Marge transport → = Prix GED final
-- Par séjour, par durée, par ville de départ
-- Date: 2026-02-22
-- =============================================================================

SELECT
  s.carousel_group AS "Carrousel",
  s.marketing_title AS "Séjour GED",
  (sp.end_date::date - sp.start_date::date) + 1 AS "Durée (j)",
  sp.city_departure AS "Ville départ",

  -- PRIX UFOVAL (avant toute marge)
  sp.base_price_eur AS "Prix UFOVAL",

  -- MARKUP DURÉE
  CASE
    WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 5 AND 8 THEN 180
    WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 11 AND 15 THEN 240
    WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 18 AND 22 THEN 410
    ELSE 0
  END AS "+ Markup durée",

  -- PRIX APRÈS MARKUP DURÉE (avant transport)
  sp.base_price_eur +
  CASE
    WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 5 AND 8 THEN 180
    WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 11 AND 15 THEN 240
    WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 18 AND 22 THEN 410
    ELSE 0
  END AS "Sous-total après durée",

  -- SURCHARGE TRANSPORT UFOVAL
  sp.transport_surcharge_ufoval AS "Transport UFOVAL",

  -- MARGE TRANSPORT GED (+18€)
  CASE
    WHEN sp.city_departure = 'sans_transport' THEN 0
    ELSE 18
  END AS "+ Marge GED 18€",

  -- SURCHARGE TRANSPORT GED TOTALE
  sp.transport_surcharge_ged AS "Transport GED total",

  -- PRIX GED FINAL
  sp.price_ged_total AS "PRIX GED FINAL",

  -- VÉRIFICATION : Prix GED = UFOVAL + markup durée + transport GED
  CASE
    WHEN sp.price_ged_total = sp.base_price_eur
      + CASE
          WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 5 AND 8 THEN 180
          WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 11 AND 15 THEN 240
          WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 18 AND 22 THEN 410
          ELSE 0
        END
      + COALESCE(sp.transport_surcharge_ged, 0)
    THEN '✅'
    ELSE '❌'
  END AS "Check"

FROM gd_session_prices sp
JOIN gd_stays s ON s.slug = sp.stay_slug
ORDER BY
  CASE s.carousel_group
    WHEN 'ADRENALINE_SENSATIONS' THEN 1
    WHEN 'AVENTURE_DECOUVERTE' THEN 2
    WHEN 'MA_PREMIERE_COLO' THEN 3
    ELSE 4
  END,
  s.marketing_title,
  (sp.end_date::date - sp.start_date::date) + 1,
  CASE sp.city_departure
    WHEN 'sans_transport' THEN '0'
    ELSE sp.city_departure
  END;
