-- =============================================
-- BACKFILL: Remplir les age_min/age_max NULL
-- dans gd_stay_sessions pour les 17 sejours concernes
-- Source: age range consistant des autres sessions du meme sejour
-- Date: 2026-02-07
-- =============================================

BEGIN;

-- annecy-element: 15-17
UPDATE gd_stay_sessions SET age_min = 15, age_max = 17
WHERE stay_slug = 'annecy-element' AND age_min IS NULL;

-- aqua-fun: 12-14
UPDATE gd_stay_sessions SET age_min = 12, age_max = 14
WHERE stay_slug = 'aqua-fun' AND age_min IS NULL;

-- aqua-gliss: 7-8
UPDATE gd_stay_sessions SET age_min = 7, age_max = 8
WHERE stay_slug = 'aqua-gliss' AND age_min IS NULL;

-- aqua-mix: 9-11
UPDATE gd_stay_sessions SET age_min = 9, age_max = 11
WHERE stay_slug = 'aqua-mix' AND age_min IS NULL;

-- destination-soleil: 15-17
UPDATE gd_stay_sessions SET age_min = 15, age_max = 17
WHERE stay_slug = 'destination-soleil' AND age_min IS NULL;

-- dh-experience-11-13-ans: 11-13
UPDATE gd_stay_sessions SET age_min = 11, age_max = 13
WHERE stay_slug = 'dh-experience-11-13-ans' AND age_min IS NULL;

-- e-sport-and-sport: 12-17
UPDATE gd_stay_sessions SET age_min = 12, age_max = 17
WHERE stay_slug = 'e-sport-and-sport' AND age_min IS NULL;

-- explore-mountain: 9-12
UPDATE gd_stay_sessions SET age_min = 9, age_max = 12
WHERE stay_slug = 'explore-mountain' AND age_min IS NULL;

-- laventure-verticale: 9-11
UPDATE gd_stay_sessions SET age_min = 9, age_max = 11
WHERE stay_slug = 'laventure-verticale' AND age_min IS NULL;

-- les-robinson-des-glieres: 9-14
UPDATE gd_stay_sessions SET age_min = 9, age_max = 14
WHERE stay_slug = 'les-robinson-des-glieres' AND age_min IS NULL;

-- moto-moto: 12-14
UPDATE gd_stay_sessions SET age_min = 12, age_max = 14
WHERE stay_slug = 'moto-moto' AND age_min IS NULL;

-- mountain-and-chill: 12-14
UPDATE gd_stay_sessions SET age_min = 12, age_max = 14
WHERE stay_slug = 'mountain-and-chill' AND age_min IS NULL;

-- natation-et-sensation: 6-8
UPDATE gd_stay_sessions SET age_min = 6, age_max = 8
WHERE stay_slug = 'natation-et-sensation' AND age_min IS NULL;

-- nature-picture: 9-14
UPDATE gd_stay_sessions SET age_min = 9, age_max = 14
WHERE stay_slug = 'nature-picture' AND age_min IS NULL;

-- surf-sur-le-bassin: 12-15
UPDATE gd_stay_sessions SET age_min = 12, age_max = 15
WHERE stay_slug = 'surf-sur-le-bassin' AND age_min IS NULL;

-- survie-dans-le-beaufortain: 11-14
UPDATE gd_stay_sessions SET age_min = 11, age_max = 14
WHERE stay_slug = 'survie-dans-le-beaufortain' AND age_min IS NULL;

-- yamakasi: 12-17
UPDATE gd_stay_sessions SET age_min = 12, age_max = 17
WHERE stay_slug = 'yamakasi' AND age_min IS NULL;

COMMIT;

-- Verification: doit retourner 0 lignes
SELECT stay_slug, age_min, age_max
FROM gd_stay_sessions
WHERE age_min IS NULL OR age_max IS NULL;
