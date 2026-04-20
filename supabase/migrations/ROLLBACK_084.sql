-- ROLLBACK migration 084

-- 1. Restaurer last_jti + last_jti_exp dans la vue
CREATE OR REPLACE VIEW gd_structure_members
WITH (security_invoker = true)
AS
SELECT
  id,
  structure_id,
  code,
  role,
  label,
  active,
  created_at,
  email,
  prenom,
  nom,
  roles,
  expires_at,
  invitation_expires_at,
  activated_at,
  invited_by_email,
  last_jti,
  last_jti_exp
FROM gd_structure_access_codes
WHERE email IS NOT NULL;

-- 2. Supprimer CHECK constraints hash
ALTER TABLE public.gd_dossier_enfant
  DROP CONSTRAINT IF EXISTS gd_dossier_enfant_bulletin_signature_hash_check,
  DROP CONSTRAINT IF EXISTS gd_dossier_enfant_sanitaire_signature_hash_check,
  DROP CONSTRAINT IF EXISTS gd_dossier_enfant_liaison_signature_hash_check;
