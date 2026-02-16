-- ============================================
-- 010b: Vue orphelins + index
-- Exécuter en un seul bloc dans Supabase SQL Editor
-- ============================================

-- Supprimer si existante (pour re-création propre)
DROP VIEW IF EXISTS v_orphaned_records;

-- Créer la vue
CREATE VIEW v_orphaned_records AS

SELECT 'inscription_sans_sejour'::text AS type,
       i.id::text AS record_id,
       i.sejour_slug::text AS ref_value
FROM gd_inscriptions i
LEFT JOIN gd_stays s ON i.sejour_slug = s.slug
WHERE s.slug IS NULL

UNION ALL

SELECT 'session_sans_sejour'::text AS type,
       ss.id::text AS record_id,
       ss.stay_slug::text AS ref_value
FROM gd_stay_sessions ss
LEFT JOIN gd_stays s ON ss.stay_slug = s.slug
WHERE s.slug IS NULL

UNION ALL

SELECT 'prix_sans_sejour'::text AS type,
       sp.id::text AS record_id,
       sp.stay_slug::text AS ref_value
FROM gd_session_prices sp
LEFT JOIN gd_stays s ON sp.stay_slug = s.slug
WHERE s.slug IS NULL

UNION ALL

SELECT 'inscription_session_orpheline'::text AS type,
       i.id::text AS record_id,
       (i.sejour_slug || ' @ ' || i.session_date)::text AS ref_value
FROM gd_inscriptions i
LEFT JOIN gd_stay_sessions ss
  ON i.sejour_slug = ss.stay_slug
  AND i.session_date::date = ss.start_date::date
WHERE ss.id IS NULL
  AND i.session_date IS NOT NULL;

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_gd_stay_sessions_stay_slug ON gd_stay_sessions(stay_slug);
CREATE INDEX IF NOT EXISTS idx_gd_session_prices_stay_slug ON gd_session_prices(stay_slug);
CREATE INDEX IF NOT EXISTS idx_gd_inscriptions_sejour_slug ON gd_inscriptions(sejour_slug);
CREATE INDEX IF NOT EXISTS idx_gd_inscriptions_session_date ON gd_inscriptions(session_date);

-- Test immédiat
SELECT * FROM v_orphaned_records LIMIT 100;
