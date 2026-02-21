-- =============================================================================
-- ANALYSE DÉTAILLÉE : Problème des sessions de 8 jours
-- Date: 2026-02-17
-- Problème détecté: Durées "7, 8, 14" au lieu de "7, 14"
-- Hypothèse: Certaines sessions ont end_date mal calculé (+1 jour de trop)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. DÉTAIL DES SESSIONS PROBLÉMATIQUES (durée = 8 jours)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  ss.stay_slug,
  s.marketing_title AS "Titre GED",
  TO_CHAR(ss.start_date, 'DD/MM/YYYY') AS "Date début",
  TO_CHAR(ss.end_date, 'DD/MM/YYYY') AS "Date fin",
  (ss.end_date::date - ss.start_date::date) + 1 AS "Durée (jours inclusifs)",
  (ss.end_date::date - ss.start_date::date) AS "Durée (nuits)",
  ss.seats_left AS "Places",

  CASE
    WHEN (ss.end_date::date - ss.start_date::date) + 1 = 8 THEN '🔴 PROBLÈME 8 JOURS'
    WHEN (ss.end_date::date - ss.start_date::date) + 1 = 7 THEN '✅ OK 7 JOURS'
    WHEN (ss.end_date::date - ss.start_date::date) + 1 = 14 THEN '✅ OK 14 JOURS'
    ELSE '⚠️ AUTRE DURÉE'
  END AS "Diagnostic"

FROM gd_stay_sessions ss
JOIN gd_stays s ON s.slug = ss.stay_slug
WHERE ss.stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix', 'destination-bassin-darcachon-1',
  'natation-et-sensation', 'laventure-verticale', 'les-ptits-puisotins-1'
)
ORDER BY ss.stay_slug, ss.start_date;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. STATISTIQUES PAR SÉJOUR : Combien de sessions de 8 jours ?
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  ss.stay_slug,
  s.marketing_title AS "Titre GED",
  COUNT(*) FILTER (WHERE (ss.end_date::date - ss.start_date::date) + 1 = 7) AS "Nb sessions 7j",
  COUNT(*) FILTER (WHERE (ss.end_date::date - ss.start_date::date) + 1 = 8) AS "Nb sessions 8j ❌",
  COUNT(*) FILTER (WHERE (ss.end_date::date - ss.start_date::date) + 1 = 14) AS "Nb sessions 14j",
  COUNT(*) FILTER (WHERE (ss.end_date::date - ss.start_date::date) + 1 NOT IN (7, 8, 14)) AS "Nb autres",
  COUNT(*) AS "Total sessions"
FROM gd_stay_sessions ss
JOIN gd_stays s ON s.slug = ss.stay_slug
WHERE ss.stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix', 'destination-bassin-darcachon-1',
  'natation-et-sensation', 'laventure-verticale', 'les-ptits-puisotins-1'
)
GROUP BY ss.stay_slug, s.marketing_title
ORDER BY COUNT(*) FILTER (WHERE (ss.end_date::date - ss.start_date::date) + 1 = 8) DESC;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. HYPOTHÈSE 1 : Les sessions de 8j devraient être 7j (nuits comptées)
--    Solution: end_date -1 jour
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  ss.stay_slug,
  s.marketing_title AS "Titre GED",
  TO_CHAR(ss.start_date, 'DD/MM/YYYY') AS "Début",
  TO_CHAR(ss.end_date, 'DD/MM/YYYY') AS "Fin ACTUELLE",
  TO_CHAR(ss.end_date::date - INTERVAL '1 day', 'DD/MM/YYYY') AS "Fin CORRIGÉE (-1j)",
  (ss.end_date::date - ss.start_date::date) + 1 AS "Durée actuelle",
  ((ss.end_date::date - INTERVAL '1 day')::date - ss.start_date::date) + 1 AS "Durée après correction"
FROM gd_stay_sessions ss
JOIN gd_stays s ON s.slug = ss.stay_slug
WHERE ss.stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix', 'destination-bassin-darcachon-1',
  'natation-et-sensation', 'laventure-verticale', 'les-ptits-puisotins-1'
)
AND (ss.end_date::date - ss.start_date::date) + 1 = 8
ORDER BY ss.stay_slug, ss.start_date;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. VÉRIFICATION : Y a-t-il des sessions avec 6 jours (nuits au lieu de jours) ?
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  ss.stay_slug,
  s.marketing_title AS "Titre GED",
  (ss.end_date::date - ss.start_date::date) + 1 AS "Durée jours inclusifs",
  COUNT(*) AS "Nb sessions",
  STRING_AGG(TO_CHAR(ss.start_date, 'DD/MM'), ', ' ORDER BY ss.start_date) AS "Dates début"
FROM gd_stay_sessions ss
JOIN gd_stays s ON s.slug = ss.stay_slug
WHERE ss.stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix', 'destination-bassin-darcachon-1',
  'dh-experience-11-13-ans', 'natation-et-sensation', 'laventure-verticale',
  'les-ptits-puisotins-1'
)
AND (ss.end_date::date - ss.start_date::date) + 1 = 6
GROUP BY ss.stay_slug, s.marketing_title, (ss.end_date::date - ss.start_date::date) + 1;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RÉSUMÉ GLOBAL : Toutes les durées trouvées
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  (ss.end_date::date - ss.start_date::date) + 1 AS "Durée (jours inclusifs)",
  COUNT(*) AS "Nb sessions",
  STRING_AGG(DISTINCT s.marketing_title, ', ' ORDER BY s.marketing_title) AS "Séjours concernés",
  CASE
    WHEN (ss.end_date::date - ss.start_date::date) + 1 IN (6, 7, 12, 14, 19, 21) THEN '✅ Durée UFOVAL valide'
    WHEN (ss.end_date::date - ss.start_date::date) + 1 = 8 THEN '🔴 PROBLÈME (+1 jour de trop)'
    ELSE '⚠️ Durée non documentée'
  END AS "Statut"
FROM gd_stay_sessions ss
JOIN gd_stays s ON s.slug = ss.stay_slug
WHERE ss.stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix', 'destination-bassin-darcachon-1',
  'dh-experience-11-13-ans', 'natation-et-sensation', 'laventure-verticale',
  'les-ptits-puisotins-1'
)
GROUP BY (ss.end_date::date - ss.start_date::date) + 1
ORDER BY (ss.end_date::date - ss.start_date::date) + 1;
