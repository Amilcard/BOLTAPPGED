-- Migration 040 : Délégation directeur → CDS
-- Permet au directeur de déléguer temporairement la gestion des codes à son CDS.

ALTER TABLE gd_structures
  ADD COLUMN IF NOT EXISTS delegation_active_from  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delegation_active_until TIMESTAMPTZ;

-- Index pour vérification rapide de délégation active
CREATE INDEX IF NOT EXISTS idx_structures_delegation
  ON gd_structures (delegation_active_from, delegation_active_until)
  WHERE delegation_active_from IS NOT NULL;

COMMENT ON COLUMN gd_structures.delegation_active_from  IS 'Début de la délégation directeur → CDS (optionnel)';
COMMENT ON COLUMN gd_structures.delegation_active_until IS 'Fin de la délégation directeur → CDS (optionnel)';
