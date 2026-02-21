-- =============================================================================
-- P0 — GRAVITY BIKE PARK FIX COMPLET
-- Date: 2026-02-18
-- Séjour: dh-experience-11-13-ans (GRAVITY BIKE PARK)
-- Actions:
--   1. UPDATE session 6j → 7j (23/08 → 28/08 devient 23/08 → 29/08)
--   2. INSERT session manquante 26/07 → 01/08 (7j)
-- Règle durée : (end_date - start_date) + 1 = jours inclusifs
-- Schéma réel : PK composite (stay_slug, start_date) — pas de colonne id
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 0 : ÉTAT ACTUEL — Vérification avant toute modification
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  stay_slug,
  start_date,
  end_date,
  (end_date::date - start_date::date) + 1   AS duree_jours_inclusifs,
  is_full,
  seats_left
FROM gd_stay_sessions
WHERE stay_slug = 'dh-experience-11-13-ans'
ORDER BY start_date;

-- Résultat attendu avant correction :
-- 05/07→11/07 : 7j  | 12/07→18/07 : 7j (is_full=true)
-- 19/07→25/07 : 7j  | 02/08→08/08 : 7j (is_full=true)
-- 09/08→15/08 : 7j  | 16/08→22/08 : 7j
-- 23/08→28/08 : 6j  ← ANOMALIE off-by-one à corriger
-- 02/08→15/08 : 14j | 09/08→15/08 : 14j (à vérifier dates exactes)
-- 02/08→22/08 : 21j


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 1 : BACKUP CIBLÉ GRAVITY BIKE PARK
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gd_stay_sessions_backup_gravity_p0_2026_02_18 AS
SELECT * FROM gd_stay_sessions
WHERE stay_slug = 'dh-experience-11-13-ans';

SELECT COUNT(*) AS sessions_sauvegardees
FROM gd_stay_sessions_backup_gravity_p0_2026_02_18;


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 2 : UPDATE — Session 6j → 7j (23/08/2026 : end_date 28/08 → 29/08)
-- ─────────────────────────────────────────────────────────────────────────────

-- 2A : Vérification de la session 6j avant correction
SELECT
  stay_slug,
  start_date,
  end_date                              AS end_date_actuel,
  (end_date::date - start_date::date) + 1 AS duree_actuelle,
  (end_date::date + INTERVAL '1 day')::date AS end_date_corrige,
  '7j après correction'                  AS duree_apres
FROM gd_stay_sessions
WHERE stay_slug = 'dh-experience-11-13-ans'
  AND (end_date::date - start_date::date) + 1 = 6;

-- 2B : Correction (DÉCOMMENTER APRÈS VÉRIFICATION 2A)
/*
UPDATE gd_stay_sessions
SET end_date = end_date::date + INTERVAL '1 day'
WHERE stay_slug = 'dh-experience-11-13-ans'
  AND (end_date::date - start_date::date) + 1 = 6
RETURNING
  stay_slug,
  start_date,
  end_date                              AS end_date_corrige,
  (end_date::date - start_date::date) + 1 AS duree_apres_correction;
-- Attendu : 23/08/2026 → 29/08/2026 (7j inclusifs ✅)
*/


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 3 : INSERT — Session manquante 7j : 26/07/2026 → 01/08/2026
-- Comble le trou dans la séquence hebdomadaire :
-- 05/07, 12/07, 19/07, [26/07 MANQUANT], 02/08, 09/08, 16/08, 23/08
-- ─────────────────────────────────────────────────────────────────────────────

-- 3A : Vérifier que la session n'existe pas déjà
SELECT COUNT(*) AS session_existante
FROM gd_stay_sessions
WHERE stay_slug = 'dh-experience-11-13-ans'
  AND start_date = '2026-07-26';

-- Si COUNT = 0, procéder à l'INSERT
-- 3B : INSERT session 26/07→01/08 (DÉCOMMENTER SI 3A RETOURNE 0)
/*
INSERT INTO gd_stay_sessions (stay_slug, start_date, end_date, is_full, seats_left)
VALUES (
  'dh-experience-11-13-ans',  -- stay_slug : clé séjour réelle
  '2026-07-26',                -- start_date ISO
  '2026-08-01',                -- end_date ISO : 26/07 + 6 jours = 01/08 = 7j inclusifs
  false,                       -- is_full : session disponible
  NULL                         -- seats_left : NULL cohérent avec les autres sessions
)
ON CONFLICT (stay_slug, start_date) DO NOTHING
RETURNING stay_slug, start_date, end_date,
  (end_date::date - start_date::date) + 1 AS duree_jours;
*/

-- 3C : Après INSERT, ajouter le prix pour cette session (copie du prix d'une session 7j existante)
/*
INSERT INTO gd_session_prices (stay_slug, start_date, end_date, price_ged_total)
SELECT
  'dh-experience-11-13-ans',
  DATE '2026-07-26',
  DATE '2026-08-01',
  price_ged_total
FROM gd_session_prices
WHERE stay_slug = 'dh-experience-11-13-ans'
  AND (end_date::date - start_date::date) + 1 = 7
LIMIT 1
ON CONFLICT DO NOTHING;
*/


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 4 : VÉRIFICATION FINALE — État attendu après corrections
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  ss.stay_slug,
  ss.start_date,
  ss.end_date,
  (ss.end_date::date - ss.start_date::date) + 1 AS duree_jours_inclusifs,
  ss.is_full,
  CASE WHEN sp.price_ged_total IS NULL THEN '❌ SANS PRIX' ELSE '✅ ' || sp.price_ged_total::text || '€' END AS prix
FROM gd_stay_sessions ss
LEFT JOIN gd_session_prices sp
  ON sp.stay_slug = ss.stay_slug
  AND sp.start_date = ss.start_date
  AND sp.end_date = ss.end_date
WHERE ss.stay_slug = 'dh-experience-11-13-ans'
ORDER BY ss.start_date, ss.end_date;

-- État attendu après toutes corrections :
-- 05/07→11/07 : 7j  ✅ prix
-- 12/07→18/07 : 7j  ✅ prix (is_full=true)
-- 19/07→25/07 : 7j  ✅ prix
-- 26/07→01/08 : 7j  ✅ prix [INSÉRÉ]
-- 02/08→08/08 : 7j  ✅ prix (is_full=true)
-- 09/08→15/08 : 7j  ✅ prix
-- 16/08→22/08 : 7j  ✅ prix
-- 23/08→29/08 : 7j  ✅ prix [CORRIGÉ 6j→7j]
-- + sessions 14j et 21j : vérifier que leurs prix sont présents


-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK — En cas d'erreur, restaurer depuis le backup
-- ─────────────────────────────────────────────────────────────────────────────
/*
-- Supprimer les sessions modifiées/insérées
DELETE FROM gd_stay_sessions
WHERE stay_slug = 'dh-experience-11-13-ans';

-- Restaurer depuis le backup
INSERT INTO gd_stay_sessions
SELECT * FROM gd_stay_sessions_backup_gravity_p0_2026_02_18;

-- Vérifier la restauration
SELECT COUNT(*) FROM gd_stay_sessions WHERE stay_slug = 'dh-experience-11-13-ans';
*/
