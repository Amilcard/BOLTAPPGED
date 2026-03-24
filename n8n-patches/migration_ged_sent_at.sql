-- ============================================================
-- Migration : ajout colonne ged_sent_at dans gd_dossier_enfant
-- Anti-doublon envoi GED : NULL = pas encore envoyé
-- ============================================================

ALTER TABLE gd_dossier_enfant
  ADD COLUMN IF NOT EXISTS ged_sent_at TIMESTAMPTZ DEFAULT NULL;

-- Vérification
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'gd_dossier_enfant'
  AND column_name = 'ged_sent_at';
