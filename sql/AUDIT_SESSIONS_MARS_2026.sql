-- =============================================================================
-- AUDIT SESSIONS MARS 2026 : Dates, Complétudes & Âges
-- À exécuter dans Supabase SQL Editor
-- Date : 2026-03-05
-- Objectif : Vérifier les anomalies signalées UFOVAL vs GED
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. AUDIT DATES : Sessions des 8 séjours concernés
--    Compare les dates dans gd_session_prices ET gd_stay_sessions
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  s.marketing_title AS "Séjour GED",
  s.slug,
  'gd_session_prices' AS "Table",
  TO_CHAR(sp.start_date, 'DD/MM/YYYY') AS "Début",
  TO_CHAR(sp.end_date, 'DD/MM/YYYY') AS "Fin",
  (sp.end_date::date - sp.start_date::date) AS "Durée (j)",
  sp.is_full AS "Complet?",
  sp.city_departure AS "Ville départ"
FROM gd_stays s
JOIN gd_session_prices sp ON sp.stay_slug = s.slug
WHERE s.slug IN (
  'les-ptits-puisotins-1',       -- MY LITTLE FOREST
  'croc-marmotte',               -- ALPOO KIDS
  'destination-bassin-darcachon-1', -- DUNE & OCEAN KIDS
  'glieraventures',              -- DUAL CAMP
  'mountain-and-chill',          -- ADRENALINE & CHILL
  'annecy-element',              -- ALPINE SKY CAMP
  'surf-sur-le-bassin'           -- WEST COAST SURF CAMP
)
ORDER BY s.marketing_title, sp.start_date, sp.city_departure;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. AUDIT SESSIONS (gd_stay_sessions) : Dates + Âges
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  s.marketing_title AS "Séjour GED",
  s.slug,
  'gd_stay_sessions' AS "Table",
  TO_CHAR(ss.start_date, 'DD/MM/YYYY') AS "Début",
  TO_CHAR(ss.end_date, 'DD/MM/YYYY') AS "Fin",
  (ss.end_date::date - ss.start_date::date) AS "Durée (j)",
  ss.age_min || '-' || ss.age_max AS "Âge session",
  ss.is_full AS "Complet?",
  ss.seats_left AS "Places"
FROM gd_stays s
JOIN gd_stay_sessions ss ON ss.stay_slug = s.slug
WHERE s.slug IN (
  'les-ptits-puisotins-1',
  'croc-marmotte',
  'destination-bassin-darcachon-1',
  'glieraventures',
  'mountain-and-chill',
  'annecy-element',
  'surf-sur-le-bassin'
)
ORDER BY s.marketing_title, ss.start_date;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. AUDIT ÂGES : gd_stays.age_min/age_max (niveau séjour)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  s.slug,
  s.marketing_title AS "Séjour GED",
  s.age_min AS "age_min (gd_stays)",
  s.age_max AS "age_max (gd_stays)",
  s.carousel_group AS "Carrousel",
  s.is_full AS "Séjour complet global?"
FROM gd_stays s
WHERE s.slug IN (
  'les-ptits-puisotins-1',
  'croc-marmotte',
  'destination-bassin-darcachon-1',
  'glieraventures',
  'mountain-and-chill',
  'annecy-element',
  'surf-sur-le-bassin'
)
ORDER BY s.marketing_title;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. VISION COMPLÈTE : Comparaison dates gd_session_prices vs gd_stay_sessions
--    Détecte les sessions qui existent dans une table mais pas l'autre
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  COALESCE(sp.stay_slug, ss.stay_slug) AS slug,
  gs.marketing_title AS "Séjour",
  COALESCE(TO_CHAR(sp.start_date, 'DD/MM'), TO_CHAR(ss.start_date, 'DD/MM')) AS "Début",
  TO_CHAR(sp.end_date, 'DD/MM') AS "Fin (prices)",
  TO_CHAR(ss.end_date, 'DD/MM') AS "Fin (sessions)",
  CASE
    WHEN sp.end_date IS NULL THEN '❌ Absente dans prices'
    WHEN ss.end_date IS NULL THEN '❌ Absente dans sessions'
    WHEN sp.end_date = ss.end_date THEN '✅ Identique'
    ELSE '⚠️ DIFFÉRENT (' || (sp.end_date::date - ss.end_date::date) || 'j)'
  END AS "Cohérence end_date",
  sp.is_full AS "is_full (prices)",
  ss.is_full AS "is_full (sessions)",
  ss.age_min || '-' || ss.age_max AS "Âge (sessions)"
FROM gd_session_prices sp
FULL OUTER JOIN gd_stay_sessions ss
  ON sp.stay_slug = ss.stay_slug
  AND sp.start_date = ss.start_date
  AND sp.end_date = ss.end_date
JOIN gd_stays gs ON gs.slug = COALESCE(sp.stay_slug, ss.stay_slug)
WHERE COALESCE(sp.stay_slug, ss.stay_slug) IN (
  'les-ptits-puisotins-1',
  'croc-marmotte',
  'destination-bassin-darcachon-1',
  'glieraventures',
  'mountain-and-chill',
  'annecy-element',
  'surf-sur-le-bassin'
)
ORDER BY gs.marketing_title, COALESCE(sp.start_date, ss.start_date);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. DIAGNOSTIC RAPIDE : Séjours avec dates potentiellement erronées
--    Vérifie si la durée en jours est incohérente avec les standards UFOVAL
--    (7, 12, 14, 21 jours sont les durées normales)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  gs.marketing_title AS "Séjour",
  gs.slug,
  TO_CHAR(sp.start_date, 'DD/MM') AS "Début",
  TO_CHAR(sp.end_date, 'DD/MM') AS "Fin",
  (sp.end_date::date - sp.start_date::date) AS "Durée (j)",
  CASE
    WHEN (sp.end_date::date - sp.start_date::date) IN (7, 12, 14, 21) THEN '✅ Standard'
    ELSE '⚠️ NON STANDARD (' || (sp.end_date::date - sp.start_date::date) || 'j)'
  END AS "Diagnostic durée",
  sp.is_full AS "Complet?"
FROM gd_session_prices sp
JOIN gd_stays gs ON gs.slug = sp.stay_slug
WHERE sp.stay_slug IN (
  'les-ptits-puisotins-1',
  'croc-marmotte',
  'destination-bassin-darcachon-1',
  'glieraventures',
  'mountain-and-chill',
  'annecy-element',
  'surf-sur-le-bassin'
)
AND sp.city_departure = 'sans_transport'  -- Éviter doublons villes
ORDER BY gs.marketing_title, sp.start_date;
