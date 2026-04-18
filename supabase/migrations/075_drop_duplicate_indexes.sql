-- 2026-04-17 : DROP indexes duplicates sur gd_stays + gd_stay_sessions
-- Advisor Supabase type=performance category=duplicate_index
-- Diagnostic : rapport audit vague 3 W6.
-- Rollback : supabase/migrations/ROLLBACK_075.sql
--
-- Décision par paire :
--
-- Paire 1 — gd_stay_sessions (stay_slug, start_date, end_date)
--   GARDER : gd_stay_sessions_pk         → backe PRIMARY KEY (contype=p)
--   DROP   : uniq_gd_stay_sessions_slug_dates → index libre, idx_scan=1824 (dupliquat exact)
--
-- Paire 2 — gd_stays source_url (triplet)
--   GARDER : uniq_gd_stays_source_url    → seul utilisé (idx_scan=91)
--   DROP   : gd_stays_source_url_uidx    → idx_scan=0, pas de contrainte backée
--   DROP   : gd_stays_source_url_uniq    → idx_scan=0, pas de contrainte backée
--
-- Non traité : {gd_stays_pkey, gd_stays_slug_unique}
--   Les deux backent des contraintes système (PK + UNIQUE).
--   DROP impossible sans DROP CONSTRAINT — hors scope, remonté en backlog.

DROP INDEX IF EXISTS public.uniq_gd_stay_sessions_slug_dates;
DROP INDEX IF EXISTS public.gd_stays_source_url_uidx;
DROP INDEX IF EXISTS public.gd_stays_source_url_uniq;
