-- LOT 1 : ADRENALINE_SENSATIONS (7 séjours)
SELECT
  s.marketing_title AS "Séjour",
  (sp.end_date::date - sp.start_date::date) + 1 AS "Durée",
  sp.city_departure AS "Ville",
  ROUND(AVG(sp.base_price_eur)) AS "UFOVAL",
  CASE
    WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 5 AND 8 THEN 180
    WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 11 AND 15 THEN 240
    WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 18 AND 22 THEN 410
    ELSE 0
  END AS "+Durée",
  ROUND(AVG(sp.transport_surcharge_ufoval)) AS "Tr.UFOVAL",
  CASE WHEN sp.city_departure = 'sans_transport' THEN 0 ELSE 18 END AS "+18€",
  ROUND(AVG(sp.transport_surcharge_ged)) AS "Tr.GED",
  ROUND(AVG(sp.price_ged_total)) AS "PRIX GED",
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
WHERE s.carousel_group = 'ADRENALINE_SENSATIONS'
GROUP BY s.marketing_title, (sp.end_date::date - sp.start_date::date) + 1, sp.city_departure
ORDER BY s.marketing_title, (sp.end_date::date - sp.start_date::date) + 1,
  CASE sp.city_departure WHEN 'sans_transport' THEN '0' ELSE sp.city_departure END;
