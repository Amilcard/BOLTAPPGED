-- ============================================================
-- MIGRATION 012 : Normalisation âges, carousel, durées
-- Date       : 2026-02-27
-- Source     : pdf_ufoval (source de vérité)
-- Périmètre  : age_min, age_max, carousel_group, sessions
-- ⚠️  NE PAS TOUCHER : description, pricing, media, seo
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- ÉTAPE 1 : Mise à jour age_min / age_max sur gd_stays
-- Mapping ged_name → slug UFOVAL
-- ─────────────────────────────────────────────────────────────

-- SURVIVOR CAMP 74 (Survie dans le Beaufortain) : 8-12 ans
UPDATE gd_stays
SET age_min = 8, age_max = 12, updated_at = NOW()
WHERE slug = 'survie-dans-le-beaufortain';

-- PARKOUR / URBAN MOVE ACADEMY (Yamakasi / DH Experience) : 11-13 ans
UPDATE gd_stays
SET age_min = 11, age_max = 13, updated_at = NOW()
WHERE slug = 'yamakasi';

-- DUAL CAMP LAC MONT (Glièr'Aventures) : 8-12 ans
UPDATE gd_stays
SET age_min = 8, age_max = 12, updated_at = NOW()
WHERE slug = 'glieraventures';

-- WEST COAST SURF CAMP (Surf sur le Bassin) : 15-17 ans
UPDATE gd_stays
SET age_min = 15, age_max = 17, updated_at = NOW()
WHERE slug = 'surf-sur-le-bassin';

-- DUNE & OCEAN KIDS (Destination Bassin d'Arcachon) : 9-11 ans
UPDATE gd_stays
SET age_min = 9, age_max = 11, updated_at = NOW()
WHERE slug = 'destination-bassin-darcachon-1';

-- WILDLIFE REPORTER (Nature Picture) : 11-14 ans
UPDATE gd_stays
SET age_min = 11, age_max = 14, updated_at = NOW()
WHERE slug = 'nature-picture';

-- ALPINE SKY CAMP (Annecy Elément) : 12-17 ans
UPDATE gd_stays
SET age_min = 12, age_max = 17, updated_at = NOW()
WHERE slug = 'annecy-element';

-- GRAVITY BIKE PARK (DH Experience 11-13 ans) : 11-13 ans
UPDATE gd_stays
SET age_min = 11, age_max = 13, updated_at = NOW()
WHERE slug = 'dh-experience-11-13-ans';


-- ─────────────────────────────────────────────────────────────
-- ÉTAPE 2 : Alignement carousel_group selon âge
-- Règle min_age bucket :
--   6-8  → MA_PREMIERE_COLO
--   9-11 → AVENTURE_DECOUVERTE
--   >= 12 → ADRENALINE_SENSATIONS
-- ─────────────────────────────────────────────────────────────

-- AVENTURE_DECOUVERTE (min_age 8-11)
UPDATE gd_stays
SET carousel_group = 'AVENTURE_DECOUVERTE', updated_at = NOW()
WHERE slug IN (
  'survie-dans-le-beaufortain',  -- 8-12 → bucket 8 → AVENTURE
  'yamakasi',                    -- 11-13 → bucket 11 → AVENTURE
  'glieraventures',              -- 8-12 → bucket 8 → AVENTURE
  'destination-bassin-darcachon-1', -- 9-11 → bucket 9 → AVENTURE
  'nature-picture'               -- 11-14 → bucket 11 → AVENTURE
);

-- ADRENALINE_SENSATIONS (min_age >= 12, ou séjour clairement adrénaline 15-17)
UPDATE gd_stays
SET carousel_group = 'ADRENALINE_SENSATIONS', updated_at = NOW()
WHERE slug IN (
  'surf-sur-le-bassin',    -- 15-17 → ADRENALINE
  'annecy-element',        -- 12-17 → ADRENALINE
  'dh-experience-11-13-ans' -- 11-13 → maintenu ADRENALINE (séjour DH/VTT intensif)
);


-- ─────────────────────────────────────────────────────────────
-- ÉTAPE 3 : Propagation age_min / age_max vers gd_stay_sessions
-- Les sessions héritent des âges du séjour parent
-- ─────────────────────────────────────────────────────────────

UPDATE gd_stay_sessions s
SET age_min = gs.age_min,
    age_max = gs.age_max,
    updated_at = NOW()
FROM gd_stays gs
WHERE s.stay_slug = gs.slug
  AND gs.slug IN (
    'survie-dans-le-beaufortain',
    'yamakasi',
    'glieraventures',
    'surf-sur-le-bassin',
    'destination-bassin-darcachon-1',
    'nature-picture',
    'annecy-element',
    'dh-experience-11-13-ans'
  );


-- ─────────────────────────────────────────────────────────────
-- ÉTAPE 4 : Suppression sessions aux durées invalides
-- Durée = end_date - start_date (en jours)
-- ─────────────────────────────────────────────────────────────

-- DUNE & OCEAN KIDS : durées autorisées [7, 12, 14] — supprimer 19 jours
DELETE FROM gd_stay_sessions
WHERE stay_slug = 'destination-bassin-darcachon-1'
  AND (end_date::date - start_date::date) NOT IN (7, 12, 14);

-- GRAVITY BIKE PARK : durées autorisées [7, 14, 21] — supprimer 6 jours
DELETE FROM gd_stay_sessions
WHERE stay_slug = 'dh-experience-11-13-ans'
  AND (end_date::date - start_date::date) NOT IN (7, 14, 21);

-- Globalement : purger toute session avec durée hors [7, 12, 14, 21]
-- pour les 8 séjours concernés
DELETE FROM gd_stay_sessions
WHERE stay_slug IN (
    'survie-dans-le-beaufortain',
    'yamakasi',
    'glieraventures',
    'surf-sur-le-bassin',
    'nature-picture',
    'annecy-element'
  )
  AND (end_date::date - start_date::date) NOT IN (7, 12, 14, 21);


-- ─────────────────────────────────────────────────────────────
-- ÉTAPE 5 : Checks de sécurité (affichage diagnostique)
-- ─────────────────────────────────────────────────────────────

-- Vérifier qu'aucun séjour n'a age_min NULL
SELECT slug, marketing_title, age_min, age_max, carousel_group
FROM gd_stays
WHERE slug IN (
  'survie-dans-le-beaufortain', 'yamakasi', 'glieraventures',
  'surf-sur-le-bassin', 'destination-bassin-darcachon-1',
  'nature-picture', 'annecy-element', 'dh-experience-11-13-ans'
)
ORDER BY age_min;

-- Vérifier les durées restantes après nettoyage
SELECT
  s.stay_slug,
  (s.end_date::date - s.start_date::date) AS duration_days,
  COUNT(*) AS sessions_count,
  s.start_date, s.end_date
FROM gd_stay_sessions s
WHERE s.stay_slug IN (
  'survie-dans-le-beaufortain', 'yamakasi', 'glieraventures',
  'surf-sur-le-bassin', 'destination-bassin-darcachon-1',
  'nature-picture', 'annecy-element', 'dh-experience-11-13-ans'
)
GROUP BY s.stay_slug, s.start_date, s.end_date
ORDER BY s.stay_slug, duration_days;

-- Vérifier qu'aucune session n'a start_date ou end_date NULL
SELECT stay_slug, start_date, end_date
FROM gd_stay_sessions
WHERE stay_slug IN (
  'survie-dans-le-beaufortain', 'yamakasi', 'glieraventures',
  'surf-sur-le-bassin', 'destination-bassin-darcachon-1',
  'nature-picture', 'annecy-element', 'dh-experience-11-13-ans'
)
  AND (start_date IS NULL OR end_date IS NULL);
