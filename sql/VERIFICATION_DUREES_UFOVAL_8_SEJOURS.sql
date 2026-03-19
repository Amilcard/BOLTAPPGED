-- =============================================================================
-- VÉRIFICATION DURÉES : 8 séjours UFOVAL spécifiés
-- Date: 2026-02-17
-- Objectif: Vérifier les durées réelles vs durées UFOVAL documentées
-- Règle: Durée = jours inclusifs (jour arrivée + jour départ)
-- =============================================================================

-- Liste des 8 séjours à vérifier avec leurs durées UFOVAL attendues
WITH sejours_ufoval AS (
  SELECT 'dh-experience-11-13-ans' AS slug, 'DH Experience 11-13 ans' AS nom_ufoval, ARRAY[6, 7, 14, 21] AS durees_attendues UNION ALL
  SELECT 'aqua-gliss', 'Aqua'' Gliss', ARRAY[7, 14] UNION ALL
  SELECT 'aqua-fun', 'Aqua'' Fun', ARRAY[7, 14] UNION ALL
  SELECT 'destination-bassin-darcachon-1', 'Destination Bassin d''Arcachon', ARRAY[7, 12, 14, 19] UNION ALL
  SELECT 'natation-et-sensation', 'Natation et sensation', ARRAY[7, 14] UNION ALL
  SELECT 'laventure-verticale', 'L''aventure verticale', ARRAY[7, 14] UNION ALL
  SELECT 'aqua-mix', 'Aqua'' Mix', ARRAY[7, 14] UNION ALL
  SELECT 'les-ptits-puisotins-1', 'Les P''tits Puisotins', ARRAY[7, 14, 21]
),

-- Calcul des durées réelles dans gd_stay_sessions
durees_reelles AS (
  SELECT
    ss.stay_slug,
    (ss.end_date::date - ss.start_date::date) + 1 AS duree_jours_inclusifs,
    (ss.end_date::date - ss.start_date::date) AS duree_nuits,
    COUNT(*) AS nb_sessions
  FROM gd_stay_sessions ss
  WHERE ss.stay_slug IN (
    'dh-experience-11-13-ans', 'aqua-gliss', 'aqua-fun',
    'destination-bassin-darcachon-1', 'natation-et-sensation',
    'laventure-verticale', 'aqua-mix', 'les-ptits-puisotins-1'
  )
  GROUP BY ss.stay_slug, ss.end_date, ss.start_date
)

-- ─────────────────────────────────────────────────────────────────────────────
-- RÉSULTAT PRINCIPAL : Comparaison UFOVAL vs RÉEL
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  u.slug,
  u.nom_ufoval AS "Nom UFOVAL",
  s.marketing_title AS "Nom GED",
  s.duration_days AS "Config duration_days",

  -- Durées attendues selon doc UFOVAL
  ARRAY_TO_STRING(u.durees_attendues, ', ') AS "Durées UFOVAL attendues",

  -- Durées réelles trouvées
  COALESCE(
    (SELECT STRING_AGG(DISTINCT dr.duree_jours_inclusifs::text, ', ' ORDER BY dr.duree_jours_inclusifs::text)
     FROM durees_reelles dr WHERE dr.stay_slug = u.slug),
    '❌ AUCUNE SESSION'
  ) AS "Durées réelles (jours inclusifs)",

  -- Détection erreur NUITS au lieu de JOURS
  COALESCE(
    (SELECT STRING_AGG(DISTINCT dr.duree_nuits::text, ', ' ORDER BY dr.duree_nuits::text)
     FROM durees_reelles dr WHERE dr.stay_slug = u.slug),
    'N/A'
  ) AS "Durées si comptées en NUITS",

  -- Nombre de sessions
  COALESCE(
    (SELECT SUM(nb_sessions) FROM durees_reelles dr WHERE dr.stay_slug = u.slug),
    0
  ) AS "Nb sessions",

  -- Statut
  CASE
    -- Pas de sessions
    WHEN NOT EXISTS (SELECT 1 FROM durees_reelles dr WHERE dr.stay_slug = u.slug)
    THEN '❌ AUCUNE SESSION'

    -- Vérifier si durées réelles matchent durées UFOVAL (jours inclusifs)
    WHEN (
      SELECT BOOL_AND(dr.duree_jours_inclusifs = ANY(u.durees_attendues))
      FROM durees_reelles dr WHERE dr.stay_slug = u.slug
    ) THEN '✅ OK (jours inclusifs)'

    -- Vérifier si erreur NUITS (durées réelles - 1 = durées UFOVAL)
    WHEN (
      SELECT BOOL_AND(dr.duree_nuits = ANY(u.durees_attendues))
      FROM durees_reelles dr WHERE dr.stay_slug = u.slug
    ) THEN '⚠️ ERREUR NUITS (à corriger)'

    ELSE '❌ INCOHÉRENT'
  END AS "Statut"

FROM sejours_ufoval u
LEFT JOIN gd_stays s ON s.slug = u.slug
ORDER BY
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM durees_reelles dr WHERE dr.stay_slug = u.slug) THEN 3
    WHEN (SELECT BOOL_AND(dr.duree_nuits = ANY(u.durees_attendues))
          FROM durees_reelles dr WHERE dr.stay_slug = u.slug) THEN 2
    WHEN (SELECT BOOL_AND(dr.duree_jours_inclusifs = ANY(u.durees_attendues))
          FROM durees_reelles dr WHERE dr.stay_slug = u.slug) THEN 1
    ELSE 3
  END,
  u.slug;
