-- Migration 082 : drop policy doublon sur gd_stay_sessions
--
-- Contexte : Supabase performance advisor flag 6 WARN `multiple_permissive_policies`
-- sur `gd_stay_sessions`. Deux policies SELECT identiques (role=public, qual=true) :
--   - "Lecture publique"       (legacy — texte libre FR)
--   - anon_read_sessions       (convention snake_case)
--
-- Les 2 policies ont exactement le même effet : autoriser SELECT à public.
-- Postgres évalue les DEUX à chaque SELECT → surcharge inutile.
--
-- On conserve `anon_read_sessions` (convention snake_case, plus claire pour
-- audit) et on drop `Lecture publique`.
--
-- Impact runtime : nul. Le SELECT reste autorisé à public via l'autre policy.
-- Rollback : ROLLBACK_082.sql recrée la policy "Lecture publique".

DROP POLICY IF EXISTS "Lecture publique" ON public.gd_stay_sessions;
