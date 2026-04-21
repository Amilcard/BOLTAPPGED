-- ----------------------------------------------------------------------------
-- preview.sql — Seed minimal pour Supabase branch preview/e2e-tests
--
-- 3 séjours fictifs + 1 structure test
-- Zéro PII réelle. Régénérable à volonté.
--
-- Tables cibles (schéma prod vérifié 2026-04-21) :
--   - gd_stays (PK slug)
--   - gd_stay_sessions (PK composite stay_slug + start_date)
--   - gd_structures (PK id uuid auto)
--
-- Appliqué auto par scripts/preview/create-branch.sh
-- ----------------------------------------------------------------------------

BEGIN;

-- 1. Séjours (3 profils : court/moyen/long, différentes tranches d'âge)
INSERT INTO gd_stays (
  slug, title, title_pro, title_kids,
  description_pro, description_kids,
  published, season, location_region, location_city,
  duration_days, age_min, age_max,
  accroche, images
) VALUES
  (
    'preview-test-montagne', 'Test Montagne', 'Séjour test montagne', 'Aventure en montagne',
    'Séjour test pour QA. Ne pas utiliser en prod.', 'Séjour fictif pour tester le flux.',
    true, 'ete-2026', 'Auvergne-Rhône-Alpes', 'Chamonix',
    7, 8, 14,
    'Séjour fictif QA — randonnée + escalade.',
    '["https://picsum.photos/seed/montagne/800/600"]'::jsonb
  ),
  (
    'preview-test-mer', 'Test Mer', 'Séjour test mer', 'Vacances à la mer',
    'Séjour test pour QA. Ne pas utiliser en prod.', 'Séjour fictif pour tester le flux.',
    true, 'ete-2026', 'Bretagne', 'Quiberon',
    14, 6, 12,
    'Séjour fictif QA — voile + plage.',
    '["https://picsum.photos/seed/mer/800/600"]'::jsonb
  ),
  (
    'preview-test-equitation', 'Test Équitation', 'Séjour test équitation', 'Cheval et poney',
    'Séjour test pour QA. Ne pas utiliser en prod.', 'Séjour fictif pour tester le flux.',
    true, 'ete-2026', 'Nouvelle-Aquitaine', 'Saintes',
    10, 10, 17,
    'Séjour fictif QA — équitation pour ados.',
    '["https://picsum.photos/seed/equitation/800/600"]'::jsonb
  )
ON CONFLICT (slug) DO NOTHING;

-- 2. Sessions (1 par séjour, dates futures) — table gd_stay_sessions
INSERT INTO gd_stay_sessions (
  stay_slug, start_date, end_date, seats_left, city_departure,
  price, age_min, age_max, is_full, transport_included
)
VALUES
  ('preview-test-montagne',   '2026-07-15', '2026-07-22', 15, 'Lyon',        690.00, 8,  14, false, true),
  ('preview-test-mer',        '2026-07-20', '2026-08-03', 20, 'Paris',       890.00, 6,  12, false, true),
  ('preview-test-equitation', '2026-08-10', '2026-08-20', 12, 'Bordeaux',    790.00, 10, 17, false, true)
ON CONFLICT DO NOTHING;

-- 3. Structure test (foyer ASE fictif) — gd_structures
INSERT INTO gd_structures (name, type, email, status, code, address_private)
VALUES ('Foyer Test Preview', 'foyer', 'preview@groupeetdecouverte.test', 'active', 'PREVIEW-TEST', false)
ON CONFLICT DO NOTHING;

COMMIT;

-- ----------------------------------------------------------------------------
-- Vérif post-seed
-- ----------------------------------------------------------------------------
SELECT 'gd_stays seed' AS table_name, count(*) AS rows FROM gd_stays WHERE slug LIKE 'preview-%'
UNION ALL
SELECT 'gd_stay_sessions seed', count(*) FROM gd_stay_sessions WHERE stay_slug LIKE 'preview-%'
UNION ALL
SELECT 'gd_structures seed', count(*) FROM gd_structures WHERE code = 'PREVIEW-TEST';
