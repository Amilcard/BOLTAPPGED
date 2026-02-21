-- =============================================================================
-- P1 — EXÉCUTION DIRECTE (prêt-à-lancer, pas de décommenting nécessaire)
-- Gravity Bike Park (dh-experience-11-13-ans) + My Little Forest (les-ptits-puisotins-1)
-- Date: 2026-02-18
-- Prérequis : P0 checkpoint = sessions_sans_prix = 0 ✅ (VALIDÉ)
-- =============================================================================
-- ⚠️  LIRE AVANT D'EXÉCUTER :
--   1. Exécuter ÉTAPE PAR ÉTAPE (pas tout d'un bloc)
--   2. Vérifier chaque RETURNING avant de passer à la suivante
--   3. Si un RETURNING = 0 lignes → STOP et contacter LAID
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 0 : DIAGNOSTIC PRÉ-EXÉCUTION (lecture seule)
-- Confirmer les anomalies 6j avant tout UPDATE
-- ─────────────────────────────────────────────────────────────────────────────

-- 0A : Sessions 6j à corriger (doit retourner exactement 2 lignes)
SELECT
  stay_slug, start_date, end_date,
  (end_date::date - start_date::date) + 1 AS duree_actuelle,
  'ANOMALIE 6j → corriger en 7j (29/08)' AS action
FROM gd_stay_sessions
WHERE stay_slug IN ('dh-experience-11-13-ans', 'les-ptits-puisotins-1')
  AND start_date = '2026-08-23'
  AND end_date   = '2026-08-28'
ORDER BY stay_slug;
-- Attendu : 2 lignes exactement ✅
-- Si 0 lignes → correction déjà faite ou dates différentes → vérifier 0B

-- 0B : État complet Gravity Bike Park (toutes sessions)
SELECT stay_slug, start_date, end_date,
       (end_date::date - start_date::date) + 1 AS duree_jours,
       is_full, seats_left
FROM gd_stay_sessions
WHERE stay_slug = 'dh-experience-11-13-ans'
ORDER BY start_date;

-- 0C : Sessions manquantes Gravity (12/07 et 26/07 ne doivent PAS être en base)
SELECT COUNT(*) AS sessions_existantes_a_inserer
FROM gd_stay_sessions
WHERE stay_slug = 'dh-experience-11-13-ans'
  AND start_date IN ('2026-07-12', '2026-07-26');
-- Attendu : 0 → INSERT possible
-- Si 1 ou 2 → sessions déjà présentes, skipper A.2/A.3

-- 0D : Source de copie pour les prix (session 07-05 avec 18 villes)
SELECT COUNT(*) AS nb_villes_source
FROM gd_session_prices
WHERE stay_slug  = 'dh-experience-11-13-ans'
  AND start_date = '2026-07-05'
  AND end_date   = '2026-07-11';
-- Attendu : 18 → source valide ✅
-- Si ≠ 18 → NE PAS exécuter A.2b/A.3b

-- 0E : Compter les prix de la session 23/08 dans gd_session_prices
SELECT
  stay_slug, start_date, end_date,
  COUNT(*) AS nb_lignes_prix
FROM gd_session_prices
WHERE stay_slug IN ('dh-experience-11-13-ans', 'les-ptits-puisotins-1')
  AND start_date = '2026-08-23'
  AND end_date   = '2026-08-28'
GROUP BY stay_slug, start_date, end_date
ORDER BY stay_slug;
-- Attendu : dh-experience-11-13-ans → 18 lignes, les-ptits-puisotins-1 → 5 lignes


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOC A : GRAVITY BIKE PARK (dh-experience-11-13-ans)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── A.1 : UPDATE session 23/08 : 6j → 7j ───
-- (exécuter seulement si 0A retourne bien 1 ligne pour ce slug)

-- A.1a : Corriger gd_stay_sessions
UPDATE gd_stay_sessions
SET end_date = '2026-08-29'
WHERE stay_slug  = 'dh-experience-11-13-ans'
  AND start_date = '2026-08-23'
  AND end_date   = '2026-08-28'
RETURNING stay_slug, start_date, end_date AS end_date_corrige,
          (end_date::date - start_date::date) + 1 AS duree_apres;
-- ✅ Attendu : 1 ligne, end_date = 2026-08-29, duree_apres = 7

-- A.1b : Aligner gd_session_prices (IMMÉDIATEMENT APRÈS A.1a)
UPDATE gd_session_prices
SET end_date = '2026-08-29'
WHERE stay_slug  = 'dh-experience-11-13-ans'
  AND start_date = '2026-08-23'
  AND end_date   = '2026-08-28'
RETURNING stay_slug, start_date, end_date AS end_date_corrige, city_departure;
-- ✅ Attendu : 18 lignes (18 villes)


-- ─── A.2 : INSERT session 12/07→18/07 (is_full=true — complet UFOVAL) ───
-- (exécuter seulement si 0C = 0 et 0D = 18)

-- A.2a : INSERT gd_stay_sessions
INSERT INTO gd_stay_sessions (stay_slug, start_date, end_date, is_full, seats_left)
VALUES ('dh-experience-11-13-ans', '2026-07-12', '2026-07-18', true, NULL)
ON CONFLICT (stay_slug, start_date) DO NOTHING
RETURNING stay_slug, start_date, end_date, is_full;
-- ✅ Attendu : 1 ligne insérée
-- Si 0 lignes → session déjà présente (conflict évité) → vérifier les dates

-- A.2b : INSERT prix — copie des 18 villes depuis session 07-05→07-11
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
  true   -- is_full = complet UFOVAL
FROM gd_session_prices
WHERE stay_slug  = 'dh-experience-11-13-ans'
  AND start_date = '2026-07-05'
  AND end_date   = '2026-07-11'
ON CONFLICT DO NOTHING
RETURNING stay_slug, start_date, end_date, city_departure;
-- ✅ Attendu : 18 lignes insérées


-- ─── A.3 : INSERT session 26/07→01/08 (disponible) ───

-- A.3a : INSERT gd_stay_sessions
INSERT INTO gd_stay_sessions (stay_slug, start_date, end_date, is_full, seats_left)
VALUES ('dh-experience-11-13-ans', '2026-07-26', '2026-08-01', false, NULL)
ON CONFLICT (stay_slug, start_date) DO NOTHING
RETURNING stay_slug, start_date, end_date, is_full;
-- ✅ Attendu : 1 ligne insérée

-- A.3b : INSERT prix — copie des 18 villes depuis session 07-05→07-11
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
-- ✅ Attendu : 18 lignes insérées


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOC B : MY LITTLE FOREST (les-ptits-puisotins-1)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── B.1 : UPDATE session 23/08 : 6j → 7j ───

-- B.1a : Corriger gd_stay_sessions
UPDATE gd_stay_sessions
SET end_date = '2026-08-29'
WHERE stay_slug  = 'les-ptits-puisotins-1'
  AND start_date = '2026-08-23'
  AND end_date   = '2026-08-28'
RETURNING stay_slug, start_date, end_date AS end_date_corrige;
-- ✅ Attendu : 1 ligne, end_date = 2026-08-29

-- B.1b : Aligner gd_session_prices
UPDATE gd_session_prices
SET end_date = '2026-08-29'
WHERE stay_slug  = 'les-ptits-puisotins-1'
  AND start_date = '2026-08-23'
  AND end_date   = '2026-08-28'
RETURNING stay_slug, start_date, end_date AS end_date_corrige, city_departure;
-- ✅ Attendu : 5 lignes (5 villes du centre régional)


-- ─────────────────────────────────────────────────────────────────────────────
-- CHECKPOINT FINAL P1 — Vérification globale post-correction
-- ─────────────────────────────────────────────────────────────────────────────

-- CP1 : Zero sessions 6j pour les 2 séjours concernés
SELECT
  CASE
    WHEN COUNT(*) = 0
    THEN '✅ P1 VALIDÉ — Aucune session 6j résiduelle pour Gravity Bike + My Little Forest'
    ELSE '❌ ' || COUNT(*) || ' sessions 6j encore présentes — vérifier les UPDATEs'
  END AS checkpoint_p1
FROM gd_stay_sessions
WHERE stay_slug IN ('dh-experience-11-13-ans', 'les-ptits-puisotins-1')
  AND (end_date::date - start_date::date) + 1 = 6;

-- CP2 : Gravity Bike Park — état final complet
SELECT
  ss.stay_slug,
  ss.start_date, ss.end_date,
  (ss.end_date::date - ss.start_date::date) + 1 AS duree_jours,
  ss.is_full,
  COUNT(sp.city_departure) AS nb_villes
FROM gd_stay_sessions ss
LEFT JOIN gd_session_prices sp
  ON sp.stay_slug  = ss.stay_slug
 AND sp.start_date = ss.start_date
 AND sp.end_date   = ss.end_date
WHERE ss.stay_slug = 'dh-experience-11-13-ans'
GROUP BY ss.stay_slug, ss.start_date, ss.end_date, ss.is_full
ORDER BY ss.start_date;
-- ✅ Attendu (sessions 7j minimum) :
-- 07-05→07-11  (7j, is_full=false, 18 villes)
-- 07-12→07-18  (7j, is_full=true,  18 villes) ← INSERT A.2
-- 07-19→07-25  (7j, is_full=false, 18 villes)
-- 07-26→08-01  (7j, is_full=false, 18 villes) ← INSERT A.3
-- 08-09→08-15  (7j, ?, 18 villes)
-- 08-16→08-22  (7j, ?, 18 villes)
-- 08-23→08-29  (7j, ?, 18 villes) ← UPDATE A.1
-- (+ éventuelles sessions 14j et 21j existantes)

-- CP3 : My Little Forest — état final
SELECT
  ss.stay_slug, ss.start_date, ss.end_date,
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
-- ✅ Attendu : session 23/08 → end_date=29/08, durée=7j, nb_villes=5

-- CP4 : Zéro session sans prix (cohérence globale maintenue)
SELECT
  CASE
    WHEN COUNT(*) = 0
    THEN '✅ sessions_sans_prix = 0 — cohérence maintenue'
    ELSE '❌ ' || COUNT(*) || ' sessions sans prix — vérifier les INSERTs'
  END AS checkpoint_global
FROM gd_stay_sessions ss
WHERE NOT EXISTS (
  SELECT 1 FROM gd_session_prices sp
  WHERE sp.stay_slug  = ss.stay_slug
    AND sp.start_date = ss.start_date
    AND sp.end_date   = ss.end_date
);


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE SUIVANTE : P0 Ghost Cleanup (si P1 validé)
-- ─────────────────────────────────────────────────────────────────────────────
-- Une fois P1 ✅ → ouvrir P0_DELETE_GHOST_8J_FINAL.sql
-- Exécuter Étape 2 (DELETE gd_session_prices ghost nb_villes=1)
-- Puis Étape 3B (DELETE gd_stay_sessions orphelines)
-- Puis Étape 4C checkpoint final P0
