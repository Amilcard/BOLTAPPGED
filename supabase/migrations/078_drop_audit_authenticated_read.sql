-- Migration 078 : DROP policy gd_audit_log.authenticated_read
--
-- Contexte : policy résiduelle autorisant SELECT sur gd_audit_log pour tout
-- utilisateur Supabase `authenticated` (role PostgREST). L'app utilise un JWT
-- custom via service_role donc aucun utilisateur `authenticated` légitime
-- ne devrait exister — mais la policy laisse une surface d'attaque si un
-- anon-key est jamais compromise OU si un SDK client se connecte par erreur.
--
-- Impact : aucun (audit log = service_role only dans l'app).
-- Rollback : ROLLBACK_078.sql restaure la policy à l'identique.

DROP POLICY IF EXISTS "authenticated_read" ON public.gd_audit_log;
