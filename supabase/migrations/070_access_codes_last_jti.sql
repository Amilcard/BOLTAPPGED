ALTER TABLE gd_structure_access_codes
  ADD COLUMN IF NOT EXISTS last_jti TEXT,
  ADD COLUMN IF NOT EXISTS last_jti_exp TIMESTAMPTZ;

COMMENT ON COLUMN gd_structure_access_codes.last_jti IS
  'Dernier jti JWT émis lors du login structure-login. Utilisé par /revoke pour insertion dans gd_revoked_tokens.';

COMMENT ON COLUMN gd_structure_access_codes.last_jti_exp IS
  'Expiration ISO du dernier JWT émis. Copié tel quel dans gd_revoked_tokens.expires_at lors du revoke.';
