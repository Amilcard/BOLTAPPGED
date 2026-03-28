-- 025_login_rate_limiting.sql
-- Table pour le rate limiting persistant du login admin.
-- Remplace le Map en mémoire (non fiable sur Vercel multi-instance).
--
-- Utilisée par : app/api/auth/login/route.ts
-- Nettoyage automatique via pg_cron ou manuellement :
--   DELETE FROM gd_login_attempts WHERE window_start < NOW() - INTERVAL '1 hour';

CREATE TABLE IF NOT EXISTS gd_login_attempts (
  ip            TEXT PRIMARY KEY,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  window_start  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index sur window_start pour le nettoyage périodique
CREATE INDEX IF NOT EXISTS idx_login_attempts_window
  ON gd_login_attempts (window_start);

-- RLS : service_role uniquement (jamais exposé côté client)
ALTER TABLE gd_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON gd_login_attempts
  FOR ALL USING (auth.role() = 'service_role');

-- Commentaire
COMMENT ON TABLE gd_login_attempts IS
  'Rate limiting du login admin — 5 tentatives / 15 min par IP. Nettoyable périodiquement.';
