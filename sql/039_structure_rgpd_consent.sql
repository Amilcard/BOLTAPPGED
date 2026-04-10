-- 039_structure_rgpd_consent.sql
-- Engagement RGPD structure : l'éducateur/CDS doit accepter les conditions
-- avant d'accéder aux données des inscriptions.

ALTER TABLE gd_structures ADD COLUMN IF NOT EXISTS rgpd_accepted_at TIMESTAMPTZ;
ALTER TABLE gd_structures ADD COLUMN IF NOT EXISTS rgpd_accepted_by TEXT;

COMMENT ON COLUMN gd_structures.rgpd_accepted_at IS
  'Date acceptation engagement RGPD par la structure (premier accès).';
COMMENT ON COLUMN gd_structures.rgpd_accepted_by IS
  'Identifiant (code utilisé) de la personne ayant accepté.';
