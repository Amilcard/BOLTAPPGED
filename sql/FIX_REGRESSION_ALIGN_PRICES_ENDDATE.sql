-- =============================================================================
-- FIX RÉGRESSION : Aligner end_date dans gd_session_prices avec gd_stay_sessions
-- Date: 2026-02-22
-- Cause: Correction durées (8j→7j, 6j→7j) appliquée UNIQUEMENT sur gd_stay_sessions
--        mais PAS sur gd_session_prices → les end_date ne matchent plus
-- Conséquence: Le front ne retrouve plus les prix (jointure sur start_date + end_date)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 1 : DIAGNOSTIC — Décalage entre les deux tables
-- Montre les sessions corrigées vs les prix avec ancien end_date
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  ss.stay_slug,
  s.marketing_title AS "Titre GED",
  ss.start_date,
  ss.end_date AS "end_date SESSION (corrigé)",
  (SELECT DISTINCT sp2.end_date FROM gd_session_prices sp2
   WHERE sp2.stay_slug = ss.stay_slug AND sp2.start_date = ss.start_date
   LIMIT 1) AS "end_date PRIX (ancien)",
  (ss.end_date::date - ss.start_date::date) + 1 AS "Durée session",
  (SELECT (sp3.end_date::date - sp3.start_date::date) + 1
   FROM gd_session_prices sp3
   WHERE sp3.stay_slug = ss.stay_slug AND sp3.start_date = ss.start_date
   LIMIT 1) AS "Durée prix",
  CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM gd_session_prices sp4
      WHERE sp4.stay_slug = ss.stay_slug AND sp4.start_date = ss.start_date
    ) THEN '❌ AUCUN PRIX'
    WHEN ss.end_date = (
      SELECT sp5.end_date FROM gd_session_prices sp5
      WHERE sp5.stay_slug = ss.stay_slug AND sp5.start_date = ss.start_date
      LIMIT 1
    ) THEN '✅ ALIGNÉ'
    ELSE '🔴 DÉCALÉ — end_date prix ≠ session'
  END AS "Statut",
  (SELECT COUNT(*) FROM gd_session_prices sp6
   WHERE sp6.stay_slug = ss.stay_slug AND sp6.start_date = ss.start_date) AS "Nb lignes prix"
FROM gd_stay_sessions ss
JOIN gd_stays s ON s.slug = ss.stay_slug
WHERE ss.stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix', 'destination-bassin-darcachon-1',
  'dh-experience-11-13-ans', 'natation-et-sensation', 'laventure-verticale',
  'les-ptits-puisotins-1'
)
ORDER BY ss.stay_slug, ss.start_date;


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 2 : BACKUP gd_session_prices AVANT correction
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gd_session_prices_backup_align_enddate_2026_02_22 AS
SELECT * FROM gd_session_prices
WHERE stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix', 'destination-bassin-darcachon-1',
  'dh-experience-11-13-ans', 'natation-et-sensation', 'laventure-verticale',
  'les-ptits-puisotins-1'
);

SELECT COUNT(*) AS lignes_backup FROM gd_session_prices_backup_align_enddate_2026_02_22;


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 3A : CORRECTION — Sessions 8j→7j dans gd_session_prices
-- (même correction que gd_stay_sessions : end_date - 1 jour)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE gd_session_prices
SET end_date = end_date::date - INTERVAL '1 day'
WHERE stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix', 'destination-bassin-darcachon-1',
  'natation-et-sensation', 'laventure-verticale', 'les-ptits-puisotins-1'
)
AND (end_date::date - start_date::date) + 1 = 8;


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 3B : CORRECTION — Session 6j→7j dans gd_session_prices
-- (les-ptits-puisotins-1 : end_date + 1 jour)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE gd_session_prices
SET end_date = end_date::date + INTERVAL '1 day'
WHERE stay_slug = 'les-ptits-puisotins-1'
AND (end_date::date - start_date::date) + 1 = 6;


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 4 : VÉRIFICATION — Tous les prix sont alignés avec les sessions
-- ─────────────────────────────────────────────────────────────────────────────

-- 4A : Plus aucun décalage end_date
SELECT
  ss.stay_slug,
  s.marketing_title,
  ss.start_date,
  ss.end_date AS "end_date SESSION",
  COUNT(sp.*) AS "Nb lignes prix matchées",
  CASE
    WHEN COUNT(sp.*) = 0 THEN '❌ AUCUN PRIX'
    ELSE '✅ PRIX ALIGNÉS (' || COUNT(sp.*)::text || ' villes)'
  END AS "Statut"
FROM gd_stay_sessions ss
JOIN gd_stays s ON s.slug = ss.stay_slug
LEFT JOIN gd_session_prices sp
  ON sp.stay_slug = ss.stay_slug
  AND sp.start_date = ss.start_date
  AND sp.end_date = ss.end_date  -- JOINTURE EXACTE sur end_date
WHERE ss.stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix', 'destination-bassin-darcachon-1',
  'dh-experience-11-13-ans', 'natation-et-sensation', 'laventure-verticale',
  'les-ptits-puisotins-1'
)
GROUP BY ss.stay_slug, s.marketing_title, ss.start_date, ss.end_date
ORDER BY ss.stay_slug, ss.start_date;


-- 4B : Vérification des surcharges transport (marge 18€ toujours intacte)
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
WHERE stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix', 'destination-bassin-darcachon-1',
  'dh-experience-11-13-ans', 'natation-et-sensation', 'laventure-verticale',
  'les-ptits-puisotins-1'
)
GROUP BY city_departure, transport_surcharge_ufoval, transport_surcharge_ged
ORDER BY city_departure;


-- 4C : Vérification surcoûts par durée (180, 240, 410)
SELECT
  sp.stay_slug,
  s.marketing_title,
  (sp.end_date::date - sp.start_date::date) + 1 AS duree_jours,
  sp.city_departure,
  sp.base_price_eur AS "Prix base UFOVAL",
  sp.transport_surcharge_ged AS "Surcharge transport GED",
  sp.price_ged_total AS "Prix total GED",
  sp.price_ged_total - sp.base_price_eur - COALESCE(sp.transport_surcharge_ged, 0) AS "Markup durée estimé",
  CASE
    WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 5 AND 8
      AND sp.price_ged_total - sp.base_price_eur - COALESCE(sp.transport_surcharge_ged, 0) BETWEEN 170 AND 190
    THEN '✅ ~180€ (tranche 7j)'
    WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 11 AND 15
      AND sp.price_ged_total - sp.base_price_eur - COALESCE(sp.transport_surcharge_ged, 0) BETWEEN 230 AND 250
    THEN '✅ ~240€ (tranche 14j)'
    WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 18 AND 22
      AND sp.price_ged_total - sp.base_price_eur - COALESCE(sp.transport_surcharge_ged, 0) BETWEEN 400 AND 420
    THEN '✅ ~410€ (tranche 21j)'
    ELSE '⚠️ Markup à vérifier'
  END AS "Statut markup"
FROM gd_session_prices sp
JOIN gd_stays s ON s.slug = sp.stay_slug
WHERE sp.stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix', 'destination-bassin-darcachon-1',
  'dh-experience-11-13-ans', 'natation-et-sensation', 'laventure-verticale',
  'les-ptits-puisotins-1'
)
AND sp.city_departure = 'sans_transport'
ORDER BY sp.stay_slug, duree_jours, sp.start_date;


-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (si nécessaire)
-- ─────────────────────────────────────────────────────────────────────────────
/*
-- Option 1 : Restaurer depuis le backup de ce jour
DELETE FROM gd_session_prices
WHERE stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix', 'destination-bassin-darcachon-1',
  'dh-experience-11-13-ans', 'natation-et-sensation', 'laventure-verticale',
  'les-ptits-puisotins-1'
);

INSERT INTO gd_session_prices
SELECT * FROM gd_session_prices_backup_align_enddate_2026_02_22;

-- Option 2 : Restaurer depuis le backup P0 du 18/02 (état le plus cohérent)
DELETE FROM gd_session_prices
WHERE stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix', 'destination-bassin-darcachon-1',
  'dh-experience-11-13-ans', 'natation-et-sensation', 'laventure-verticale',
  'les-ptits-puisotins-1'
);

INSERT INTO gd_session_prices
SELECT * FROM gd_session_prices_backup_p0_2026_02_18;
*/
