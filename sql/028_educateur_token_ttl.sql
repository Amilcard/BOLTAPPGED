-- Migration 028 : TTL sur educateur_token
-- Ajoute une colonne d'expiration sur gd_souhaits.
-- Les souhaits existants ont NULL → pas d'expiration (compatibilité ascendante).
-- Les nouveaux souhaits auront educateur_token_expires_at = NOW() + 30 jours.

ALTER TABLE gd_souhaits
  ADD COLUMN IF NOT EXISTS educateur_token_expires_at TIMESTAMPTZ DEFAULT NULL;

-- Vérification
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'gd_souhaits'
  AND column_name = 'educateur_token_expires_at';
