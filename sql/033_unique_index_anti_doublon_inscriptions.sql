-- Migration 033 : Unique index anti-doublon inscriptions (DB-level)
-- Protège contre les inscriptions simultanées identiques (race condition TOCTOU)
-- À exécuter dans Supabase → SQL Editor

CREATE UNIQUE INDEX IF NOT EXISTS idx_inscriptions_no_doublon
  ON gd_inscriptions (referent_email, sejour_slug, session_date, jeune_date_naissance)
  WHERE status != 'annulee' AND deleted_at IS NULL;

-- Vérification
SELECT indexname, indexdef FROM pg_indexes WHERE indexname = 'idx_inscriptions_no_doublon';
