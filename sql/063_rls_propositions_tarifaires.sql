-- 063: Activer RLS sur gd_propositions_tarifaires (PII enfants + données financières)
-- Pattern: RLS activé + deny-all = accès client bloqué, service_role bypass RLS
-- Ref: CLAUDE.md règle 11

ALTER TABLE gd_propositions_tarifaires ENABLE ROW LEVEL SECURITY;

-- Deny-all cosmétiques pour supprimer les alertes Supabase Advisor
CREATE POLICY deny_all_anon ON public.gd_propositions_tarifaires
  FOR ALL TO anon USING (false);

CREATE POLICY deny_all_auth ON public.gd_propositions_tarifaires
  FOR ALL TO authenticated USING (false);
