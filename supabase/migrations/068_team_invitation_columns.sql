ALTER TABLE gd_structure_access_codes
  ADD COLUMN IF NOT EXISTS invitation_token TEXT,
  ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS invited_by_email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sac_invitation_token
  ON gd_structure_access_codes(invitation_token)
  WHERE invitation_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sac_email_structure
  ON gd_structure_access_codes(structure_id, email)
  WHERE email IS NOT NULL;
