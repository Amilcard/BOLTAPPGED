-- Migration 032 : Activer RLS sur les 5 tables sensibles
-- gd_inscriptions et gd_dossier_enfant : service_role only (pas de policy anon)
-- gd_stays, gd_stay_sessions, gd_session_prices : anon SELECT autorisé (catalogue public)
-- À exécuter dans Supabase → SQL Editor

-- 1. gd_inscriptions — PII mineurs, paiements → service_role uniquement
ALTER TABLE gd_inscriptions ENABLE ROW LEVEL SECURITY;
-- Pas de policy anon/authenticated = deny-by-default (service_role bypasse RLS)

-- 2. gd_dossier_enfant — documents médicaux → service_role uniquement
ALTER TABLE gd_dossier_enfant ENABLE ROW LEVEL SECURITY;

-- 3. gd_stays — catalogue public, seuls les séjours publiés visibles en anon
ALTER TABLE gd_stays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_published_stays" ON gd_stays
  FOR SELECT USING (published = true);

-- 4. gd_stay_sessions — sessions publiques
ALTER TABLE gd_stay_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_sessions" ON gd_stay_sessions
  FOR SELECT USING (true);

-- 5. gd_session_prices — tarifs lus par supabaseGed (anon key)
ALTER TABLE gd_session_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_prices" ON gd_session_prices
  FOR SELECT USING (true);

-- Vérification
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('gd_inscriptions', 'gd_dossier_enfant', 'gd_stays', 'gd_stay_sessions', 'gd_session_prices');
