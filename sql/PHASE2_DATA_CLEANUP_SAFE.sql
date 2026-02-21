-- =============================================================================
-- PHASE 2 DATA CLEANUP — VERSION SÉCURISÉE
-- Date: 2026-02-18
-- Source: audit_analysis_v3 (DATA_CORRUPTION_IDENTIFIED)
-- Root cause: Calcul Dim-Dim (8j) au lieu de Dim-Sam (7j) dans le scraper
-- =============================================================================
-- ⚠️  IMPORTANT : NE PAS utiliser DELETE WHERE duree = 8 sans filtre !
--     Des sessions 8j LÉGITIMES existent avec 19 villes (durées UFOVAL réelles)
--     sur d'autres séjours (RIVIERA, CORSICA, WEST COAST, BRETAGNE).
--     Le critère de suppression sécurisé = nb_villes = 1 (orphelins d'import)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PRÉ-VALIDATION — À exécuter AVANT toute action
-- ─────────────────────────────────────────────────────────────────────────────

-- PV-1 : Confirmer les sessions 8j légitimes (ne pas toucher)
-- Si ces sessions ont 19 villes → durées UFOVAL réelles → exclure du DELETE
SELECT
  stay_slug,
  start_date,
  end_date,
  (end_date::date - start_date::date) + 1 AS duree_jours,
  COUNT(*) AS nb_villes,
  CASE WHEN COUNT(*) = 1 THEN '❌ ORPHELIN — À SUPPRIMER' ELSE '✅ LÉGITIME' END AS statut
FROM gd_session_prices
GROUP BY stay_slug, start_date, end_date
HAVING (end_date::date - start_date::date) + 1 = 8
ORDER BY nb_villes, stay_slug, start_date;

-- PV-2 : Confirmer 23/08 de Gravity Bike sur UFOVAL = fin le 29/08 (Samedi)
-- [Vérification manuelle requise sur UFOVAL avant d'exécuter l'UPDATE]
SELECT
  stay_slug, start_date, end_date,
  (end_date::date - start_date::date) + 1 AS duree_actuelle
FROM gd_stay_sessions
WHERE stay_slug = 'dh-experience-11-13-ans'
  AND start_date = '2026-08-23';
-- Attendu : end_date = 2026-08-28 (6j) → sera corrigé en 2026-08-29 (7j)


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 1 : DELETE sessions fantômes 8j (Dim-Dim) — CRITÈRE SÉCURISÉ
-- Seuls les orphelins avec 1 seule ville sont supprimés
-- ─────────────────────────────────────────────────────────────────────────────

-- 1A : Backup ciblé orphelins
CREATE TABLE IF NOT EXISTS gd_session_prices_orphelins_backup_2026_02_18 AS
SELECT sp.*
FROM gd_session_prices sp
WHERE (sp.end_date::date - sp.start_date::date) + 1 = 8
AND (
  SELECT COUNT(*)
  FROM gd_session_prices sp2
  WHERE sp2.stay_slug  = sp.stay_slug
    AND sp2.start_date = sp.start_date
    AND sp2.end_date   = sp.end_date
) = 1;

SELECT COUNT(*) AS orphelins_sauvegardes FROM gd_session_prices_orphelins_backup_2026_02_18;

-- 1B : DELETE gd_session_prices — orphelins uniquement (DÉCOMMENTER APRÈS PV-1)
/*
DELETE FROM gd_session_prices sp
WHERE (sp.end_date::date - sp.start_date::date) + 1 = 8  -- durée 8j
AND (
  -- Critère de sécurité : seulement si c'est la seule ville pour ce combo
  SELECT COUNT(*)
  FROM gd_session_prices sp2
  WHERE sp2.stay_slug  = sp.stay_slug
    AND sp2.start_date = sp.start_date
    AND sp2.end_date   = sp.end_date
) = 1
RETURNING stay_slug, start_date, end_date, city_departure;
-- Attendu : 16 lignes (5 séjours × 3 dates + 1 destination-bassin)
-- aqua-fun: 3, aqua-gliss: 3, aqua-mix: 3, laventure: 3, natation: 3, bassin: 1
*/

-- 1C : DELETE gd_stay_sessions — orphelins 8j (si présents)
-- Note: Les séjours aqua/laventure/natation avaient les sessions 7j correctes dans
-- gd_stay_sessions. Les 8j dans prices étaient des lignes parasites d'import.
-- Si gd_stay_sessions contient AUSSI des sessions 8j pour ces séjours → les supprimer
/*
DELETE FROM gd_stay_sessions
WHERE (end_date::date - start_date::date) + 1 = 8
AND stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix',
  'laventure-verticale', 'natation-et-sensation',
  'destination-bassin-darcachon-1'
)
-- Sécurité : seulement si une session 7j valide existe déjà pour ce start_date
AND EXISTS (
  SELECT 1 FROM gd_stay_sessions ss2
  WHERE ss2.stay_slug   = gd_stay_sessions.stay_slug
    AND ss2.start_date  = gd_stay_sessions.start_date
    AND (ss2.end_date::date - ss2.start_date::date) + 1 = 7
)
RETURNING stay_slug, start_date, end_date;
*/


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 2 : UPDATE Gravity Bike Park 6j → 7j (23/08/2026)
-- Correction dans les DEUX tables (stay_sessions + session_prices)
-- ─────────────────────────────────────────────────────────────────────────────

-- 2A : UPDATE gd_stay_sessions (DÉCOMMENTER APRÈS PV-2 CONFIRMÉ)
/*
UPDATE gd_stay_sessions
SET end_date = '2026-08-29'
WHERE stay_slug  = 'dh-experience-11-13-ans'
  AND start_date = '2026-08-23'
  AND end_date   = '2026-08-28'  -- Sécurité : ne touche que la session 6j connue
RETURNING stay_slug, start_date, end_date AS end_date_corrige;
-- Attendu : 1 ligne, end_date = 2026-08-29 ✅
*/

-- 2B : UPDATE gd_session_prices — CRITIQUE, doit suivre 2A immédiatement
-- Sans cette étape, les 18 prix (end_date=28/08) ne matchent plus la session (end_date=29/08)
/*
UPDATE gd_session_prices
SET end_date = '2026-08-29'
WHERE stay_slug  = 'dh-experience-11-13-ans'
  AND start_date = '2026-08-23'
  AND end_date   = '2026-08-28'
RETURNING stay_slug, start_date, end_date AS end_date_corrige, city_departure;
-- Attendu : 18 lignes (une par ville de départ)
*/

-- MÊME CORRECTION pour les-ptits-puisotins-1 si concerné
/*
UPDATE gd_stay_sessions
SET end_date = '2026-08-29'
WHERE stay_slug  = 'les-ptits-puisotins-1'
  AND start_date = '2026-08-23'
  AND end_date   = '2026-08-28';

UPDATE gd_session_prices
SET end_date = '2026-08-29'
WHERE stay_slug  = 'les-ptits-puisotins-1'
  AND start_date = '2026-08-23'
  AND end_date   = '2026-08-28';
-- Attendu : 5 lignes (5 villes)
*/


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 3 : INSERT sessions GRAVITY BIKE manquantes (12/07 + 26/07)
-- is_full=true pour 12/07 (confirmé UFOVAL), false pour 26/07 (disponible)
-- Copie TOUTES les villes depuis session source (07-05→07-11)
-- ─────────────────────────────────────────────────────────────────────────────

-- 3A : Vérifier session source (doit avoir 18 villes)
SELECT COUNT(*) AS nb_villes_source
FROM gd_session_prices
WHERE stay_slug  = 'dh-experience-11-13-ans'
  AND start_date = '2026-07-05'
  AND end_date   = '2026-07-11';
-- Attendu : 18

-- 3B : INSERT session 12/07→18/07 (COMPLET) dans stay_sessions
/*
INSERT INTO gd_stay_sessions (stay_slug, start_date, end_date, is_full, seats_left)
VALUES ('dh-experience-11-13-ans', '2026-07-12', '2026-07-18', true, NULL)
ON CONFLICT (stay_slug, start_date) DO NOTHING
RETURNING *;
*/

-- 3C : INSERT prix 12/07→18/07 — copie des 18 villes
/*
INSERT INTO gd_session_prices (
  stay_slug, start_date, end_date,
  base_price_eur, currency, city_departure,
  transport_surcharge_ufoval, price_ged_total,
  transport_surcharge_ged, is_full
)
SELECT
  'dh-experience-11-13-ans',
  DATE '2026-07-12',
  DATE '2026-07-18',
  base_price_eur, currency, city_departure,
  transport_surcharge_ufoval, price_ged_total,
  transport_surcharge_ged, true
FROM gd_session_prices
WHERE stay_slug  = 'dh-experience-11-13-ans'
  AND start_date = '2026-07-05'
  AND end_date   = '2026-07-11'
ON CONFLICT DO NOTHING
RETURNING stay_slug, start_date, end_date, city_departure;
-- Attendu : 18 lignes
*/

-- 3D : INSERT session 26/07→01/08 (DISPONIBLE)
/*
INSERT INTO gd_stay_sessions (stay_slug, start_date, end_date, is_full, seats_left)
VALUES ('dh-experience-11-13-ans', '2026-07-26', '2026-08-01', false, NULL)
ON CONFLICT (stay_slug, start_date) DO NOTHING
RETURNING *;
*/

-- 3E : INSERT prix 26/07→01/08 — copie des 18 villes
/*
INSERT INTO gd_session_prices (
  stay_slug, start_date, end_date,
  base_price_eur, currency, city_departure,
  transport_surcharge_ufoval, price_ged_total,
  transport_surcharge_ged, is_full
)
SELECT
  'dh-experience-11-13-ans',
  DATE '2026-07-26',
  DATE '2026-08-01',
  base_price_eur, currency, city_departure,
  transport_surcharge_ufoval, price_ged_total,
  transport_surcharge_ged, false
FROM gd_session_prices
WHERE stay_slug  = 'dh-experience-11-13-ans'
  AND start_date = '2026-07-05'
  AND end_date   = '2026-07-11'
ON CONFLICT DO NOTHING
RETURNING stay_slug, start_date, end_date, city_departure;
-- Attendu : 18 lignes
*/


-- ─────────────────────────────────────────────────────────────────────────────
-- CHECKPOINT FINAL
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  CASE
    WHEN COUNT(*) = 0
    THEN '✅ PHASE 2 CLEANUP VALIDÉE — Plus aucun orphelin 8j/1-ville'
    ELSE '❌ ' || COUNT(*) || ' sessions orphelines restantes'
  END AS checkpoint_phase2
FROM (
  SELECT stay_slug, start_date, end_date, COUNT(*) AS nb_villes
  FROM gd_session_prices
  WHERE stay_slug IN (
    'aqua-fun','aqua-gliss','aqua-mix',
    'destination-bassin-darcachon-1','dh-experience-11-13-ans',
    'laventure-verticale','les-ptits-puisotins-1','natation-et-sensation'
  )
  GROUP BY stay_slug, start_date, end_date
  HAVING COUNT(*) = 1
) orphelins_restants;
