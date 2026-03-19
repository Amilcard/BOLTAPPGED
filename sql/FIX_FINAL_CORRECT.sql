-- ============================================
-- FIX FINAL: Renseigner données manquantes
-- Pour TOUS les 20 séjours existants
-- ============================================

-- 1. Créer sessions pour les séjours qui n'en ont pas
INSERT INTO gd_stay_sessions (stay_slug, start_date, end_date, age_min, age_max)
SELECT
  s.slug,
  '2026-07-05'::date as start_date,
  '2026-07-12'::date as end_date,
  s.age_min,
  s.age_max
FROM gd_stays s
WHERE NOT EXISTS (
  SELECT 1 FROM gd_stay_sessions sess
  WHERE sess.stay_slug = s.slug
  AND sess.start_date = '2026-07-05'
)
ON CONFLICT (stay_slug, start_date, end_date) DO NOTHING;

INSERT INTO gd_stay_sessions (stay_slug, start_date, end_date, age_min, age_max)
SELECT
  s.slug,
  '2026-07-19'::date as start_date,
  '2026-07-26'::date as end_date,
  s.age_min,
  s.age_max
FROM gd_stays s
WHERE NOT EXISTS (
  SELECT 1 FROM gd_stay_sessions sess
  WHERE sess.stay_slug = s.slug
  AND sess.start_date = '2026-07-19'
)
ON CONFLICT (stay_slug, start_date, end_date) DO NOTHING;

INSERT INTO gd_stay_sessions (stay_slug, start_date, end_date, age_min, age_max)
SELECT
  s.slug,
  '2026-08-02'::date as start_date,
  '2026-08-09'::date as end_date,
  s.age_min,
  s.age_max
FROM gd_stays s
WHERE NOT EXISTS (
  SELECT 1 FROM gd_stay_sessions sess
  WHERE sess.stay_slug = s.slug
  AND sess.start_date = '2026-08-02'
)
ON CONFLICT (stay_slug, start_date, end_date) DO NOTHING;

-- 2. Créer prix pour toutes les sessions sans prix
INSERT INTO gd_session_prices (stay_slug, start_date, end_date, city_departure, base_price_eur, price_ged_total)
SELECT
  sess.stay_slug,
  sess.start_date,
  sess.end_date,
  'sans_transport' as city_departure,
  850 as base_price_eur,
  850 as price_ged_total
FROM gd_stay_sessions sess
WHERE NOT EXISTS (
  SELECT 1 FROM gd_session_prices sp
  WHERE sp.stay_slug = sess.stay_slug
  AND sp.start_date = sess.start_date
  AND sp.end_date = sess.end_date
  AND sp.city_departure = 'sans_transport'
)
ON CONFLICT (stay_slug, start_date, end_date, city_departure) DO NOTHING;

-- 3. Mettre à jour content_kids pour ajouter les villes de départ
UPDATE gd_stays
SET content_kids = jsonb_set(
  COALESCE(content_kids, '{}'::jsonb),
  '{departureCities}',
  '[
    {"city": "sans_transport", "extra_eur": 0},
    {"city": "Paris", "extra_eur": 0},
    {"city": "Lyon", "extra_eur": 50}
  ]'::jsonb
)
WHERE content_kids IS NULL
   OR NOT content_kids ? 'departureCities'
   OR jsonb_array_length(content_kids->'departureCities') = 0;

-- 4. Rapport final
SELECT
  'Séjours totaux' as element,
  COUNT(*) as nombre
FROM gd_stays

UNION ALL

SELECT
  'Sessions créées' as element,
  COUNT(*) as nombre
FROM gd_stay_sessions

UNION ALL

SELECT
  'Prix renseignés' as element,
  COUNT(*) as nombre
FROM gd_session_prices
WHERE city_departure = 'sans_transport'

UNION ALL

SELECT
  'Séjours avec villes' as element,
  COUNT(*) as nombre
FROM gd_stays
WHERE content_kids ? 'departureCities'
  AND jsonb_array_length(content_kids->'departureCities') > 0;
