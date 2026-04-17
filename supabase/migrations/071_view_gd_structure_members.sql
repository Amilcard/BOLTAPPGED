-- 2026-04-17 — Vue filtrée gd_structure_members
-- Expose uniquement les lignes gd_structure_access_codes représentant de vrais membres invités
-- (email IS NOT NULL). Exclut les codes CDS/direction legacy (email NULL).
-- Reads à migrer ultérieurement (correctif #2 plan architecte).

CREATE VIEW gd_structure_members
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

COMMENT ON VIEW gd_structure_members IS
  'Vue des membres de structure avec email (post team-invite). Exclut les codes CDS/direction legacy (email NULL). Exclut password_hash et invitation_token pour minimisation. security_invoker=true : RLS de la table source est respecté.';
