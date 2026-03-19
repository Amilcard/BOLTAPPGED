-- ============================================
-- LISTE TOUTES LES COLONNES DE gd_stays
-- À exécuter dans Supabase pour voir le schéma réel
-- ============================================

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'gd_stays'
ORDER BY ordinal_position;
