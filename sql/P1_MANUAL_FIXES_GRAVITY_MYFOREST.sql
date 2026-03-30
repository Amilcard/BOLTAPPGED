-- =============================================================================
-- P1 — CORRECTIONS MANUELLES POST-GHOST-CLEANUP
-- Gravity Bike Park + My Little Forest
-- Date: 2026-02-18
-- À exécuter APRÈS P0_DELETE_GHOST_8J_FINAL.sql (checkpoint = 0 ghosts)
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOC A : GRAVITY BIKE PARK (dh-experience-11-13-ans)
-- Fix 1 : session 23/08 stockée 6j → corriger en 7j (fin 29/08)
-- Fix 2 : INSERT sessions manquantes 12/07 et 26/07
-- ─────────────────────────────────────────────────────────────────────────────

-- A0 : État actuel avant tout
SELECT stay_slug, start_date, end_date,
       (end_date::date - start_date::date) + 1 AS duree_jours,
       is_full, seats_left
FROM gd_stay_sessions
WHERE stay_slug = 'dh-experience-11-13-ans'
ORDER BY start_date;

-- A1 : Vérifier la session 23/08 en 6j
SELECT COUNT(*) AS sessions_6j_gravity
FROM gd_stay_sessions
WHERE stay_slug  = 'dh-experience-11-13-ans'
  AND start_date = '2026-08-23'
  AND end_date   = '2026-08-28';
-- Attendu : 1 → UPDATE requis

-- A2 : Vérifier la session source pour copie (07-05 = session 7j référence avec 18 villes)
SELECT COUNT(*) AS nb_villes_source
FROM gd_session_prices
WHERE stay_slug  = 'dh-experience-11-13-ans'
  AND start_date = '2026-07-05'
  AND end_date   = '2026-07-11';
-- Attendu : 18 → source valide pour copie

-- ─── FIX A.1 : UPDATE session 23/08 : 6j → 7j ───
-- DÉCOMMENTER APRÈS A1 = 1 ET CONFIRMATION UFOVAL fin=29/08

/*
-- A.1a : UPDATE gd_stay_sessions
UPDATE gd_stay_sessions
SET end_date = '2026-08-29'
WHERE stay_slug  = 'dh-experience-11-13-ans'
  AND start_date = '2026-08-23'
  AND end_date   = '2026-08-28'
RETURNING stay_slug, start_date, end_date AS end_date_corrige,
          (end_date::date - start_date::date) + 1 AS duree_apres;
-- Attendu : 1 ligne, end_date = 2026-08-29, durée = 7j ✅

-- A.1b : UPDATE gd_session_prices (IMMÉDIATEMENT APRÈS A.1a)
-- Sans ce UPDATE, les 18 lignes de prix (end_date=28/08) ne matchent plus la session (end_date=29/08)
UPDATE gd_session_prices
SET end_date = '2026-08-29'
WHERE stay_slug  = 'dh-experience-11-13-ans'
  AND start_date = '2026-08-23'
  AND end_date   = '2026-08-28'
RETURNING stay_slug, start_date, end_date AS end_date_corrige, city_departure;
-- Attendu : 18 lignes mises à jour ✅
*/


-- ─── FIX A.2 : INSERT session 12/07→18/07 (is_full=true — confirmé UFOVAL) ───
-- DÉCOMMENTER APRÈS A2 = 18

/*
-- A.2a : INSERT dans gd_stay_sessions
INSERT INTO gd_stay_sessions (stay_slug, start_date, end_date, is_full, seats_left)
VALUES ('dh-experience-11-13-ans', '2026-07-12', '2026-07-18', true, NULL)
ON CONFLICT (stay_slug, start_date) DO NOTHING
RETURNING stay_slug, start_date, end_date, is_full;
-- Attendu : 1 ligne insérée

-- A.2b : INSERT prix — copie des 18 villes depuis session 07-05
INSERT INTO gd_session_prices (
  stay_slug, start_date, end_date,
  base_price_eur, currency, city_departure,
  transport_surcharge_ufoval, price_ged_total,
  transport_surcharge_ged, is_full
)
SELECT
  'dh-experience-11-13-ans',
  '2026-07-12',
  '2026-07-18',
  base_price_eur, currency, city_departure,
  transport_surcharge_ufoval, price_ged_total,
  transport_surcharge_ged,
  true   -- is_full = complet sur UFOVAL
FROM gd_session_prices
WHERE stay_slug  = 'dh-experience-11-13-ans'
  AND start_date = '2026-07-05'
  AND end_date   = '2026-07-11'
ON CONFLICT DO NOTHING
RETURNING stay_slug, start_date, end_date, city_departure;
-- Attendu : 18 lignes insérées ✅
*/


-- ─── FIX A.3 : INSERT session 26/07→01/08 (disponible) ───

/*
-- A.3a : INSERT dans gd_stay_sessions
INSERT INTO gd_stay_sessions (stay_slug, start_date, end_date, is_full, seats_left)
VALUES ('dh-experience-11-13-ans', '2026-07-26', '2026-08-01', false, NULL)
ON CONFLICT (stay_slug, start_date) DO NOTHING
RETURNING stay_slug, start_date, end_date, is_full;

-- A.3b : INSERT prix — copie des 18 villes depuis session 07-05
INSERT INTO gd_session_prices (
  stay_slug, start_date, end_date,
  base_price_eur, currency, city_departure,
  transport_surcharge_ufoval, price_ged_total,
  transport_surcharge_ged, is_full
)
SELECT
  'dh-experience-11-13-ans',
  '2026-07-26',
  '2026-08-01',
  base_price_eur, currency, city_departure,
  transport_surcharge_ufoval, price_ged_total,
  transport_surcharge_ged,
  false
FROM gd_session_prices
WHERE stay_slug  = 'dh-experience-11-13-ans'
  AND start_date = '2026-07-05'
  AND end_date   = '2026-07-11'
ON CONFLICT DO NOTHING
RETURNING stay_slug, start_date, end_date, city_departure;
-- Attendu : 18 lignes insérées ✅
*/


-- ─── CHECKPOINT A : Gravity Bike Park post-fix ───
SELECT stay_slug, start_date, end_date,
       (end_date::date - start_date::date) + 1 AS duree_jours,
       is_full,
       (SELECT COUNT(*) FROM gd_session_prices sp
        WHERE sp.stay_slug  = ss.stay_slug
          AND sp.start_date = ss.start_date
          AND sp.end_date   = ss.end_date) AS nb_villes
FROM gd_stay_sessions ss
WHERE stay_slug = 'dh-experience-11-13-ans'
ORDER BY start_date;
-- Attendu après tous les fixes :
-- 07-05→07-11 (7j, is_full=false, 18 villes)
-- 07-12→07-18 (7j, is_full=true,  18 villes) ← INSERT A.2
-- 07-19→07-25 (7j, is_full=false, 18 villes)
-- 07-26→08-01 (7j, is_full=false, 18 villes) ← INSERT A.3
-- 08-09→08-15 (7j, ?, 18 villes)
-- 08-16→08-22 (7j, ?, 18 villes)
-- 08-23→08-29 (7j, ?, 18 villes) ← UPDATE A.1
-- + sessions 14j et 21j existantes


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOC B : MY LITTLE FOREST (les-ptits-puisotins-1)
-- Fix : session 23/08 stockée 6j → corriger en 7j (fin 29/08)
-- ─────────────────────────────────────────────────────────────────────────────

-- B0 : État actuel
SELECT stay_slug, start_date, end_date,
       (end_date::date - start_date::date) + 1 AS duree_jours,
       is_full
FROM gd_stay_sessions
WHERE stay_slug = 'les-ptits-puisotins-1'
ORDER BY start_date;

-- B1 : Vérifier la session 6j + compter les villes existantes
SELECT
  ss.stay_slug, ss.start_date, ss.end_date,
  (ss.end_date::date - ss.start_date::date) + 1 AS duree_actuelle,
  COUNT(sp.city_departure) AS nb_villes
FROM gd_stay_sessions ss
LEFT JOIN gd_session_prices sp
  ON sp.stay_slug  = ss.stay_slug
 AND sp.start_date = ss.start_date
 AND sp.end_date   = ss.end_date
WHERE ss.stay_slug  = 'les-ptits-puisotins-1'
  AND ss.start_date = '2026-08-23'
GROUP BY ss.stay_slug, ss.start_date, ss.end_date;
-- Attendu : 1 ligne, end_date=28/08, durée=6j, nb_villes=5 (centre régional)

-- B2 : Vérifier les villes réelles de ce séjour (centre régional = 5 villes)
SELECT DISTINCT city_departure
FROM gd_session_prices
WHERE stay_slug = 'les-ptits-puisotins-1'
ORDER BY city_departure;
-- Ces 5 villes sont la norme pour ce centre — NE PAS chercher à atteindre 19

-- ─── FIX B.1 : UPDATE session 23/08 : 6j → 7j ───
-- DÉCOMMENTER APRÈS B1 CONFIRMÉ + UFOVAL FIN=29/08

/*
-- B.1a : UPDATE gd_stay_sessions
UPDATE gd_stay_sessions
SET end_date = '2026-08-29'
WHERE stay_slug  = 'les-ptits-puisotins-1'
  AND start_date = '2026-08-23'
  AND end_date   = '2026-08-28'
RETURNING stay_slug, start_date, end_date AS end_date_corrige;
-- Attendu : 1 ligne, end_date = 2026-08-29 ✅

-- B.1b : UPDATE gd_session_prices
UPDATE gd_session_prices
SET end_date = '2026-08-29'
WHERE stay_slug  = 'les-ptits-puisotins-1'
  AND start_date = '2026-08-23'
  AND end_date   = '2026-08-28'
RETURNING stay_slug, start_date, end_date AS end_date_corrige, city_departure;
-- Attendu : 5 lignes (5 villes du centre régional) ✅
*/


-- ─── CHECKPOINT B : My Little Forest post-fix ───
SELECT ss.stay_slug, ss.start_date, ss.end_date,
       (ss.end_date::date - ss.start_date::date) + 1 AS duree_jours,
       COUNT(sp.city_departure) AS nb_villes
FROM gd_stay_sessions ss
LEFT JOIN gd_session_prices sp
  ON sp.stay_slug  = ss.stay_slug
 AND sp.start_date = ss.start_date
 AND sp.end_date   = ss.end_date
WHERE ss.stay_slug = 'les-ptits-puisotins-1'
GROUP BY ss.stay_slug, ss.start_date, ss.end_date
ORDER BY ss.start_date;
-- Attendu après fix : session 23/08 → end_date=29/08, durée=7j, nb_villes=5 ✅


-- ─────────────────────────────────────────────────────────────────────────────
-- CHECKPOINT GLOBAL P1
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  CASE
    WHEN COUNT(*) = 0
    THEN '✅ P1 VALIDÉ — Aucune session 6j résiduelle pour Gravity Bike + My Little Forest'
    ELSE '❌ ' || COUNT(*) || ' sessions 6j encore présentes'
  END AS checkpoint_p1
FROM gd_stay_sessions
WHERE stay_slug IN ('dh-experience-11-13-ans', 'les-ptits-puisotins-1')
  AND (end_date::date - start_date::date) + 1 = 6;
