-- ============================================
-- FIX: Données manquantes GAMING HOUSE 1850
-- Objectif: Débloquer tunnel inscription
-- ============================================

-- 1. Vérifier état actuel
SELECT
  slug,
  title,
  age_min,
  age_max,
  location_city
FROM gd_stays
WHERE slug = 'gaming-house-1850';

-- 2. Renseigner âges séjour (si NULL)
UPDATE gd_stays
SET
  age_min = 6,
  age_max = 17
WHERE slug = 'gaming-house-1850'
  AND (age_min IS NULL OR age_max IS NULL);

-- 3. Vérifier sessions existantes
SELECT
  stay_slug,
  start_date,
  end_date,
  age_min,
  age_max
FROM gd_stay_sessions
WHERE stay_slug = 'gaming-house-1850'
ORDER BY start_date;

-- 4. Ajouter sessions si vides (éviter doublons)
INSERT INTO gd_stay_sessions (stay_slug, start_date, end_date, age_min, age_max)
VALUES
  ('gaming-house-1850', '2026-07-05', '2026-07-12', 6, 17),
  ('gaming-house-1850', '2026-07-19', '2026-07-26', 6, 17),
  ('gaming-house-1850', '2026-08-02', '2026-08-09', 6, 17)
ON CONFLICT (stay_slug, start_date, end_date) DO NOTHING;

-- 5. Vérifier prix existants
SELECT
  stay_slug,
  start_date,
  end_date,
  city_departure,
  base_price_eur,
  price_ged_total
FROM gd_session_prices
WHERE stay_slug = 'gaming-house-1850'
  AND city_departure = 'sans_transport'
ORDER BY start_date;

-- 6. Ajouter prix si vides
INSERT INTO gd_session_prices (stay_slug, start_date, end_date, city_departure, base_price_eur, price_ged_total)
VALUES
  ('gaming-house-1850', '2026-07-05', '2026-07-12', 'sans_transport', 850, 850),
  ('gaming-house-1850', '2026-07-19', '2026-07-26', 'sans_transport', 850, 850),
  ('gaming-house-1850', '2026-08-02', '2026-08-09', 'sans_transport', 850, 850)
ON CONFLICT (stay_slug, start_date, end_date, city_departure) DO NOTHING;

-- 7. Ajouter villes départ si vides
INSERT INTO gd_departure_cities (stay_slug, city_name, extra_price_eur)
VALUES
  ('gaming-house-1850', 'sans_transport', 0),
  ('gaming-house-1850', 'Paris', 0),
  ('gaming-house-1850', 'Lyon', 50),
  ('gaming-house-1850', 'Marseille', 80),
  ('gaming-house-1850', 'Annecy', 0)
ON CONFLICT (stay_slug, city_name) DO NOTHING;

-- 8. Vérification finale
SELECT
  'STAYS' as table_name,
  COUNT(*) as count,
  MIN(age_min) as min_age,
  MAX(age_max) as max_age
FROM gd_stays
WHERE slug = 'gaming-house-1850'

UNION ALL

SELECT
  'SESSIONS' as table_name,
  COUNT(*) as count,
  NULL as min_age,
  NULL as max_age
FROM gd_stay_sessions
WHERE stay_slug = 'gaming-house-1850'

UNION ALL

SELECT
  'PRICES' as table_name,
  COUNT(*) as count,
  NULL as min_age,
  NULL as max_age
FROM gd_session_prices
WHERE stay_slug = 'gaming-house-1850'
  AND city_departure = 'sans_transport';
