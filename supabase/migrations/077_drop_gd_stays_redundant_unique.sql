-- 2026-04-18 : drop contrainte UNIQUE redondante gd_stays_slug_unique
-- PK gd_stays_pkey sur slug suffit (PK = UNIQUE + NOT NULL implicite).
-- 9 FK externes vers gd_stays(slug) : toutes résolvent via PK, aucune référence
-- au nom de contrainte gd_stays_slug_unique (vérifié pg_constraint MCP).
-- Rollback : supabase/migrations/ROLLBACK_077.sql
-- Diagnostic architect vague 3 W6 (1 paire duplicate_index restante).

ALTER TABLE public.gd_stays DROP CONSTRAINT IF EXISTS gd_stays_slug_unique;
