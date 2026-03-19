-- ============================================================
-- Migration : ajout de updated_at à gd_session_prices
-- À exécuter dans Supabase → SQL Editor
-- ============================================================

-- 1. Ajouter la colonne updated_at (nullable pour l'instant)
ALTER TABLE gd_session_prices
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Créer un trigger qui met à jour updated_at automatiquement
--    à chaque UPDATE sur la table
CREATE OR REPLACE FUNCTION set_session_prices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_session_prices_updated_at ON gd_session_prices;

CREATE TRIGGER trg_session_prices_updated_at
  BEFORE UPDATE ON gd_session_prices
  FOR EACH ROW
  EXECUTE FUNCTION set_session_prices_updated_at();

-- 3. Backfill : les sessions déjà marquées is_full = true reçoivent
--    NOW() comme timestamp de référence (on ne sait pas quand elles
--    ont été mises à jour, on utilise la date d'aujourd'hui)
UPDATE gd_session_prices
SET updated_at = NOW()
WHERE is_full = true AND updated_at IS NULL;

-- 4. Vérification : affiche les sessions complètes avec leur timestamp
SELECT stay_slug, start_date, end_date, is_full, updated_at
FROM gd_session_prices
WHERE is_full = true
ORDER BY stay_slug, start_date;
