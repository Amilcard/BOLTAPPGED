-- =============================================================================
-- P0 — SUPPRESSION SESSIONS FANTÔMES 8j (Ghost Sessions Dim→Dim)
-- Date: 2026-02-18 · Version 3 (post-audit_final_decision)
-- Règle métier confirmée :
--   ✅ La norme UFOVAL est 19 villes de départ par session
--   ✅ EXCEPTION CONFIRMÉE : sperienza-in-corsica-1 a 18 villes (normal)
--   ❌ 1 seule ville = ghost session d'import → à supprimer
--   ❌ Ghost = calcul Dim→Dim (8j) au lieu de Dim→Sam (7j)
--   ✅ Les vraies sessions (7/14/21j avec 18-19 villes) existent déjà en base
--   🚫 Aucun re-import de prix nécessaire — DELETE seul suffit
-- =============================================================================
-- ⚠️ SÉCURITÉ CRITIQUE : cibler le triplet (stay_slug, start_date, end_date)
--    NE PAS utiliser "WHERE stay_slug IN (sous-requête sur stay_slug seul)"
--    → détruirait toutes les sessions valides du séjour (ex: Corse 18 villes)
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 0 : DIAGNOSTIC COMPLET (lecture seule — exécuter en premier)
-- ─────────────────────────────────────────────────────────────────────────────

-- 0A : Toutes les ghost sessions (1 ville) dans la base
-- Ce sont les triplets (slug, start_date, end_date) à supprimer
SELECT
  stay_slug,
  start_date,
  end_date,
  (end_date::date - start_date::date) + 1 AS duree_jours,
  COUNT(*)                                AS nb_villes,
  MAX(price_ged_total)                    AS prix_seul
FROM gd_session_prices
GROUP BY stay_slug, start_date, end_date
HAVING COUNT(*) = 1
ORDER BY stay_slug, start_date;

-- Attendu (séjours confirmés) :
-- aqua-fun, aqua-gliss, aqua-mix, laventure-verticale, natation-et-sensation → ×3
-- destination-bassin-darcachon-1                                               → ×1
-- breizh-equit-kids-8-11-ans                                                  → ×3
-- destination-soleil                                                            → ×3
-- sperienza-in-corsica-1                                                       → ×3
-- surf-sur-le-bassin                                                            → ×1
-- Total attendu : ~21 ghost sessions


-- 0B : Sessions valides qui doivent SURVIVRE au DELETE
-- Vérifier : toutes ont nb_villes ≥ 18 (18 pour Corse, 19 pour les autres)
SELECT
  stay_slug,
  start_date,
  end_date,
  (end_date::date - start_date::date) + 1 AS duree_jours,
  COUNT(*)                                AS nb_villes
FROM gd_session_prices
GROUP BY stay_slug, start_date, end_date
HAVING COUNT(*) >= 18   -- Sessions légitimes (18 Corse, 19 autres)
ORDER BY stay_slug, start_date;

-- Vérification spécifique Corse (doit rester intact) :
SELECT
  stay_slug,
  start_date, end_date,
  COUNT(*) AS nb_villes
FROM gd_session_prices
WHERE stay_slug = 'sperienza-in-corsica-1'
GROUP BY stay_slug, start_date, end_date
ORDER BY start_date;
-- Attendu : 4 sessions 14j avec 18 villes chacune ✅ — NE PAS TOUCHER


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 1 : BACKUP CIBLÉ (ghost sessions uniquement)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gd_session_prices_ghost_backup_2026_02_18 AS
SELECT sp.*
FROM gd_session_prices sp
WHERE (stay_slug, start_date, end_date) IN (
  -- Cibler uniquement les triplets à 1 ville
  SELECT stay_slug, start_date, end_date
  FROM gd_session_prices
  GROUP BY stay_slug, start_date, end_date
  HAVING COUNT(*) = 1
);

SELECT
  COUNT(*)                                AS ghost_lignes_sauvegardees,
  COUNT(DISTINCT stay_slug)               AS sejours_concernes,
  COUNT(DISTINCT (stay_slug, start_date)) AS ghost_sessions
FROM gd_session_prices_ghost_backup_2026_02_18;
-- Attendu : ~21 lignes, ~9 séjours, ~21 sessions


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 2 : DELETE ghost sessions — gd_session_prices
-- Critère : triplets (slug, start_date, end_date) avec exactement 1 ville
-- SÉCURITÉ : ciblage triplet, jamais slug seul
-- DÉCOMMENTER APRÈS VALIDATION ÉTAPES 0 ET 1
-- ─────────────────────────────────────────────────────────────────────────────

/*
DELETE FROM gd_session_prices
WHERE (stay_slug, start_date, end_date) IN (
  SELECT stay_slug, start_date, end_date
  FROM gd_session_prices
  GROUP BY stay_slug, start_date, end_date
  HAVING COUNT(*) = 1  -- Ghost = 1 seule ville
)
RETURNING
  stay_slug,
  start_date,
  end_date,
  (end_date::date - start_date::date) + 1 AS duree_supprimee,
  city_departure,
  price_ged_total;
-- Attendu : ~21 lignes supprimées (jamais les sessions 18/19 villes)
*/


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 3 : DELETE ghost sessions — gd_stay_sessions
-- Supprimer les sessions qui n'ont plus aucun prix associé après l'étape 2
-- C'est exactement la logique de votre step_2 — elle est CORRECTE
-- ─────────────────────────────────────────────────────────────────────────────

-- 3A : Diagnostic — sessions sans prix associés (après étape 2)
SELECT
  ss.stay_slug, ss.start_date, ss.end_date,
  (ss.end_date::date - ss.start_date::date) + 1 AS duree_jours
FROM gd_stay_sessions ss
WHERE NOT EXISTS (
  SELECT 1 FROM gd_session_prices sp
  WHERE sp.stay_slug  = ss.stay_slug
    AND sp.start_date = ss.start_date
    AND sp.end_date   = ss.end_date
)
ORDER BY ss.stay_slug, ss.start_date;
-- Attendu : les sessions 8j (ghost) dans gd_stay_sessions si elles existent

-- 3B : DELETE (DÉCOMMENTER APRÈS ÉTAPE 2 VALIDÉE)
/*
DELETE FROM gd_stay_sessions ss
WHERE NOT EXISTS (
  SELECT 1 FROM gd_session_prices sp
  WHERE sp.stay_slug  = ss.stay_slug
    AND sp.start_date = ss.start_date
    AND sp.end_date   = ss.end_date
)
RETURNING ss.stay_slug, ss.start_date, ss.end_date;
-- Attendu : suppression des sessions 8j orphelines
-- Les sessions 7j/14j/21j avec prix sont conservées ✅
*/


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 4 : VÉRIFICATION FINALE
-- ─────────────────────────────────────────────────────────────────────────────

-- 4A : Plus aucune ghost session (= sessions avec < 18 villes)
SELECT
  stay_slug, start_date, end_date,
  COUNT(*) AS nb_villes
FROM gd_session_prices
GROUP BY stay_slug, start_date, end_date
HAVING COUNT(*) < 18
ORDER BY stay_slug, start_date;
-- Attendu : 0 lignes ✅

-- 4B : Rapport final par séjour
SELECT
  stay_slug,
  COUNT(DISTINCT (start_date, end_date)) AS nb_sessions_valides,
  MIN(COUNT(*))                           OVER (PARTITION BY stay_slug) AS villes_min,
  MAX((end_date::date - start_date::date) + 1) AS duree_max_j
FROM gd_session_prices
GROUP BY stay_slug, start_date, end_date
ORDER BY stay_slug;

-- 4C : Checkpoint global — sessions_sans_prix doit être 0
SELECT
  CASE
    WHEN COUNT(*) = 0
    THEN '✅ P0 VALIDÉ — sessions_sans_prix = 0 pour les 24 séjours'
    ELSE '❌ ' || COUNT(*) || ' sessions encore sans prix'
  END AS checkpoint_p0
FROM (
  SELECT ss.stay_slug, ss.start_date
  FROM gd_stay_sessions ss
  WHERE NOT EXISTS (
    SELECT 1 FROM gd_session_prices sp
    WHERE sp.stay_slug  = ss.stay_slug
      AND sp.start_date = ss.start_date
      AND sp.end_date   = ss.end_date
  )
) orphelins;


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 5 : CAS DISTINCTS — Non liés aux ghosts 8j (traitement séparé)
-- ─────────────────────────────────────────────────────────────────────────────

-- 5A : GRAVITY BIKE PARK — 2 sessions vraiment absentes des DEUX tables
--      → 12/07→18/07 (is_full=true) et 26/07→01/08 (disponible)
--      Action : INSERT après validation UFOVAL (voir PHASE2_DATA_CLEANUP_SAFE.sql)
SELECT
  'dh-experience-11-13-ans' AS stay_slug,
  '12/07→18/07 (is_full=true) + 26/07→01/08 (disponible)' AS sessions_a_inserer,
  'Source : copier les 18 villes de la session 07-05→07-11' AS methode;

-- 5B : GRAVITY BIKE PARK — session 23/08 stockée en 6j (→ 29/08 attendu)
--      Action : UPDATE end_date dans stay_sessions ET session_prices
SELECT ss.stay_slug, ss.start_date, ss.end_date,
       (ss.end_date::date - ss.start_date::date) + 1 AS duree_actuelle
FROM gd_stay_sessions ss
WHERE stay_slug = 'dh-experience-11-13-ans'
  AND (end_date::date - start_date::date) + 1 = 6;

-- 5C : sperienza-in-corsica-1 — 18 villes (EXCEPTION VALIDÉE)
--      Vérifier sur UFOVAL quelle ville est absente vs les 19 autres séjours
SELECT DISTINCT city_departure FROM gd_session_prices WHERE stay_slug = 'sperienza-in-corsica-1' ORDER BY 1;
-- Si city_departure manquante = une ville structurellement non desservie → OK, aucune action
-- Sinon → import partiel → relancer scraper sur ce séjour

-- 5D : les-ptits-puisotins-1 — 5 villes seulement
SELECT DISTINCT city_departure FROM gd_session_prices WHERE stay_slug = 'les-ptits-puisotins-1' ORDER BY 1;


-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK D'URGENCE
-- ─────────────────────────────────────────────────────────────────────────────
/*
INSERT INTO gd_session_prices
SELECT * FROM gd_session_prices_ghost_backup_2026_02_18
ON CONFLICT DO NOTHING;
*/
