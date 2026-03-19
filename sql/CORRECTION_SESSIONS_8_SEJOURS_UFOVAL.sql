-- =============================================================================
-- CORRECTION SESSIONS : 8 séjours UFOVAL
-- Date: 2026-02-17
-- Objectif: Mettre à jour les sessions pour correspondre aux durées UFOVAL
-- Méthode: Ajuster end_date pour respecter les durées en jours inclusifs
-- =============================================================================

-- ⚠️ ATTENTION : Ce script modifie les données
-- À exécuter APRÈS avoir vérifié les résultats de VERIFICATION_DUREES_UFOVAL_8_SEJOURS.sql

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 1 : VÉRIFICATION PRÉ-CORRECTION
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  sessions_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO sessions_count
  FROM gd_stay_sessions
  WHERE stay_slug IN (
    'dh-experience-11-13-ans', 'aqua-gliss', 'aqua-fun',
    'destination-bassin-darcachon-1', 'natation-et-sensation',
    'laventure-verticale', 'aqua-mix', 'les-ptits-puisotins-1'
  );

  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Nombre de sessions à vérifier: %', sessions_count;
  RAISE NOTICE '==============================================';
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 2 : BACKUP DES SESSIONS AVANT CORRECTION
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gd_stay_sessions_backup_20260217 AS
SELECT * FROM gd_stay_sessions
WHERE stay_slug IN (
  'dh-experience-11-13-ans', 'aqua-gliss', 'aqua-fun',
  'destination-bassin-darcachon-1', 'natation-et-sensation',
  'laventure-verticale', 'aqua-mix', 'les-ptits-puisotins-1'
);

RAISE NOTICE 'Backup créé: gd_stay_sessions_backup_20260217';


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 3 : CORRECTION AUTOMATIQUE (si erreur NUITS détectée)
-- ─────────────────────────────────────────────────────────────────────────────

-- Cas A : Sessions comptées en NUITS au lieu de JOURS
-- Solution : Ajouter 1 jour à end_date
-- Exemple : start_date = 1er juillet, end_date = 7 juillet
--           Durée actuelle = 6 jours (NUITS)
--           Correction = end_date → 8 juillet (7 jours INCLUSIFS)

WITH sessions_a_corriger AS (
  SELECT
    ss.id,
    ss.stay_slug,
    ss.start_date,
    ss.end_date,
    (ss.end_date::date - ss.start_date::date) AS duree_nuits,
    (ss.end_date::date - ss.start_date::date) + 1 AS duree_jours_inclusifs,

    -- Durées attendues par séjour
    CASE stay_slug
      WHEN 'dh-experience-11-13-ans' THEN ARRAY[6, 7, 14, 21]
      WHEN 'aqua-gliss' THEN ARRAY[7, 14]
      WHEN 'aqua-fun' THEN ARRAY[7, 14]
      WHEN 'destination-bassin-darcachon-1' THEN ARRAY[7, 12, 14, 19]
      WHEN 'natation-et-sensation' THEN ARRAY[7, 14]
      WHEN 'laventure-verticale' THEN ARRAY[7, 14]
      WHEN 'aqua-mix' THEN ARRAY[7, 14]
      WHEN 'les-ptits-puisotins-1' THEN ARRAY[7, 14, 21]
    END AS durees_attendues
  FROM gd_stay_sessions ss
  WHERE ss.stay_slug IN (
    'dh-experience-11-13-ans', 'aqua-gliss', 'aqua-fun',
    'destination-bassin-darcachon-1', 'natation-et-sensation',
    'laventure-verticale', 'aqua-mix', 'les-ptits-puisotins-1'
  )
)

-- Mise à jour : Ajouter 1 jour à end_date si durée actuelle (nuits) = durée attendue
UPDATE gd_stay_sessions ss
SET
  end_date = ss.end_date::date + INTERVAL '1 day',
  updated_at = NOW()
FROM sessions_a_corriger sac
WHERE ss.id = sac.id
  AND sac.duree_nuits = ANY(sac.durees_attendues)  -- Durée en NUITS correspond à doc UFOVAL
  AND sac.duree_jours_inclusifs != ANY(sac.durees_attendues); -- Durée en JOURS ne correspond PAS

-- Log du résultat
DO $$
DECLARE
  nb_corrections INTEGER;
BEGIN
  GET DIAGNOSTICS nb_corrections = ROW_COUNT;
  RAISE NOTICE '✅ Nombre de sessions corrigées (end_date +1 jour): %', nb_corrections;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 4 : MISE À JOUR duration_days DANS gd_stays
-- ─────────────────────────────────────────────────────────────────────────────

-- Recalculer duration_days basé sur la durée la plus fréquente
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
  'dh-experience-11-13-ans', 'aqua-gliss', 'aqua-fun',
  'destination-bassin-darcachon-1', 'natation-et-sensation',
  'laventure-verticale', 'aqua-mix', 'les-ptits-puisotins-1'
)
AND EXISTS (
  SELECT 1 FROM gd_stay_sessions ss WHERE ss.stay_slug = s.slug
);

RAISE NOTICE '✅ duration_days mis à jour pour les 8 séjours';


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 5 : VÉRIFICATION POST-CORRECTION
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
),
stats AS (
  SELECT
    u.slug,
    s.marketing_title,
    s.duration_days,
    COUNT(ss.id) AS nb_sessions,
    STRING_AGG(DISTINCT ((ss.end_date::date - ss.start_date::date) + 1)::text, ', '
      ORDER BY ((ss.end_date::date - ss.start_date::date) + 1)::text) AS durees_reelles,
    BOOL_AND(((ss.end_date::date - ss.start_date::date) + 1) = ANY(u.durees_attendues)) AS toutes_coherentes
  FROM sejours_ufoval u
  LEFT JOIN gd_stays s ON s.slug = u.slug
  LEFT JOIN gd_stay_sessions ss ON ss.stay_slug = u.slug
  GROUP BY u.slug, s.marketing_title, s.duration_days
)
SELECT
  slug,
  marketing_title AS "Titre GED",
  duration_days AS "Config",
  nb_sessions AS "Nb sessions",
  durees_reelles AS "Durées réelles",
  CASE
    WHEN nb_sessions = 0 THEN '❌ AUCUNE SESSION'
    WHEN toutes_coherentes THEN '✅ OK'
    ELSE '⚠️ Incohérence restante'
  END AS "Statut post-correction"
FROM stats
ORDER BY
  CASE
    WHEN nb_sessions = 0 THEN 3
    WHEN toutes_coherentes THEN 1
    ELSE 2
  END,
  slug;


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 6 : RESTAURATION (si nécessaire)
-- ─────────────────────────────────────────────────────────────────────────────

-- SI BESOIN DE ROLLBACK, exécuter cette requête:
/*
DELETE FROM gd_stay_sessions
WHERE stay_slug IN (
  'dh-experience-11-13-ans', 'aqua-gliss', 'aqua-fun',
  'destination-bassin-darcachon-1', 'natation-et-sensation',
  'laventure-verticale', 'aqua-mix', 'les-ptits-puisotins-1'
);

INSERT INTO gd_stay_sessions
SELECT * FROM gd_stay_sessions_backup_20260217;

RAISE NOTICE '✅ Restauration effectuée depuis backup';
*/
