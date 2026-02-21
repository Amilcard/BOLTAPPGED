-- =============================================================================
-- P0 — NETTOYAGE SESSIONS ORPHELINES 8j + RESTAURATION GRILLES 7j
-- Date: 2026-02-18
-- Root Cause: Calcul off-by-one (Dim→Dim = 8j) au lieu de (Dim→Sam = 7j)
-- Séjours impactés: aqua-fun, aqua-gliss, aqua-mix, laventure-verticale,
--                  natation-et-sensation, destination-bassin-darcachon-1
-- Stratégie:
--   1. Backup ciblé
--   2. DELETE sessions orphelines 8j dans gd_session_prices (1 ville, prix=850)
--   3. DELETE sessions orphelines 8j dans gd_stay_sessions si elles existent
--   4. Vérifier les sessions 7j valides (start_date → start_date+6)
--   5. UPDATE dh-experience 6j→7j (23/08→29/08)
-- NE PAS TOUCHER : les sessions 14j+ (aqua: 04/07→17/07, etc.) → durées UFOVAL réelles
-- =============================================================================

-- =============================================================================
-- ÉTAPE 0 : DIAGNOSTIC — Confirmer les orphelins avant toute action
-- =============================================================================

-- 0A : Sessions dans gd_session_prices avec 1 seule ville et durée aberrante
SELECT
  stay_slug,
  start_date,
  end_date,
  (end_date::date - start_date::date) + 1 AS duree_jours,
  COUNT(*)                                AS nb_villes,
  MIN(price_ged_total)                    AS prix_unique
FROM gd_session_prices
WHERE stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix',
  'laventure-verticale', 'natation-et-sensation',
  'destination-bassin-darcachon-1'
)
GROUP BY stay_slug, start_date, end_date
HAVING COUNT(*) = 1
ORDER BY stay_slug, start_date;

-- Résultat attendu (orphelins 8j avec 1 seule ville) :
-- aqua-fun          : 07-05→07-12, 07-19→07-26, 08-02→08-09
-- aqua-gliss        : idem
-- aqua-mix          : idem
-- laventure-verticale: idem
-- natation-et-sensation: idem
-- destination-bassin-darcachon-1: 07-19→07-26 uniquement

-- 0B : Vérifier que les sessions 7j valides existent dans gd_stay_sessions
SELECT
  stay_slug,
  start_date,
  end_date,
  (end_date::date - start_date::date) + 1 AS duree_jours
FROM gd_stay_sessions
WHERE stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix',
  'laventure-verticale', 'natation-et-sensation',
  'destination-bassin-darcachon-1'
)
AND start_date IN (
  '2026-07-05', '2026-07-19', '2026-08-02'
)
ORDER BY stay_slug, start_date;

-- Attendu : sessions avec end_date = start_date + 6 (7j inclusifs)
-- ex: 07-05→07-11, 07-19→07-25, 08-02→08-08


-- =============================================================================
-- ÉTAPE 1 : BACKUP CIBLÉ
-- =============================================================================

-- Backup des lignes orphelines de gd_session_prices
CREATE TABLE IF NOT EXISTS gd_session_prices_backup_orphelins_8j_2026_02_18 AS
SELECT sp.*
FROM gd_session_prices sp
WHERE sp.stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix',
  'laventure-verticale', 'natation-et-sensation',
  'destination-bassin-darcachon-1'
)
-- Sélectionner uniquement les lignes dans les sessions à 1 ville
AND EXISTS (
  SELECT 1
  FROM gd_session_prices sp2
  WHERE sp2.stay_slug = sp.stay_slug
    AND sp2.start_date = sp.start_date
    AND sp2.end_date = sp.end_date
  GROUP BY sp2.stay_slug, sp2.start_date, sp2.end_date
  HAVING COUNT(*) = 1
);

SELECT COUNT(*) AS lignes_sauvegardees,
       STRING_AGG(DISTINCT stay_slug, ', ') AS sejours
FROM gd_session_prices_backup_orphelins_8j_2026_02_18;

-- Backup des sessions orphelines de gd_stay_sessions (si elles existent)
CREATE TABLE IF NOT EXISTS gd_stay_sessions_backup_orphelins_8j_2026_02_18 AS
SELECT *
FROM gd_stay_sessions
WHERE stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix',
  'laventure-verticale', 'natation-et-sensation',
  'destination-bassin-darcachon-1'
)
AND (end_date::date - start_date::date) + 1 = 8;

SELECT COUNT(*) AS sessions_orphelines_sauvegardees
FROM gd_stay_sessions_backup_orphelins_8j_2026_02_18;


-- =============================================================================
-- ÉTAPE 2 : DELETE — Lignes orphelines dans gd_session_prices
-- Critère : sessions avec exactement 1 ville (les vraies sessions ont 19 villes)
-- DÉCOMMENTER APRÈS VALIDATION ÉTAPE 0
-- =============================================================================

/*
DELETE FROM gd_session_prices
WHERE stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix',
  'laventure-verticale', 'natation-et-sensation'
)
AND (end_date::date - start_date::date) + 1 = 8  -- durée 8j (Dim→Dim off-by-one)
AND start_date IN (
  '2026-07-05', '2026-07-19', '2026-08-02'        -- dates des 3 sessions impactées
)
-- Sécurité : seulement si c'est la seule ligne pour ce (slug, start_date, end_date)
AND (
  SELECT COUNT(*) FROM gd_session_prices sp2
  WHERE sp2.stay_slug = gd_session_prices.stay_slug
    AND sp2.start_date = gd_session_prices.start_date
    AND sp2.end_date = gd_session_prices.end_date
) = 1
RETURNING stay_slug, start_date, end_date,
  (end_date::date - start_date::date) + 1 AS duree_supprimee,
  city_departure;
-- Attendu : 15 lignes supprimées (5 séjours × 3 dates × 1 ville)
*/

-- DELETE destination-bassin orphelin (1 seul : 07-19→07-26)
/*
DELETE FROM gd_session_prices
WHERE stay_slug = 'destination-bassin-darcachon-1'
  AND start_date = '2026-07-19'
  AND end_date = '2026-07-26'
RETURNING stay_slug, start_date, end_date, city_departure;
-- Attendu : 1 ligne supprimée
*/


-- =============================================================================
-- ÉTAPE 3 : DELETE — Sessions orphelines dans gd_stay_sessions (si 8j)
-- Vérifier d'abord avec ÉTAPE 0B : si les sessions 7j valides existent déjà
-- et que les 8j sont des doublons erronés, les supprimer
-- DÉCOMMENTER SEULEMENT SI ÉTAPE 0B confirme des sessions 8j dans stay_sessions
-- =============================================================================

/*
DELETE FROM gd_stay_sessions
WHERE stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix',
  'laventure-verticale', 'natation-et-sensation',
  'destination-bassin-darcachon-1'
)
AND (end_date::date - start_date::date) + 1 = 8
AND start_date IN ('2026-07-05', '2026-07-19', '2026-08-02')
RETURNING stay_slug, start_date, end_date;
*/


-- =============================================================================
-- ÉTAPE 4 : UPDATE — Correction off-by-one 6j → 7j (dh-experience + les-ptits)
-- 23/08: end_date 28/08 → 29/08 dans BOTH tables
-- =============================================================================

-- 4A : Vérification avant correction
SELECT
  'gd_stay_sessions' AS source_table,
  stay_slug, start_date, end_date,
  (end_date::date - start_date::date) + 1 AS duree_actuelle
FROM gd_stay_sessions
WHERE stay_slug IN ('dh-experience-11-13-ans', 'les-ptits-puisotins-1')
  AND (end_date::date - start_date::date) + 1 = 6
UNION ALL
SELECT
  'gd_session_prices' AS source_table,
  stay_slug, start_date, end_date,
  (end_date::date - start_date::date) + 1 AS duree_actuelle
FROM gd_session_prices
WHERE stay_slug IN ('dh-experience-11-13-ans', 'les-ptits-puisotins-1')
  AND (end_date::date - start_date::date) + 1 = 6
GROUP BY stay_slug, start_date, end_date
ORDER BY source_table, stay_slug;

-- 4B : UPDATE gd_stay_sessions (DÉCOMMENTER APRÈS 4A)
/*
UPDATE gd_stay_sessions
SET end_date = end_date::date + INTERVAL '1 day'
WHERE stay_slug IN ('dh-experience-11-13-ans', 'les-ptits-puisotins-1')
  AND (end_date::date - start_date::date) + 1 = 6
RETURNING stay_slug, start_date,
  end_date AS end_date_corrige,
  (end_date::date - start_date::date) + 1 AS duree_apres;
-- Attendu : 2 sessions (une par séjour), durée 7j ✅
*/

-- 4C : UPDATE gd_session_prices — aligner end_date avec la session corrigée
-- CRITIQUE : sans cette étape, les prix 6j (end_date=28/08) ne matcheront plus la session 7j (end_date=29/08)
/*
UPDATE gd_session_prices
SET end_date = end_date::date + INTERVAL '1 day'
WHERE stay_slug IN ('dh-experience-11-13-ans', 'les-ptits-puisotins-1')
  AND (end_date::date - start_date::date) + 1 = 6
RETURNING stay_slug, start_date, end_date AS end_date_corrige, city_departure;
-- Attendu : 18 lignes pour dh-experience + 5 lignes pour les-ptits = 23 lignes
*/


-- =============================================================================
-- ÉTAPE 5 : INSERT — Session GRAVITY BIKE PARK 12/07→18/07 (vraiment manquante)
-- Copier les 18 villes depuis une session 7j existante (ex: 07-05→07-11)
-- =============================================================================

-- 5A : Vérifier les 18 lignes de la session source
SELECT stay_slug, start_date, end_date, city_departure, price_ged_total, base_price_eur
FROM gd_session_prices
WHERE stay_slug = 'dh-experience-11-13-ans'
  AND start_date = '2026-07-05'
ORDER BY city_departure;

-- 5B : INSERT session 12/07→18/07 avec toutes les villes (DÉCOMMENTER APRÈS 5A)
/*
-- D'abord insérer la session dans gd_stay_sessions si absente
INSERT INTO gd_stay_sessions (stay_slug, start_date, end_date, is_full, seats_left)
VALUES ('dh-experience-11-13-ans', '2026-07-12', '2026-07-18', true, NULL)
  -- is_full=true car UFOVAL indique cette session comme complète
ON CONFLICT (stay_slug, start_date) DO NOTHING
RETURNING stay_slug, start_date, end_date;

-- Puis copier TOUTES les lignes de prix (18 villes) depuis la session 07-05
INSERT INTO gd_session_prices (
  stay_slug, start_date, end_date,
  base_price_eur, currency, city_departure,
  transport_surcharge_ufoval, price_ged_total,
  transport_surcharge_ged, is_full
)
SELECT
  stay_slug,
  DATE '2026-07-12'  AS start_date,  -- Nouvelle session
  DATE '2026-07-18'  AS end_date,    -- start + 6 = 7j inclusifs
  base_price_eur,
  currency,
  city_departure,                     -- Toutes les 18 villes copiées
  transport_surcharge_ufoval,
  price_ged_total,                    -- Prix identique (même durée 7j, même séjour)
  transport_surcharge_ged,
  true                AS is_full      -- is_full=true car complet sur UFOVAL
FROM gd_session_prices
WHERE stay_slug = 'dh-experience-11-13-ans'
  AND start_date = '2026-07-05'
  AND end_date   = '2026-07-11'
ON CONFLICT DO NOTHING
RETURNING stay_slug, start_date, end_date, city_departure;
-- Attendu : 18 lignes insérées
*/


-- =============================================================================
-- ÉTAPE 6 : INSERT — Session GRAVITY BIKE PARK 26/07→01/08 (manquante)
-- D'abord insérer dans gd_stay_sessions, puis copier les prix
-- =============================================================================

-- 6A : Vérifier absence dans les deux tables
SELECT 'stay_sessions' AS table_name, COUNT(*) AS lignes
FROM gd_stay_sessions
WHERE stay_slug = 'dh-experience-11-13-ans' AND start_date = '2026-07-26'
UNION ALL
SELECT 'session_prices', COUNT(*)
FROM gd_session_prices
WHERE stay_slug = 'dh-experience-11-13-ans' AND start_date = '2026-07-26';

-- 6B : INSERT gd_stay_sessions + prix (DÉCOMMENTER APRÈS 6A = 0 ROWS)
/*
INSERT INTO gd_stay_sessions (stay_slug, start_date, end_date, is_full, seats_left)
VALUES ('dh-experience-11-13-ans', '2026-07-26', '2026-08-01', false, NULL)
ON CONFLICT (stay_slug, start_date) DO NOTHING
RETURNING *;

INSERT INTO gd_session_prices (
  stay_slug, start_date, end_date,
  base_price_eur, currency, city_departure,
  transport_surcharge_ufoval, price_ged_total,
  transport_surcharge_ged, is_full
)
SELECT
  stay_slug,
  DATE '2026-07-26'  AS start_date,
  DATE '2026-08-01'  AS end_date,    -- 26/07 + 6 = 01/08 = 7j inclusifs
  base_price_eur, currency, city_departure,
  transport_surcharge_ufoval, price_ged_total,
  transport_surcharge_ged,
  false AS is_full
FROM gd_session_prices
WHERE stay_slug = 'dh-experience-11-13-ans'
  AND start_date = '2026-07-05'
  AND end_date   = '2026-07-11'
ON CONFLICT DO NOTHING
RETURNING stay_slug, start_date, end_date, city_departure;
-- Attendu : 18 lignes insérées
*/


-- =============================================================================
-- ÉTAPE 7 : QUESTION OUVERTE — les-ptits-puisotins-1 (5 villes seulement)
-- Est-ce un centre local avec villes limitées ou import partiel ?
-- =============================================================================

-- Diagnostic des villes présentes dans les-ptits-puisotins-1
SELECT DISTINCT city_departure
FROM gd_session_prices
WHERE stay_slug = 'les-ptits-puisotins-1'
ORDER BY city_departure;
-- Si résultat = 5 villes spécifiques (ex: sans_transport + 4 proches) → centre local ✅
-- Si résultat = villes aléatoires → import partiel → relancer scraper sur ce séjour


-- =============================================================================
-- ÉTAPE 8 : VÉRIFICATION FINALE
-- =============================================================================

-- 8A : Plus d'orphelins 1-ville dans les 8 séjours
SELECT
  stay_slug,
  start_date,
  end_date,
  (end_date::date - start_date::date) + 1 AS duree_jours,
  COUNT(*)                                AS nb_villes
FROM gd_session_prices
WHERE stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix',
  'destination-bassin-darcachon-1', 'dh-experience-11-13-ans',
  'laventure-verticale', 'les-ptits-puisotins-1', 'natation-et-sensation'
)
GROUP BY stay_slug, start_date, end_date
HAVING COUNT(*) < 5  -- Alerte si moins de 5 villes (seuil bas pour les-ptits)
ORDER BY stay_slug, start_date;
-- Attendu : 0 lignes (sauf les-ptits-puisotins-1 si centre local → vérifier séparément)

-- 8B : Checkpoint P0 final
SELECT
  CASE
    WHEN COUNT(*) = 0
    THEN '✅ P0 VALIDÉ — Plus aucun orphelin ni session sans prix complet'
    ELSE '❌ ' || COUNT(*) || ' sessions encore problématiques'
  END AS checkpoint_p0
FROM (
  SELECT stay_slug, start_date, end_date, COUNT(*) AS nb_villes
  FROM gd_session_prices
  WHERE stay_slug IN (
    'aqua-fun', 'aqua-gliss', 'aqua-mix',
    'destination-bassin-darcachon-1', 'dh-experience-11-13-ans',
    'laventure-verticale', 'natation-et-sensation'
  )
  GROUP BY stay_slug, start_date, end_date
  HAVING COUNT(*) = 1  -- Orphelins restants
) orphelins;


-- =============================================================================
-- ROLLBACK — Si erreur critique
-- =============================================================================
/*
-- Restaurer gd_session_prices depuis backup
INSERT INTO gd_session_prices
SELECT * FROM gd_session_prices_backup_orphelins_8j_2026_02_18
ON CONFLICT DO NOTHING;

-- Restaurer gd_stay_sessions si besoin
INSERT INTO gd_stay_sessions
SELECT * FROM gd_stay_sessions_backup_orphelins_8j_2026_02_18
ON CONFLICT (stay_slug, start_date) DO NOTHING;
*/
