-- =============================================================================
-- CORRECTION : Supprimer 1 jour aux sessions de 8 jours (8j → 7j)
-- Date: 2026-02-17
-- Problème: Sessions de 8 jours alors que UFOVAL documente 7 ou 14 jours
-- Solution: end_date - 1 jour pour les sessions de 8 jours
-- =============================================================================

-- ⚠️ ATTENTION : Ce script MODIFIE la base de données
-- Exécuter ANALYSE_PROBLEME_8_JOURS.sql AVANT pour vérification

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 1 : BACKUP AUTOMATIQUE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gd_stay_sessions_backup_8jours_20260217 AS
SELECT * FROM gd_stay_sessions
WHERE stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix', 'destination-bassin-darcachon-1',
  'natation-et-sensation', 'laventure-verticale', 'les-ptits-puisotins-1'
)
AND (end_date::date - start_date::date) + 1 = 8;


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 2 : CORRECTION (end_date - 1 jour pour sessions de 8 jours)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE gd_stay_sessions
SET
  end_date = end_date::date - INTERVAL '1 day',
  updated_at = NOW()
WHERE stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix', 'destination-bassin-darcachon-1',
  'natation-et-sensation', 'laventure-verticale', 'les-ptits-puisotins-1'
)
AND (end_date::date - start_date::date) + 1 = 8;


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 3 : MISE À JOUR duration_days (config) basé sur durée majoritaire
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE gd_stays s
SET
  duration_days = (
    SELECT MODE() WITHIN GROUP (
      ORDER BY ((ss.end_date::date - ss.start_date::date) + 1)
    )
    FROM gd_stay_sessions ss
    WHERE ss.stay_slug = s.slug
  ),
  updated_at = NOW()
WHERE s.slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix', 'destination-bassin-darcachon-1',
  'dh-experience-11-13-ans', 'natation-et-sensation', 'laventure-verticale',
  'les-ptits-puisotins-1'
)
AND EXISTS (
  SELECT 1 FROM gd_stay_sessions ss WHERE ss.stay_slug = s.slug
);


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 4 : VÉRIFICATION POST-CORRECTION
-- ─────────────────────────────────────────────────────────────────────────────
WITH sejours_ufoval AS (
  SELECT 'dh-experience-11-13-ans' AS slug, ARRAY[6, 7, 14, 21] AS durees_attendues UNION ALL
  SELECT 'aqua-gliss', ARRAY[7, 14] UNION ALL
  SELECT 'aqua-fun', ARRAY[7, 14] UNION ALL
  SELECT 'destination-bassin-darcachon-1', ARRAY[7, 12, 14, 19] UNION ALL
  SELECT 'natation-et-sensation', ARRAY[7, 14] UNION ALL
  SELECT 'laventure-verticale', ARRAY[7, 14] UNION ALL
  SELECT 'aqua-mix', ARRAY[7, 14] UNION ALL
  SELECT 'les-ptits-puisotins-1', ARRAY[7, 14, 21]
)
SELECT
  s.slug,
  s.marketing_title AS "Titre GED",
  s.duration_days AS "Config",
  COUNT(DISTINCT (ss.start_date, ss.end_date)) AS "Nb sessions",
  STRING_AGG(DISTINCT ((ss.end_date::date - ss.start_date::date) + 1)::text, ', '
    ORDER BY ((ss.end_date::date - ss.start_date::date) + 1)::text) AS "Durées réelles",
  ARRAY_TO_STRING(u.durees_attendues, ', ') AS "Durées UFOVAL",
  CASE
    WHEN COUNT(DISTINCT (ss.start_date, ss.end_date)) = 0 THEN '❌ AUCUNE SESSION'
    WHEN NOT EXISTS (
      SELECT 1 FROM gd_stay_sessions ss2
      WHERE ss2.stay_slug = s.slug
        AND ((ss2.end_date::date - ss2.start_date::date) + 1) != ALL(u.durees_attendues)
    )
    THEN '✅ OK - Toutes conformes UFOVAL'
    ELSE '⚠️ Sessions non-conformes restantes'
  END AS "Statut"
FROM sejours_ufoval u
LEFT JOIN gd_stays s ON s.slug = u.slug
LEFT JOIN gd_stay_sessions ss ON ss.stay_slug = u.slug
GROUP BY s.slug, s.marketing_title, s.duration_days, u.durees_attendues
ORDER BY
  CASE
    WHEN COUNT(DISTINCT (ss.start_date, ss.end_date)) = 0 THEN 3
    WHEN NOT EXISTS (
      SELECT 1 FROM gd_stay_sessions ss2
      WHERE ss2.stay_slug = s.slug
        AND ((ss2.end_date::date - ss2.start_date::date) + 1) != ALL(u.durees_attendues)
    ) THEN 1
    ELSE 2
  END,
  s.slug;


-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (si nécessaire)
-- ─────────────────────────────────────────────────────────────────────────────
/*
-- Supprimer les sessions modifiées
DELETE FROM gd_stay_sessions
WHERE stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix', 'destination-bassin-darcachon-1',
  'natation-et-sensation', 'laventure-verticale', 'les-ptits-puisotins-1'
);

-- Restaurer depuis backup
INSERT INTO gd_stay_sessions
SELECT * FROM gd_stay_sessions_backup_8jours_20260217;
*/
