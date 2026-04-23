-- ROLLBACK Migration 083 — Métadonnées de signature électronique
-- À exécuter UNIQUEMENT si problème détecté post-déploiement.
-- ⚠️ ATTENTION : ce rollback supprime TOUTES les données de signature
-- horodatée et IP déjà persistées. Ne l'exécuter qu'en urgence.

-- Drop indexes
DROP INDEX IF EXISTS idx_gd_dossier_enfant_bulletin_signed_at;
DROP INDEX IF EXISTS idx_gd_dossier_enfant_sanitaire_signed_at;
DROP INDEX IF EXISTS idx_gd_dossier_enfant_liaison_signed_at;

-- Drop check constraints
ALTER TABLE public.gd_dossier_enfant
  DROP CONSTRAINT IF EXISTS gd_dossier_enfant_bulletin_signer_qualite_check,
  DROP CONSTRAINT IF EXISTS gd_dossier_enfant_sanitaire_signer_qualite_check,
  DROP CONSTRAINT IF EXISTS gd_dossier_enfant_liaison_signer_qualite_check;

-- Drop columns (signature metadata Bulletin)
ALTER TABLE public.gd_dossier_enfant
  DROP COLUMN IF EXISTS bulletin_signed_at,
  DROP COLUMN IF EXISTS bulletin_signed_ip,
  DROP COLUMN IF EXISTS bulletin_signer_qualite,
  DROP COLUMN IF EXISTS bulletin_signature_hash;

-- Drop columns (signature metadata Sanitaire)
ALTER TABLE public.gd_dossier_enfant
  DROP COLUMN IF EXISTS sanitaire_signed_at,
  DROP COLUMN IF EXISTS sanitaire_signed_ip,
  DROP COLUMN IF EXISTS sanitaire_signer_qualite,
  DROP COLUMN IF EXISTS sanitaire_signature_hash;

-- Drop columns (signature metadata Liaison)
ALTER TABLE public.gd_dossier_enfant
  DROP COLUMN IF EXISTS liaison_signed_at,
  DROP COLUMN IF EXISTS liaison_signed_ip,
  DROP COLUMN IF EXISTS liaison_signer_qualite,
  DROP COLUMN IF EXISTS liaison_signature_hash;

-- Drop shared column
ALTER TABLE public.gd_dossier_enfant
  DROP COLUMN IF EXISTS consent_text_version;

-- Fin ROLLBACK 083
