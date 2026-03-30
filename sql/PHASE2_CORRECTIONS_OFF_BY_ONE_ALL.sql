-- =============================================================================
-- PHASE 2 — CORRECTIONS OFF-BY-ONE MULTI-SÉJOURS
-- Date: 2026-02-18
-- Source: Q1 complet (24 séjours) — Anomalies durées détectées
-- Durées parasites : 6j (doit être 7j) + 8j (doit être 7j ou 14j selon contexte)
-- Règle : end_date - start_date + 1 = jours inclusifs
-- SCHEMA RÉEL : pas de colonne 'id', pas de 'date_text'
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 0 : DIAGNOSTIC COMPLET — Sessions hors référentiel UFOVAL
-- Exécuter en lecture seule AVANT toute correction
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  ss.stay_slug,
  s.marketing_title,
  ss.start_date,
  ss.end_date,
  (ss.end_date::date - ss.start_date::date) + 1   AS duree_actuelle_jours_inclusifs,
  CASE
    WHEN (ss.end_date::date - ss.start_date::date) + 1 = 6
    THEN 'off-by-one : 6j → doit être 7j (+1 end_date)'
    WHEN (ss.end_date::date - ss.start_date::date) + 1 = 8
    THEN 'off-by-one : 8j → probablement 7j (+1 erreur) OU vérifier si 8j UFOVAL réel'
    ELSE 'Durée hors référentiel standard (7/12/14/19/21j)'
  END                                              AS diagnostic
FROM gd_stay_sessions ss
JOIN gd_stays s ON s.slug = ss.stay_slug
WHERE ((ss.end_date::date - ss.start_date::date) + 1)
  NOT IN (7, 12, 14, 19, 21)
ORDER BY ss.stay_slug, ss.start_date;

-- RÉSULTAT ATTENDU (d'après Q1) :
-- dh-experience-11-13-ans  : 1 session 6j (23/08)
-- breizh-equit-kids-8-11-ans : sessions 8j
-- destination-soleil         : sessions 8j (et pas de 7j)
-- sperienza-in-corsica-1    : sessions 8j
-- surf-sur-le-bassin         : sessions 8j
-- les-ptits-puisotins-1      : 1 session 6j (à vérifier — devrait être dans liste)


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 1 : BACKUPS (créer avant toute modification)
-- ─────────────────────────────────────────────────────────────────────────────

-- Backup global des sessions hors référentiel
CREATE TABLE IF NOT EXISTS gd_stay_sessions_backup_offbyone_2026_02_18 AS
SELECT *
FROM gd_stay_sessions
WHERE ((end_date::date - start_date::date) + 1) NOT IN (7, 12, 14, 19, 21);

-- Vérifier le nombre de rows sauvegardés avant de continuer
SELECT COUNT(*), STRING_AGG(DISTINCT stay_slug, ', ') AS sejours
FROM gd_stay_sessions_backup_offbyone_2026_02_18;


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 2 : CORRECTION SESSIONS 6j → 7j
-- Séjours : dh-experience-11-13-ans + les-ptits-puisotins-1
-- ─────────────────────────────────────────────────────────────────────────────

-- 2A : Vérification avant correction 6j
SELECT stay_slug, start_date, end_date,
  (end_date::date - start_date::date) + 1 AS duree_actuelle,
  (end_date::date + INTERVAL '1 day')::date AS end_date_corrige
FROM gd_stay_sessions
WHERE ((end_date::date - start_date::date) + 1) = 6
ORDER BY stay_slug, start_date;

-- 2B : Correction 6j → 7j (DÉCOMMENTER APRÈS VÉRIFICATION 2A)
/*
UPDATE gd_stay_sessions
SET end_date = end_date::date + INTERVAL '1 day'
WHERE ((end_date::date - start_date::date) + 1) = 6
RETURNING stay_slug, start_date,
  (end_date::date - start_date::date) + 1 AS duree_apres;
-- Attendu : GRAVITY BIKE PARK (23/08) + MY LITTLE FOREST (23/08)
*/


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 3 : DIAGNOSTIC SESSIONS 8j — Distinguer erreur vs réel UFOVAL
-- Les séjours RIVIERA, CORSICA, WEST COAST, BRETAGNE ont des 8j
-- 8j peut être : off-by-one d'un 7j OU durée UFOVAL réelle (rare)
-- ─────────────────────────────────────────────────────────────────────────────

-- 3A : Analyse détaillée sessions 8j par séjour
SELECT
  ss.stay_slug,
  s.marketing_title,
  ss.start_date,
  ss.end_date,
  (ss.end_date::date - ss.start_date::date) + 1 AS duree_8j,
  -- Vérifier si une price row existe (si prix → peut-être volontaire)
  sp.price_ged_total,
  CASE
    WHEN sp.price_ged_total IS NOT NULL THEN '⚠️ Prix existant — vérifier UFOVAL avant correction'
    ELSE '❌ Pas de prix — probablement off-by-one'
  END AS statut_prix
FROM gd_stay_sessions ss
JOIN gd_stays s ON s.slug = ss.stay_slug
LEFT JOIN gd_session_prices sp
  ON sp.stay_slug = ss.stay_slug
  AND sp.start_date = ss.start_date
  AND sp.end_date = ss.end_date
WHERE (ss.end_date::date - ss.start_date::date) + 1 = 8
ORDER BY ss.stay_slug, ss.start_date;

-- INTERPRÉTATION :
-- Si price_ged_total IS NULL → off-by-one confirmé → correction 8j → 7j
-- Si price_ged_total non null → durée UFOVAL réelle de 8j → NE PAS CORRIGER
-- Note pricing : 8j tombe dans la tranche 5-8j → markup 180€ (cohérent avec 7j)


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 4 : CORRECTION SESSIONS 8j → 7j (si confirmé off-by-one par ÉTAPE 3)
-- À n'exécuter QUE si les sessions 8j n'ont pas de prix ET UFOVAL confirme 7j
-- ─────────────────────────────────────────────────────────────────────────────

-- 4A : Correction 8j → 7j pour les séjours SANS prix (DÉCOMMENTER APRÈS 3A)
/*
-- ATTENTION : Vérifier UFOVAL live avant d'appliquer pour BRETAGNE, RIVIERA, CORSICA, WEST COAST

-- Option A : Correction end_date - 1 jour (8j → 7j)
UPDATE gd_stay_sessions
SET end_date = end_date::date - INTERVAL '1 day'
WHERE ((end_date::date - start_date::date) + 1) = 8
  AND stay_slug IN (
    'destination-soleil',       -- RIVIERA SPEED CLUB
    'sperienza-in-corsica-1',   -- CORSICA WILD TRIP
    'surf-sur-le-bassin',       -- WEST COAST SURF CAMP
    'breizh-equit-kids-8-11-ans' -- BRETAGNE OCEAN RIDE
  )
  -- Sécurité : seulement si pas de prix associé
  AND NOT EXISTS (
    SELECT 1 FROM gd_session_prices sp
    WHERE sp.stay_slug = gd_stay_sessions.stay_slug
      AND sp.start_date = gd_stay_sessions.start_date
      AND sp.end_date = gd_stay_sessions.end_date
  )
RETURNING stay_slug, start_date, end_date,
  (end_date::date - start_date::date) + 1 AS duree_apres;
*/


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 5 : VÉRIFICATION RIVIERA SPEED CLUB (destination-soleil)
-- Seul séjour sans session 7j — uniquement 8j et 14j
-- Hypothèse : toutes les sessions 7j sont importées en 8j (off-by-one total)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  (end_date::date - start_date::date) + 1 AS duree_jours,
  COUNT(*)                                  AS nb_sessions,
  STRING_AGG(TO_CHAR(start_date,'DD/MM/YYYY'), ', ' ORDER BY start_date) AS dates_debut
FROM gd_stay_sessions
WHERE stay_slug = 'destination-soleil'
GROUP BY 1 ORDER BY 1;

-- Attendu : 8j (sessions 7j+1 erreur) + 14j
-- Après correction 8j→7j : toutes sessions 7j rétablies


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 6 : INSERT SESSION 7j MANQUANTE — GRAVITY BIKE PARK (26/07→01/08)
-- ─────────────────────────────────────────────────────────────────────────────

-- 6A : Vérifier que la session n'existe pas
SELECT * FROM gd_stay_sessions
WHERE stay_slug = 'dh-experience-11-13-ans'
  AND start_date = '2026-07-26';

-- 6B : INSERT (DÉCOMMENTER SI RÉSULTAT 6A = 0 ROWS)
/*
INSERT INTO gd_stay_sessions (stay_slug, start_date, end_date, is_full, seats_left)
VALUES ('dh-experience-11-13-ans', '2026-07-26', '2026-08-01', false, NULL)
ON CONFLICT (stay_slug, start_date) DO NOTHING
RETURNING *;
-- end_date = 2026-08-01 : 26/07 → 01/08 = 7 jours inclusifs ✅
*/


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 7 : VALIDATION FINALE — 0 sessions hors référentiel
-- Exécuter après toutes les corrections pour confirmer Phase 2 OK
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✅ PHASE 2 VALIDÉE — Toutes sessions dans le référentiel UFOVAL'
    ELSE '❌ ' || COUNT(*) || ' sessions hors référentiel restantes'
  END AS statut_phase2,
  STRING_AGG(DISTINCT stay_slug || ' (' ||
    ((end_date::date - start_date::date) + 1)::text || 'j)', ', ') AS detail
FROM gd_stay_sessions
WHERE ((end_date::date - start_date::date) + 1)
  NOT IN (7, 12, 14, 19, 21);
