-- Migration 029 : Soft delete sur gd_inscriptions
-- Remplace la suppression physique par un marquage deleted_at.
-- Les inscriptions existantes ont deleted_at = NULL → non affectées.

ALTER TABLE gd_inscriptions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_inscriptions_deleted_at
  ON gd_inscriptions(deleted_at)
  WHERE deleted_at IS NULL;

-- Vérification
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'gd_inscriptions'
  AND column_name = 'deleted_at';
