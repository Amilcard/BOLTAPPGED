-- ROLLBACK Migration 085 — gd_outbound_emails
-- À exécuter UNIQUEMENT si la migration 085 a été appliquée et pose problème.
-- ATTENTION : ce rollback supprime le registre email définitivement.
-- Si des lignes existent, exporter avant drop (RGPD preuve d'envoi).

-- 1. Export préalable (optionnel) :
-- COPY public.gd_outbound_emails TO '/tmp/gd_outbound_emails_backup.csv' WITH CSV HEADER;

-- 2. Drop indexes
DROP INDEX IF EXISTS public.idx_outbound_reconciliation;
DROP INDEX IF EXISTS public.idx_outbound_template_sent;
DROP INDEX IF EXISTS public.idx_outbound_recipient_sent;

-- 3. Drop table (+ RLS + contrainte UNIQUE)
DROP TABLE IF EXISTS public.gd_outbound_emails;
