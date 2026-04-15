-- Migration 069 — Purge RGPD gd_notes + gd_calls
-- Décision rétention (2026-04-15) :
--   gd_notes : 12 mois (notes contextuelles enfants, durée courte)
--   gd_calls : 24 mois / 2 ans (appels significatifs, continuité éducative)
--
-- Fonctions appelées par le cron mensuel /api/cron/rgpd-purge

-- ── gd_notes : purge > 12 mois ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION gd_purge_expired_notes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM gd_notes
  WHERE created_at < NOW() - INTERVAL '12 months';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ── gd_calls : purge > 24 mois ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION gd_purge_expired_calls()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM gd_calls
  WHERE created_at < NOW() - INTERVAL '24 months';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Permissions : service_role uniquement (appelé par cron via getSupabaseAdmin)
REVOKE ALL ON FUNCTION gd_purge_expired_notes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION gd_purge_expired_calls() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION gd_purge_expired_notes() TO service_role;
GRANT EXECUTE ON FUNCTION gd_purge_expired_calls() TO service_role;
