-- ============================================
-- FIX UNIVERSEL: Renseigner données manquantes
-- pour TOUS les séjours existants
-- ============================================

-- 1. Mise à jour age_min/age_max pour TOUS les séjours sans âges
UPDATE gd_stays
SET
  age_min = COALESCE(age_min, 6),
  age_max = COALESCE(age_max, 17)
WHERE age_min IS NULL OR age_max IS NULL;

-- 2. Vérifier résultat
SELECT
  slug,
  title,
  age_min,
  age_max,
  location_city
FROM gd_stays
ORDER BY slug;

-- 3. Pour chaque séjour sans sessions, créer 3 sessions exemple
-- Note: Adapter les dates selon vos besoins réels
DO $$
DECLARE
  sejour RECORD;
BEGIN
  FOR sejour IN
    SELECT DISTINCT s.slug, s.age_min, s.age_max
    FROM gd_stays s
    LEFT JOIN gd_stay_sessions sess ON sess.stay_slug = s.slug
    WHERE sess.stay_slug IS NULL
  LOOP
    INSERT INTO gd_stay_sessions (stay_slug, start_date, end_date, age_min, age_max)
    VALUES
      (sejour.slug, '2026-07-05', '2026-07-12', sejour.age_min, sejour.age_max),
      (sejour.slug, '2026-07-19', '2026-07-26', sejour.age_min, sejour.age_max),
      (sejour.slug, '2026-08-02', '2026-08-09', sejour.age_min, sejour.age_max)
    ON CONFLICT (stay_slug, start_date, end_date) DO NOTHING;
  END LOOP;
END $$;

-- 4. Pour chaque session sans prix, créer prix de base
DO $$
DECLARE
  session_rec RECORD;
BEGIN
  FOR session_rec IN
    SELECT DISTINCT sess.stay_slug, sess.start_date, sess.end_date
    FROM gd_stay_sessions sess
    LEFT JOIN gd_session_prices sp ON
      sp.stay_slug = sess.stay_slug
      AND sp.start_date = sess.start_date
      AND sp.end_date = sess.end_date
      AND sp.city_departure = 'sans_transport'
    WHERE sp.stay_slug IS NULL
  LOOP
    INSERT INTO gd_session_prices (stay_slug, start_date, end_date, city_departure, base_price_eur, price_ged_total)
    VALUES
      (session_rec.stay_slug, session_rec.start_date, session_rec.end_date, 'sans_transport', 850, 850)
    ON CONFLICT (stay_slug, start_date, end_date, city_departure) DO NOTHING;
  END LOOP;
END $$;

-- 5. Vérifier villes de départ pour tous les séjours
DO $$
DECLARE
  sejour_rec RECORD;
BEGIN
  FOR sejour_rec IN
    SELECT DISTINCT slug FROM gd_stays
  LOOP
    INSERT INTO gd_departure_cities (stay_slug, city_name, extra_price_eur)
    VALUES
      (sejour_rec.slug, 'sans_transport', 0),
      (sejour_rec.slug, 'Paris', 0),
      (sejour_rec.slug, 'Lyon', 50)
    ON CONFLICT (stay_slug, city_name) DO NOTHING;
  END LOOP;
END $$;

-- 6. Rapport final
SELECT
  'SEJOURS' as table_name,
  COUNT(*) as total,
  COUNT(CASE WHEN age_min IS NULL OR age_max IS NULL THEN 1 END) as sans_ages
FROM gd_stays

UNION ALL

SELECT
  'SESSIONS' as table_name,
  COUNT(DISTINCT stay_slug) as total,
  NULL as sans_ages
FROM gd_stay_sessions

UNION ALL

SELECT
  'PRIX' as table_name,
  COUNT(DISTINCT stay_slug) as total,
  NULL as sans_ages
FROM gd_session_prices
WHERE city_departure = 'sans_transport'

UNION ALL

SELECT
  'VILLES' as table_name,
  COUNT(DISTINCT stay_slug) as total,
  NULL as sans_ages
FROM gd_departure_cities;
