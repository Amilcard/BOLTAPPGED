-- =============================================================================
-- AUDIT RÉGRESSION : Prix et surcharges transport post-correction durées
-- Date: 2026-02-22
-- Objectif: Vérifier que les prix et surcharges transport sont intacts
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ÉTAT GLOBAL gd_session_prices : combien de lignes, combien par ville ?
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  city_departure,
  COUNT(*) AS nb_lignes,
  MIN(base_price_eur) AS prix_base_min,
  MAX(base_price_eur) AS prix_base_max,
  MIN(transport_surcharge_ged) AS surcharge_ged_min,
  MAX(transport_surcharge_ged) AS surcharge_ged_max,
  MIN(transport_surcharge_ufoval) AS surcharge_ufoval_min,
  MAX(transport_surcharge_ufoval) AS surcharge_ufoval_max,
  MIN(price_ged_total) AS prix_total_min,
  MAX(price_ged_total) AS prix_total_max
FROM gd_session_prices
GROUP BY city_departure
ORDER BY city_departure;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. SURCHARGES TRANSPORT GED : Vérification marge 18€
--    Règle attendue : transport_surcharge_ged = transport_surcharge_ufoval + 18
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  city_departure,
  transport_surcharge_ufoval,
  transport_surcharge_ged,
  transport_surcharge_ged - transport_surcharge_ufoval AS "Marge GED",
  CASE
    WHEN city_departure = 'sans_transport' THEN '✅ Sans transport'
    WHEN transport_surcharge_ged IS NULL THEN '❌ SURCHARGE GED MANQUANTE'
    WHEN transport_surcharge_ged - transport_surcharge_ufoval = 18 THEN '✅ Marge 18€ OK'
    ELSE '⚠️ Marge != 18€'
  END AS "Statut marge",
  COUNT(*) AS nb_lignes
FROM gd_session_prices
GROUP BY city_departure, transport_surcharge_ufoval, transport_surcharge_ged
ORDER BY city_departure;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PRIX PAR DURÉE : Vérification 180, 240, 410
--    Vérifie les prix de base (sans_transport) par durée de session
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  sp.stay_slug,
  s.marketing_title,
  (sp.end_date::date - sp.start_date::date) + 1 AS duree_jours,
  sp.city_departure,
  sp.base_price_eur,
  sp.transport_surcharge_ged,
  sp.transport_surcharge_ufoval,
  sp.price_ged_total
FROM gd_session_prices sp
JOIN gd_stays s ON s.slug = sp.stay_slug
WHERE sp.city_departure = 'sans_transport'
ORDER BY sp.stay_slug, duree_jours, sp.start_date;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. PRIX PAR DURÉE AGRÉGÉ : Prix moyen par durée et séjour
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  sp.stay_slug,
  s.marketing_title,
  (sp.end_date::date - sp.start_date::date) + 1 AS duree_jours,
  COUNT(*) AS nb_sessions,
  MIN(sp.base_price_eur) AS prix_base_min,
  MAX(sp.base_price_eur) AS prix_base_max,
  MIN(sp.price_ged_total) AS prix_total_min,
  MAX(sp.price_ged_total) AS prix_total_max
FROM gd_session_prices sp
JOIN gd_stays s ON s.slug = sp.stay_slug
WHERE sp.city_departure = 'sans_transport'
GROUP BY sp.stay_slug, s.marketing_title, (sp.end_date::date - sp.start_date::date) + 1
ORDER BY sp.stay_slug, duree_jours;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. SESSIONS SANS PRIX : Y a-t-il des sessions orphelines ?
--    (sessions dans gd_stay_sessions sans correspondance dans gd_session_prices)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  ss.stay_slug,
  s.marketing_title,
  ss.start_date,
  ss.end_date,
  (ss.end_date::date - ss.start_date::date) + 1 AS duree_jours,
  '❌ AUCUN PRIX' AS statut
FROM gd_stay_sessions ss
JOIN gd_stays s ON s.slug = ss.stay_slug
WHERE NOT EXISTS (
  SELECT 1 FROM gd_session_prices sp
  WHERE sp.stay_slug = ss.stay_slug
    AND sp.start_date = ss.start_date
    AND sp.end_date = ss.end_date
)
ORDER BY ss.stay_slug, ss.start_date;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. PRIX ORPHELINS : Prix sans session correspondante
--    (prix dans gd_session_prices sans correspondance dans gd_stay_sessions)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  sp.stay_slug,
  s.marketing_title,
  sp.start_date,
  sp.end_date,
  (sp.end_date::date - sp.start_date::date) + 1 AS duree_jours_prix,
  sp.city_departure,
  sp.base_price_eur,
  sp.price_ged_total,
  '⚠️ PRIX ORPHELIN (pas de session)' AS statut
FROM gd_session_prices sp
JOIN gd_stays s ON s.slug = sp.stay_slug
WHERE NOT EXISTS (
  SELECT 1 FROM gd_stay_sessions ss
  WHERE ss.stay_slug = sp.stay_slug
    AND ss.start_date = sp.start_date
    AND ss.end_date = sp.end_date
)
ORDER BY sp.stay_slug, sp.start_date, sp.city_departure;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. COMPARAISON DATES : sessions vs prix (détection décalage end_date)
--    Si on a corrigé gd_stay_sessions mais PAS gd_session_prices,
--    les end_date ne matchent plus → prix orphelins !
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  ss.stay_slug,
  s.marketing_title,
  ss.start_date AS session_start,
  ss.end_date AS session_end,
  (ss.end_date::date - ss.start_date::date) + 1 AS duree_session,
  sp_dates.prix_end_dates AS "end_dates dans prix",
  sp_dates.durees_prix AS "durées dans prix",
  CASE
    WHEN sp_dates.prix_end_dates IS NULL THEN '❌ Aucun prix trouvé'
    WHEN ss.end_date::text = ANY(string_to_array(sp_dates.prix_end_dates, ', ')) THEN '✅ Dates alignées'
    ELSE '⚠️ DÉCALAGE end_date session vs prix'
  END AS statut
FROM gd_stay_sessions ss
JOIN gd_stays s ON s.slug = ss.stay_slug
LEFT JOIN LATERAL (
  SELECT
    STRING_AGG(DISTINCT sp.end_date::text, ', ' ORDER BY sp.end_date::text) AS prix_end_dates,
    STRING_AGG(DISTINCT ((sp.end_date::date - sp.start_date::date) + 1)::text, ', ') AS durees_prix
  FROM gd_session_prices sp
  WHERE sp.stay_slug = ss.stay_slug
    AND sp.start_date = ss.start_date
) sp_dates ON true
WHERE ss.stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix', 'destination-bassin-darcachon-1',
  'dh-experience-11-13-ans', 'natation-et-sensation', 'laventure-verticale',
  'les-ptits-puisotins-1'
)
ORDER BY ss.stay_slug, ss.start_date;
