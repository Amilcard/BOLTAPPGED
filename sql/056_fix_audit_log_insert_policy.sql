-- Migration 056 : supprimer la policy INSERT permissive sur gd_audit_log
-- Contexte : Supabase Advisor WARN "rls_policy_always_true" — authenticated_insert WITH CHECK(true)
-- Risque : n'importe quel user authentifié pouvait insérer des lignes dans l'audit log (tampering)
-- Fix : DROP policy — les insertions se font exclusivement via service_role (API serveur, bypass RLS)

DROP POLICY IF EXISTS "authenticated_insert" ON public.gd_audit_log;

-- Notes :
-- • La policy "authenticated_read" USING(true) est conservée (lecture admin, faux positif Advisor)
-- • Les tables gd_calls, gd_incidents, gd_medical_events, gd_notes,
--   notification_queue, smart_form_submissions ont RLS + zéro policy = intentionnel (service_role only)
-- • Leaked Password Protection : à activer manuellement dans Auth > Password Security dashboard
