-- =============================================================================
-- CORRECTION : Session de 6 jours → 7 jours pour MY LITTLE FOREST
-- Date: 2026-02-17
-- Séjour: les-ptits-puisotins-1 (MY LITTLE FOREST)
-- Problème: Session de 6 jours au lieu de 7 (calcul en nuits au lieu de jours)
-- Solution: end_date + 1 jour pour session de 6 jours
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 1 : ANALYSE - Identifier la session de 6 jours
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  stay_slug,
  TO_CHAR(start_date, 'DD/MM/YYYY') AS "Date début",
  TO_CHAR(end_date, 'DD/MM/YYYY') AS "Date fin ACTUELLE",
  (end_date::date - start_date::date) + 1 AS "Durée actuelle (jours)",
  (end_date::date - start_date::date) AS "Si comptée en nuits",
  TO_CHAR(end_date::date + INTERVAL '1 day', 'DD/MM/YYYY') AS "Date fin CORRIGÉE (+1j)",
  ((end_date::date + INTERVAL '1 day')::date - start_date::date) + 1 AS "Durée après correction",
  seats_left AS "Places restantes"
FROM gd_stay_sessions
WHERE stay_slug = 'les-ptits-puisotins-1'
  AND (end_date::date - start_date::date) + 1 = 6
ORDER BY start_date;


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 2 : BACKUP AUTOMATIQUE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gd_stay_sessions_backup_6jours_ptits_puisotins AS
SELECT * FROM gd_stay_sessions
WHERE stay_slug = 'les-ptits-puisotins-1'
  AND (end_date::date - start_date::date) + 1 = 6;


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 3 : CORRECTION (end_date + 1 jour pour passer de 6j à 7j)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE gd_stay_sessions
SET
  end_date = end_date::date + INTERVAL '1 day',
  updated_at = NOW()
WHERE stay_slug = 'les-ptits-puisotins-1'
  AND (end_date::date - start_date::date) + 1 = 6;


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 4 : VÉRIFICATION POST-CORRECTION
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  stay_slug,
  s.marketing_title AS "Titre GED",
  COUNT(DISTINCT (ss.start_date, ss.end_date)) AS "Nb sessions",
  STRING_AGG(DISTINCT ((ss.end_date::date - ss.start_date::date) + 1)::text, ', '
    ORDER BY ((ss.end_date::date - ss.start_date::date) + 1)::text) AS "Durées réelles",
  '7, 14, 21' AS "Durées UFOVAL attendues",
  CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM gd_stay_sessions ss2
      WHERE ss2.stay_slug = 'les-ptits-puisotins-1'
        AND ((ss2.end_date::date - ss2.start_date::date) + 1) NOT IN (7, 14, 21)
    )
    THEN '✅ OK - Toutes conformes UFOVAL'
    ELSE '❌ Anomalie restante'
  END AS "Statut"
FROM gd_stay_sessions ss
JOIN gd_stays s ON s.slug = ss.stay_slug
WHERE ss.stay_slug = 'les-ptits-puisotins-1'
GROUP BY ss.stay_slug, s.marketing_title;


-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (si nécessaire)
-- ─────────────────────────────────────────────────────────────────────────────
/*
-- Supprimer les sessions modifiées
DELETE FROM gd_stay_sessions
WHERE stay_slug = 'les-ptits-puisotins-1';

-- Restaurer depuis backup
INSERT INTO gd_stay_sessions
SELECT * FROM gd_stay_sessions_backup_6jours_ptits_puisotins;
*/
