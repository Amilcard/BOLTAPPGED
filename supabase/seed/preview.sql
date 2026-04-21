-- ----------------------------------------------------------------------------
-- preview.sql — Seed minimal pour Supabase branch preview/e2e-tests
--
-- 3 séjours fictifs + 1 structure test + 1 user test Thanh
-- Zéro PII réelle. Régénérable à volonté.
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

-- 2. Sessions (1 par séjour, dates futures)
INSERT INTO gd_sessions (stay_slug, session_id, date_debut, date_fin, price_cents, age_min, age_max, places_restantes, is_full)
VALUES
  ('preview-test-montagne', 'preview-montagne-s1', '2026-07-15', '2026-07-22', 69000, 8, 14, 15, false),
  ('preview-test-mer', 'preview-mer-s1', '2026-07-20', '2026-08-03', 89000, 6, 12, 20, false),
  ('preview-test-equitation', 'preview-equitation-s1', '2026-08-10', '2026-08-20', 79000, 10, 17, 12, false)
ON CONFLICT (session_id) DO NOTHING;

-- 3. Structure test (foyer ASE fictif)
INSERT INTO gd_structures (code, nom, type, email_direction, statut, created_at)
VALUES ('PREVIEW-TEST', 'Foyer Test Preview', 'foyer', 'preview@groupeetdecouverte.test', 'active', NOW())
ON CONFLICT (code) DO NOTHING;

-- 4. Thanh user fictif (sans mdp — test via magic link)
-- Note : le vrai compte user passera par Supabase Auth — ici juste un educateur_email valide
-- pour tester les flows /educateur/souhait/[token].
-- Pas d'insert gd_users ici : créé à la volée lors de l'inscription test.

COMMIT;

-- ----------------------------------------------------------------------------
-- Vérif post-seed
-- ----------------------------------------------------------------------------
SELECT 'gd_stays seed' AS table_name, count(*) AS rows FROM gd_stays WHERE slug LIKE 'preview-%'
UNION ALL
SELECT 'gd_sessions seed', count(*) FROM gd_sessions WHERE session_id LIKE 'preview-%'
UNION ALL
SELECT 'gd_structures seed', count(*) FROM gd_structures WHERE code = 'PREVIEW-TEST';
