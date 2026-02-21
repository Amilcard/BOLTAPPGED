-- =============================================================================
-- AUDIT DURÉES SÉJOURS : Détection incohérences et multi-durées
-- Date: 2026-02-17
-- Objectif: Identifier les problèmes avant normalisation
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. AUDIT GLOBAL : Cohérence duration_days vs sessions
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  s.slug,
  s.marketing_title AS "Titre GED",
  s.duration_days AS "Config (jours)",

  -- Calcul JOURS INCLUSIFS (recommandé)
  (ss.end_date::date - ss.start_date::date) + 1 AS "Session (jours inclusifs)",

  -- Calcul NUITS (pour comparaison)
  (ss.end_date::date - ss.start_date::date) AS "Session (nuits)",

  CASE
    WHEN s.duration_days = ((ss.end_date::date - ss.start_date::date) + 1) THEN '✅ Cohérent (jours)'
    WHEN s.duration_days = (ss.end_date::date - ss.start_date::date) THEN '⚠️ Cohérent (nuits)'
    ELSE '❌ INCOHÉRENT (' ||
      ABS(s.duration_days - ((ss.end_date::date - ss.start_date::date) + 1))::text || ' jours écart)'
  END AS "Statut",

  TO_CHAR(ss.start_date, 'DD/MM/YYYY') AS "Début",
  TO_CHAR(ss.end_date, 'DD/MM/YYYY') AS "Fin",

  ss.seats_left AS "Places"

FROM gd_stays s
JOIN gd_stay_sessions ss ON ss.stay_slug = s.slug
WHERE s.published = true
  AND s.duration_days IS NOT NULL
ORDER BY
  CASE
    WHEN s.duration_days = ((ss.end_date::date - ss.start_date::date) + 1) THEN 1
    WHEN s.duration_days = (ss.end_date::date - ss.start_date::date) THEN 2
    ELSE 3
  END,
  s.marketing_title, ss.start_date;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. MULTI-DURÉES : Séjours proposant plusieurs durées différentes
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  s.slug,
  s.marketing_title AS "Titre GED",
  s.duration_days AS "Config",

  -- Toutes les durées réelles (jours inclusifs)
  STRING_AGG(DISTINCT ((ss.end_date::date - ss.start_date::date) + 1)::text, ', '
    ORDER BY ((ss.end_date::date - ss.start_date::date) + 1)::text) AS "Durées trouvées",

  -- Nombre de durées distinctes
  COUNT(DISTINCT ((ss.end_date::date - ss.start_date::date) + 1)) AS "Nb durées",

  -- Nombre de sessions par durée
  STRING_AGG(
    ((ss.end_date::date - ss.start_date::date) + 1)::text || 'j (' ||
    COUNT(*)::text || ' sessions)',
    ', '
  ) AS "Détail sessions",

  CASE
    WHEN COUNT(DISTINCT ((ss.end_date::date - ss.start_date::date) + 1)) > 1 THEN '⚠️ MULTI-DURÉES'
    WHEN s.duration_days = MIN((ss.end_date::date - ss.start_date::date) + 1) THEN '✅ OK'
    ELSE '❌ INCOHÉRENT'
  END AS "Statut"

FROM gd_stays s
JOIN gd_stay_sessions ss ON ss.stay_slug = s.slug
WHERE s.published = true
GROUP BY s.slug, s.marketing_title, s.duration_days
HAVING COUNT(DISTINCT ((ss.end_date::date - ss.start_date::date) + 1)) > 1
ORDER BY "Nb durées" DESC, s.marketing_title;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SÉJOURS SANS SESSIONS : duration_days configuré mais aucune session
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  s.slug,
  s.marketing_title AS "Titre GED",
  s.duration_days AS "Config (jours)",
  s.published AS "Publié",
  '⚠️ Aucune session' AS "Alerte"
FROM gd_stays s
WHERE s.duration_days IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM gd_stay_sessions ss WHERE ss.stay_slug = s.slug
  )
ORDER BY s.published DESC, s.marketing_title;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. DISTRIBUTION GLOBALE : Quelles durées sont proposées ?
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  ((ss.end_date::date - ss.start_date::date) + 1) AS "Durée (jours inclusifs)",
  COUNT(*) AS "Nb sessions",
  COUNT(DISTINCT s.slug) AS "Nb séjours",
  STRING_AGG(DISTINCT s.marketing_title, ', ' ORDER BY s.marketing_title) AS "Séjours"
FROM gd_stays s
JOIN gd_stay_sessions ss ON ss.stay_slug = s.slug
WHERE s.published = true
GROUP BY ((ss.end_date::date - ss.start_date::date) + 1)
ORDER BY ((ss.end_date::date - ss.start_date::date) + 1);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. STATISTIQUES RÉSUMÉ
-- ─────────────────────────────────────────────────────────────────────────────
WITH stats AS (
  SELECT
    s.slug,
    s.marketing_title,
    s.duration_days,
    COUNT(DISTINCT ((ss.end_date::date - ss.start_date::date) + 1)) AS nb_durees,
    BOOL_AND(s.duration_days = ((ss.end_date::date - ss.start_date::date) + 1)) AS coherent
  FROM gd_stays s
  JOIN gd_stay_sessions ss ON ss.stay_slug = s.slug
  WHERE s.published = true AND s.duration_days IS NOT NULL
  GROUP BY s.slug, s.marketing_title, s.duration_days
)
SELECT
  COUNT(*) AS "Total séjours avec sessions",
  COUNT(CASE WHEN coherent = true THEN 1 END) AS "✅ Cohérents",
  COUNT(CASE WHEN coherent = false THEN 1 END) AS "❌ Incohérents",
  COUNT(CASE WHEN nb_durees > 1 THEN 1 END) AS "⚠️ Multi-durées",
  COUNT(CASE WHEN nb_durees = 1 AND coherent = true THEN 1 END) AS "✅ OK (1 durée cohérente)",
  ROUND(100.0 * COUNT(CASE WHEN nb_durees = 1 AND coherent = true THEN 1 END) / COUNT(*), 1) || '%' AS "% OK"
FROM stats;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. TOP 10 : Séjours nécessitant une correction urgente
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  s.slug,
  s.marketing_title AS "Titre GED",
  s.duration_days AS "Config",
  STRING_AGG(DISTINCT ((ss.end_date::date - ss.start_date::date) + 1)::text, ', ') AS "Durées trouvées",
  COUNT(DISTINCT ((ss.end_date::date - ss.start_date::date) + 1)) AS "Nb durées",
  COUNT(*) AS "Nb sessions",

  CASE
    WHEN COUNT(DISTINCT ((ss.end_date::date - ss.start_date::date) + 1)) > 2 THEN '🔴 CRITIQUE (3+ durées)'
    WHEN COUNT(DISTINCT ((ss.end_date::date - ss.start_date::date) + 1)) = 2 THEN '🟠 MAJEUR (2 durées)'
    WHEN s.duration_days != MIN((ss.end_date::date - ss.start_date::date) + 1) THEN '🟡 MINEUR (incohérence config)'
    ELSE '✅ OK'
  END AS "Priorité"

FROM gd_stays s
JOIN gd_stay_sessions ss ON ss.stay_slug = s.slug
WHERE s.published = true
GROUP BY s.slug, s.marketing_title, s.duration_days
HAVING
  COUNT(DISTINCT ((ss.end_date::date - ss.start_date::date) + 1)) > 1
  OR s.duration_days != MIN((ss.end_date::date - ss.start_date::date) + 1)
ORDER BY
  COUNT(DISTINCT ((ss.end_date::date - ss.start_date::date) + 1)) DESC,
  COUNT(*) DESC
LIMIT 10;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. EXPORT CSV : Toutes les sessions avec durée calculée
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  s.slug,
  s.marketing_title AS titre_ged,
  s.duration_days AS config_jours,
  TO_CHAR(ss.start_date, 'YYYY-MM-DD') AS date_debut,
  TO_CHAR(ss.end_date, 'YYYY-MM-DD') AS date_fin,
  (ss.end_date::date - ss.start_date::date) + 1 AS duree_jours_inclusifs,
  (ss.end_date::date - ss.start_date::date) AS duree_nuits,
  ss.seats_left AS places_restantes,
  CASE
    WHEN s.duration_days = ((ss.end_date::date - ss.start_date::date) + 1) THEN 'OK'
    ELSE 'ERREUR'
  END AS statut
FROM gd_stays s
JOIN gd_stay_sessions ss ON ss.stay_slug = s.slug
WHERE s.published = true
ORDER BY s.marketing_title, ss.start_date;
