-- Migration 073 — gd_inscriptions.last_relance_at
-- Ajoute une colonne horodatage du dernier envoi de relance email (dossier incomplet).
-- Utilisée côté app par lib/admin-inscriptions-relance.ts pour un guard idempotence
-- "1 relance max / 30 min" (retourne 409 si trop récent).
--
-- NULL = autorise une première relance. Pas de backfill nécessaire.

ALTER TABLE gd_inscriptions
  ADD COLUMN IF NOT EXISTS last_relance_at TIMESTAMPTZ;

COMMENT ON COLUMN gd_inscriptions.last_relance_at IS
  'Dernier envoi email relance dossier incomplet. Guard idempotence 30 min côté app.';
