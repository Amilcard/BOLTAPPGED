-- =============================================================================
-- P0 — PRICE_RESTORATION : Réinjection grilles tarifaires manquantes
-- Date: 2026-02-18
-- Périmètre: 19 sessions sans prix sur 8 séjours (Q2 Phase 1)
-- Dates manquantes: 05/07, 19/07, 02/08 (pattern commun)
-- Stratégie: Copier les prix des sessions VOISINES du même séjour (même durée)
-- Formule: price_ged_total = base_price_eur + markup_duration + transport_surcharge_ged
--   Markup 7j : +180€ (tranche 5-8j)
-- Schema réel: stay_slug + start_date + end_date (PK composite, pas d'id)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 0 : DIAGNOSTIC — Voir les prix existants par séjour impacté
-- Identifier les sessions QUI ONT des prix → servira de template pour les INSERTs
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  sp.stay_slug,
  s.marketing_title,
  sp.start_date,
  sp.end_date,
  (sp.end_date::date - sp.start_date::date) + 1 AS duree_jours,
  COUNT(*)                                        AS nb_rows_prix,
  MIN(sp.price_ged_total)                         AS prix_min,
  MAX(sp.price_ged_total)                         AS prix_max,
  AVG(sp.price_ged_total)::NUMERIC(10,0)          AS prix_moyen
FROM gd_session_prices sp
JOIN gd_stays s ON s.slug = sp.stay_slug
WHERE sp.stay_slug IN (
  'aqua-fun',                      -- AZUR DIVE & JET
  'aqua-gliss',                    -- BABY RIDERS
  'aqua-mix',                      -- BLUE EXPERIENCE
  'destination-bassin-darcachon-1',-- DUNE & OCEAN KIDS
  'dh-experience-11-13-ans',       -- GRAVITY BIKE PARK
  'laventure-verticale',           -- ROCKS & PADDLE
  'les-ptits-puisotins-1',         -- MY LITTLE FOREST
  'natation-et-sensation'          -- SWIM ACADEMY
)
AND (sp.end_date::date - sp.start_date::date) + 1 = 7  -- Sessions 7j uniquement
GROUP BY sp.stay_slug, s.marketing_title, sp.start_date, sp.end_date
ORDER BY sp.stay_slug, sp.start_date;

-- RÉSULTAT ATTENDU : Les sessions avec prix (ex: 12/07, 26/07, 09/08, 16/08)
-- affichent leurs prix → on les utilisera comme template pour INSERT des sessions sans prix


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 1 : BACKUP — Snapshot avant toute modification
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gd_session_prices_backup_p0_2026_02_18 AS
SELECT * FROM gd_session_prices
WHERE stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix',
  'destination-bassin-darcachon-1', 'dh-experience-11-13-ans',
  'laventure-verticale', 'les-ptits-puisotins-1', 'natation-et-sensation'
);

SELECT COUNT(*) AS rows_sauvegardees,
       STRING_AGG(DISTINCT stay_slug, ', ') AS sejours
FROM gd_session_prices_backup_p0_2026_02_18;


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 2 : STRATÉGIE DE RÉINJECTION PAR COPIE DES SESSIONS VOISINES
-- Pour chaque séjour, copier les prix d'une session 7j EXISTANTE vers les sessions manquantes
-- ON CONFLICT DO NOTHING = idempotent, safe à ré-exécuter
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 2A : AZUR DIVE & JET (aqua-fun)
-- Sessions sans prix : 05/07→11/07, 19/07→25/07, 02/08→08/08
-- Source template : utiliser les prix d'une session 7j existante (ex: 26/07 ou 09/08 ou 16/08)
INSERT INTO gd_session_prices (stay_slug, start_date, end_date, price_ged_total)
SELECT
  stay_slug,
  target_start,
  target_end,
  price_ged_total  -- Prix identique pour même durée / même séjour
FROM (
  -- Session source : première session 7j ayant des prix
  SELECT
    sp.stay_slug,
    sp.price_ged_total,
    unnest(ARRAY[
      DATE '2026-07-05', DATE '2026-07-19', DATE '2026-08-02'
    ]) AS target_start,
    unnest(ARRAY[
      DATE '2026-07-11', DATE '2026-07-25', DATE '2026-08-08'
    ]) AS target_end
  FROM gd_session_prices sp
  WHERE sp.stay_slug = 'aqua-fun'
    AND (sp.end_date::date - sp.start_date::date) + 1 = 7
  LIMIT 1  -- Prendre une session source existante
) src
WHERE NOT EXISTS (
  SELECT 1 FROM gd_session_prices
  WHERE stay_slug = src.stay_slug
    AND start_date = src.target_start
    AND end_date = src.target_end
);

-- ── 2B : BABY RIDERS (aqua-gliss)
INSERT INTO gd_session_prices (stay_slug, start_date, end_date, price_ged_total)
SELECT
  stay_slug, target_start, target_end, price_ged_total
FROM (
  SELECT
    sp.stay_slug, sp.price_ged_total,
    unnest(ARRAY[DATE '2026-07-05', DATE '2026-07-19', DATE '2026-08-02']) AS target_start,
    unnest(ARRAY[DATE '2026-07-11', DATE '2026-07-25', DATE '2026-08-08']) AS target_end
  FROM gd_session_prices sp
  WHERE sp.stay_slug = 'aqua-gliss'
    AND (sp.end_date::date - sp.start_date::date) + 1 = 7
  LIMIT 1
) src
WHERE NOT EXISTS (
  SELECT 1 FROM gd_session_prices
  WHERE stay_slug = src.stay_slug
    AND start_date = src.target_start AND end_date = src.target_end
);

-- ── 2C : BLUE EXPERIENCE (aqua-mix)
INSERT INTO gd_session_prices (stay_slug, start_date, end_date, price_ged_total)
SELECT
  stay_slug, target_start, target_end, price_ged_total
FROM (
  SELECT
    sp.stay_slug, sp.price_ged_total,
    unnest(ARRAY[DATE '2026-07-05', DATE '2026-07-19', DATE '2026-08-02']) AS target_start,
    unnest(ARRAY[DATE '2026-07-11', DATE '2026-07-25', DATE '2026-08-08']) AS target_end
  FROM gd_session_prices sp
  WHERE sp.stay_slug = 'aqua-mix'
    AND (sp.end_date::date - sp.start_date::date) + 1 = 7
  LIMIT 1
) src
WHERE NOT EXISTS (
  SELECT 1 FROM gd_session_prices
  WHERE stay_slug = src.stay_slug
    AND start_date = src.target_start AND end_date = src.target_end
);

-- ── 2D : DUNE & OCEAN KIDS (destination-bassin-darcachon-1)
-- Session sans prix : 19/07→25/07 uniquement
INSERT INTO gd_session_prices (stay_slug, start_date, end_date, price_ged_total)
SELECT
  stay_slug, DATE '2026-07-19', DATE '2026-07-25', price_ged_total
FROM gd_session_prices
WHERE stay_slug = 'destination-bassin-darcachon-1'
  AND (end_date::date - start_date::date) + 1 = 7
LIMIT 1
ON CONFLICT DO NOTHING;

-- ── 2E : GRAVITY BIKE PARK (dh-experience-11-13-ans)
-- Sessions sans prix : 12/07→18/07, 02/08→08/08
-- Note : ces sessions ont is_full=true mais le prix reste requis pour validation inscription
INSERT INTO gd_session_prices (stay_slug, start_date, end_date, price_ged_total)
SELECT
  stay_slug, target_start, target_end, price_ged_total
FROM (
  SELECT
    sp.stay_slug, sp.price_ged_total,
    unnest(ARRAY[DATE '2026-07-12', DATE '2026-08-02']) AS target_start,
    unnest(ARRAY[DATE '2026-07-18', DATE '2026-08-08']) AS target_end
  FROM gd_session_prices sp
  WHERE sp.stay_slug = 'dh-experience-11-13-ans'
    AND (sp.end_date::date - sp.start_date::date) + 1 = 7
  LIMIT 1
) src
WHERE NOT EXISTS (
  SELECT 1 FROM gd_session_prices
  WHERE stay_slug = src.stay_slug
    AND start_date = src.target_start AND end_date = src.target_end
);

-- ── 2F : ROCKS & PADDLE (laventure-verticale)
INSERT INTO gd_session_prices (stay_slug, start_date, end_date, price_ged_total)
SELECT
  stay_slug, target_start, target_end, price_ged_total
FROM (
  SELECT
    sp.stay_slug, sp.price_ged_total,
    unnest(ARRAY[DATE '2026-07-05', DATE '2026-07-19', DATE '2026-08-02']) AS target_start,
    unnest(ARRAY[DATE '2026-07-11', DATE '2026-07-25', DATE '2026-08-08']) AS target_end
  FROM gd_session_prices sp
  WHERE sp.stay_slug = 'laventure-verticale'
    AND (sp.end_date::date - sp.start_date::date) + 1 = 7
  LIMIT 1
) src
WHERE NOT EXISTS (
  SELECT 1 FROM gd_session_prices
  WHERE stay_slug = src.stay_slug
    AND start_date = src.target_start AND end_date = src.target_end
);

-- ── 2G : MY LITTLE FOREST (les-ptits-puisotins-1)
-- Session sans prix : 23/08→29/08 (session 7j après correction 6j→7j)
-- Prérequis : correction 6j→7j DOIT être faite avant (end_date = 29/08)
INSERT INTO gd_session_prices (stay_slug, start_date, end_date, price_ged_total)
SELECT
  stay_slug, DATE '2026-08-23', DATE '2026-08-29', price_ged_total
FROM gd_session_prices
WHERE stay_slug = 'les-ptits-puisotins-1'
  AND (end_date::date - start_date::date) + 1 = 7
LIMIT 1
ON CONFLICT DO NOTHING;

-- ── 2H : SWIM ACADEMY (natation-et-sensation)
INSERT INTO gd_session_prices (stay_slug, start_date, end_date, price_ged_total)
SELECT
  stay_slug, target_start, target_end, price_ged_total
FROM (
  SELECT
    sp.stay_slug, sp.price_ged_total,
    unnest(ARRAY[DATE '2026-07-05', DATE '2026-07-19', DATE '2026-08-02']) AS target_start,
    unnest(ARRAY[DATE '2026-07-11', DATE '2026-07-25', DATE '2026-08-08']) AS target_end
  FROM gd_session_prices sp
  WHERE sp.stay_slug = 'natation-et-sensation'
    AND (sp.end_date::date - sp.start_date::date) + 1 = 7
  LIMIT 1
) src
WHERE NOT EXISTS (
  SELECT 1 FROM gd_session_prices
  WHERE stay_slug = src.stay_slug
    AND start_date = src.target_start AND end_date = src.target_end
);


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 3 : VÉRIFICATION POST-INJECTION
-- Doit retourner 0 ligne (toutes les sessions ont un prix)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  ss.stay_slug,
  s.marketing_title,
  ss.start_date,
  ss.end_date,
  (ss.end_date::date - ss.start_date::date) + 1 AS duree_jours,
  sp.price_ged_total,
  '❌ ENCORE SANS PRIX'                          AS statut
FROM gd_stay_sessions ss
LEFT JOIN gd_stays s ON s.slug = ss.stay_slug
LEFT JOIN gd_session_prices sp
  ON sp.stay_slug = ss.stay_slug
  AND sp.start_date = ss.start_date
  AND sp.end_date   = ss.end_date
WHERE ss.stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix',
  'destination-bassin-darcachon-1', 'dh-experience-11-13-ans',
  'laventure-verticale', 'les-ptits-puisotins-1', 'natation-et-sensation'
)
  AND sp.price_ged_total IS NULL
ORDER BY ss.stay_slug, ss.start_date;

-- Si 0 rows → P0_PRICE_RESTORATION validé ✅
-- Si rows restants → relancer les INSERTs manquants (vérifier qu'une session source existe)


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 4 : CHECKPOINT P0 — Validation globale avant passage Phase 3
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✅ P0_PRICE_RESTORATION VALIDÉ — 0 session sans prix sur les 8 séjours impactés'
    ELSE '❌ ' || COUNT(*) || ' sessions encore sans prix — NE PAS passer à Phase 3'
  END AS checkpoint_p0
FROM gd_stay_sessions ss
LEFT JOIN gd_session_prices sp
  ON sp.stay_slug = ss.stay_slug
  AND sp.start_date = ss.start_date
  AND sp.end_date = ss.end_date
WHERE ss.stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix',
  'destination-bassin-darcachon-1', 'dh-experience-11-13-ans',
  'laventure-verticale', 'les-ptits-puisotins-1', 'natation-et-sensation'
)
  AND sp.price_ged_total IS NULL;
