-- ============================================================
-- VÉRIFICATION : ÉCART DE PRIX sans_transport vs avec transport
-- Montre clairement la DIFFÉRENCE de prix final par ville
-- ============================================================
-- Pour chaque séjour/durée, on compare :
--   PRIX sans transport  vs  PRIX avec transport
--   L'écart doit = transport_surcharge_ged de la ville
-- ============================================================

WITH prix_sans AS (
  SELECT
    sp.stay_slug,
    s.marketing_title,
    s.carousel_group,
    (sp.end_date::date - sp.start_date::date) + 1 AS duree,
    ROUND(AVG(sp.price_ged_total)) AS prix_sans_transport
  FROM gd_session_prices sp
  JOIN gd_stays s ON s.slug = sp.stay_slug
  WHERE sp.city_departure = 'sans_transport'
  GROUP BY sp.stay_slug, s.marketing_title, s.carousel_group,
           (sp.end_date::date - sp.start_date::date) + 1
),
prix_avec AS (
  SELECT
    sp.stay_slug,
    (sp.end_date::date - sp.start_date::date) + 1 AS duree,
    sp.city_departure,
    ROUND(AVG(sp.price_ged_total)) AS prix_avec_transport,
    ROUND(AVG(sp.transport_surcharge_ged)) AS tr_ged
  FROM gd_session_prices sp
  WHERE sp.city_departure != 'sans_transport'
  GROUP BY sp.stay_slug,
           (sp.end_date::date - sp.start_date::date) + 1,
           sp.city_departure
)
SELECT
  ps.carousel_group                                       AS "Carousel",
  ps.marketing_title                                      AS "Séjour",
  ps.duree                                                AS "Durée",
  pa.city_departure                                       AS "Ville",
  ps.prix_sans_transport                                  AS "PRIX sans transport",
  pa.prix_avec_transport                                  AS "PRIX avec transport",
  pa.prix_avec_transport - ps.prix_sans_transport         AS "ÉCART",
  pa.tr_ged                                               AS "Tr.GED attendu",
  CASE
    WHEN pa.prix_avec_transport - ps.prix_sans_transport = pa.tr_ged
    THEN '✅'
    ELSE '❌'
  END                                                     AS "CHECK"
FROM prix_sans ps
JOIN prix_avec pa ON pa.stay_slug = ps.stay_slug AND pa.duree = ps.duree
ORDER BY
  ps.carousel_group,
  ps.marketing_title,
  ps.duree,
  pa.city_departure;
