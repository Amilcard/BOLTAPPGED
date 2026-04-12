-- Migration 052 : Table gd_revoked_tokens pour révocation JWT par jti
-- À appliquer dans Supabase SQL Editor

CREATE TABLE IF NOT EXISTS gd_revoked_tokens (
  jti         TEXT        PRIMARY KEY,
  revoked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);

-- Index pour le cleanup cron (supprimer les entrées expirées)
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON gd_revoked_tokens (expires_at);

-- RLS actif — service_role only (verifyAuth utilise getSupabaseAdmin)
ALTER TABLE gd_revoked_tokens ENABLE ROW LEVEL SECURITY;

-- Cleanup automatique des tokens expirés (optionnel — à ajouter au cron rgpd-purge)
-- DELETE FROM gd_revoked_tokens WHERE expires_at < now();
