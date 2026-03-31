-- Migration 032 : 2FA TOTP pour les admins GED
-- Stocke le secret TOTP par user_id Supabase Auth
-- enabled = false tant que l'admin n'a pas validé le premier code

CREATE TABLE IF NOT EXISTS gd_admin_2fa (
  user_id UUID PRIMARY KEY,
  totp_secret TEXT NOT NULL,
  enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS : service_role uniquement (jamais exposé au client)
ALTER TABLE gd_admin_2fa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON gd_admin_2fa
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Vérification
SELECT table_name FROM information_schema.tables
WHERE table_name = 'gd_admin_2fa';
