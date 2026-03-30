-- =============================================================================
-- VISUALISATION SESSIONS PAR SÉJOUR (nombre de jours)
-- Date: 2026-02-17
-- Objectif: Voir les différentes durées de sessions proposées par séjour
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SESSIONS PAR SÉJOUR : Nombre de jours calculé
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  s.slug,
  s.marketing_title AS "Titre GED",
  s.title AS "Titre UFOVAL",
  s.age_min || '-' || s.age_max || ' ans' AS "Âge",

  -- Calcul durée session (end_date - start_date)
  (ss.end_date::date - ss.start_date::date) AS "Nb jours session",

  -- Durée configurée dans gd_stays
  s.duration_days AS "Durée config",

  -- Nombre de sessions
  COUNT(*) OVER (PARTITION BY s.slug) AS "Nb sessions totales",

  -- Places
  ss.seats_left AS "Places restantes",

  -- Dates (pour info)
  TO_CHAR(ss.start_date, 'DD/MM/YYYY') AS "Début",
  TO_CHAR(ss.end_date, 'DD/MM/YYYY') AS "Fin"

FROM gd_stays s
JOIN gd_stay_sessions ss ON ss.stay_slug = s.slug
WHERE s.published = true
ORDER BY s.marketing_title, ss.start_date;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RÉSUMÉ PAR SÉJOUR : Durées distinctes proposées
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  s.slug,
  s.marketing_title AS "Titre GED",
  s.age_min || '-' || s.age_max || ' ans' AS "Âge",

  -- Durées distinctes proposées
  STRING_AGG(DISTINCT (ss.end_date::date - ss.start_date::date)::text, ', ' ORDER BY (ss.end_date::date - ss.start_date::date)::text) AS "Durées proposées (jours)",

  -- Nombre de sessions par durée
  COUNT(*) AS "Nb sessions total",

  -- Durée la plus courante
  MODE() WITHIN GROUP (ORDER BY (ss.end_date::date - ss.start_date::date)) AS "Durée la + fréquente",

  -- Durée min/max
  MIN(ss.end_date::date - ss.start_date::date) AS "Durée min",
  MAX(ss.end_date::date - ss.start_date::date) AS "Durée max"

FROM gd_stays s
JOIN gd_stay_sessions ss ON ss.stay_slug = s.slug
WHERE s.published = true
GROUP BY s.slug, s.marketing_title, s.age_min, s.age_max
ORDER BY s.marketing_title;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SÉJOURS AVEC DURÉES VARIABLES : Détection multi-durées
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  s.slug,
  s.marketing_title AS "Titre GED",
  s.duration_days AS "Durée config",

  -- Durées réelles trouvées
  STRING_AGG(DISTINCT (ss.end_date::date - ss.start_date::date)::text, ', ') AS "Durées réelles (jours)",

  -- Nombre de durées différentes
  COUNT(DISTINCT (ss.end_date::date - ss.start_date::date)) AS "Nb durées différentes",

  CASE
    WHEN COUNT(DISTINCT (ss.end_date::date - ss.start_date::date)) > 1 THEN '⚠️ Multi-durées'
    ELSE '✅ Durée unique'
  END AS "Alerte"

FROM gd_stays s
JOIN gd_stay_sessions ss ON ss.stay_slug = s.slug
WHERE s.published = true
GROUP BY s.slug, s.marketing_title, s.duration_days
ORDER BY COUNT(DISTINCT (ss.end_date::date - ss.start_date::date)) DESC, s.marketing_title;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. STATISTIQUES GLOBALES : Distribution des durées
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  (ss.end_date::date - ss.start_date::date) AS "Durée (jours)",
  COUNT(*) AS "Nb sessions",
  COUNT(DISTINCT s.slug) AS "Nb séjours",
  STRING_AGG(DISTINCT s.marketing_title, ', ' ORDER BY s.marketing_title) AS "Séjours"
FROM gd_stays s
JOIN gd_stay_sessions ss ON ss.stay_slug = s.slug
WHERE s.published = true
GROUP BY (ss.end_date::date - ss.start_date::date)
ORDER BY (ss.end_date::date - ss.start_date::date);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. VÉRIFICATION COHÉRENCE : duration_days vs durée réelle
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  s.slug,
  s.marketing_title AS "Titre GED",
  s.duration_days AS "Durée config",
  (ss.end_date::date - ss.start_date::date) AS "Durée réelle session",

  CASE
    WHEN s.duration_days = (ss.end_date::date - ss.start_date::date) THEN '✅ Cohérent'
    ELSE '⚠️ INCOHÉRENCE'
  END AS "Statut",

  TO_CHAR(ss.start_date, 'DD/MM/YYYY') AS "Début",
  TO_CHAR(ss.end_date, 'DD/MM/YYYY') AS "Fin"

FROM gd_stays s
JOIN gd_stay_sessions ss ON ss.stay_slug = s.slug
WHERE s.published = true
  AND s.duration_days IS NOT NULL
ORDER BY
  CASE WHEN s.duration_days = (ss.end_date::date - ss.start_date::date) THEN 1 ELSE 0 END,
  s.marketing_title, ss.start_date;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. EXPORT SIMPLIFIÉ : Séjour + Durée unique
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  s.slug,
  s.marketing_title AS titre_ged,
  s.age_min || '-' || s.age_max || ' ans' AS age,
  s.duration_days AS duree_config,

  -- Si une seule durée réelle, l'afficher, sinon "VARIABLE"
  CASE
    WHEN COUNT(DISTINCT (ss.end_date::date - ss.start_date::date)) = 1
    THEN MIN(ss.end_date::date - ss.start_date::date)::text || ' jours'
    ELSE 'VARIABLE (' || STRING_AGG(DISTINCT (ss.end_date::date - ss.start_date::date)::text, ', ') || ')'
  END AS duree_sessions,

  COUNT(*) AS nb_sessions

FROM gd_stays s
JOIN gd_stay_sessions ss ON ss.stay_slug = s.slug
WHERE s.published = true
GROUP BY s.slug, s.marketing_title, s.age_min, s.age_max, s.duration_days
ORDER BY s.marketing_title;
