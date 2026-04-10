-- 040_purge_login_attempts_audit_logs.sql
-- RGPD — Politique de rétention des données contenant des adresses IP
--
-- gd_login_attempts : IPs stockées pour rate limiting → purge après 24h
-- gd_audit_log : IPs + métadonnées d'accès → purge après 3 ans (reco CNIL)

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Purge gd_login_attempts (24h)
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION purge_old_login_attempts()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM gd_login_attempts WHERE window_start < NOW() - INTERVAL '24 hours';
$$;

-- Cron : toutes les heures
-- ⚠️ Nécessite pg_cron activé sur le projet Supabase (Pro plan)
-- Exécuter manuellement dans le SQL Editor si pg_cron n'est pas dispo :
-- SELECT cron.schedule('purge-login-attempts', '0 * * * *', 'SELECT purge_old_login_attempts()');

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Purge gd_audit_log (3 ans — recommandation CNIL)
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION purge_old_audit_logs()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM gd_audit_log WHERE created_at < NOW() - INTERVAL '3 years';
$$;

-- Cron : 1er du mois à 4h
-- SELECT cron.schedule('purge-audit-logs', '0 4 1 * *', 'SELECT purge_old_audit_logs()');

-- ═══════════════════════════════════════════════════════════════════════
-- NOTE : Les commandes cron.schedule sont commentées car pg_cron peut
-- ne pas être activé. Options :
-- A) Activer pg_cron dans Supabase Dashboard → Database → Extensions
-- B) Utiliser le cron Vercel existant (/api/cron/rgpd-purge) pour appeler
--    ces fonctions via RPC
-- ═══════════════════════════════════════════════════════════════════════
