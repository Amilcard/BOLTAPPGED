-- ROLLBACK pour migration 075_drop_duplicate_indexes.sql
-- Recrée les 3 index droppés avec leur définition exacte d'origine.
-- Exécuter dans Supabase SQL Editor si rollback nécessaire.

-- Paire 1 — gd_stay_sessions
CREATE UNIQUE INDEX IF NOT EXISTS uniq_gd_stay_sessions_slug_dates
  ON public.gd_stay_sessions USING btree (stay_slug, start_date, end_date);

-- Paire 2 — gd_stays source_url
CREATE UNIQUE INDEX IF NOT EXISTS gd_stays_source_url_uidx
  ON public.gd_stays USING btree (source_url)
  WHERE (source_url IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS gd_stays_source_url_uniq
  ON public.gd_stays USING btree (source_url)
  WHERE (source_url IS NOT NULL);
