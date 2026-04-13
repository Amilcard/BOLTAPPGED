-- Migration 059 : policies deny_all cosmétiques
-- Supprime les alertes "RLS Enabled No Policy" du Supabase Advisor.
-- Aucun impact fonctionnel — service_role bypass RLS, ces tables n'ont pas d'accès client.
-- Pattern documenté dans CLAUDE.md règle 11.

CREATE POLICY deny_all_anon ON public.gd_calls FOR ALL TO anon USING (false);
CREATE POLICY deny_all_auth ON public.gd_calls FOR ALL TO authenticated USING (false);

CREATE POLICY deny_all_anon ON public.gd_incidents FOR ALL TO anon USING (false);
CREATE POLICY deny_all_auth ON public.gd_incidents FOR ALL TO authenticated USING (false);

CREATE POLICY deny_all_anon ON public.gd_medical_events FOR ALL TO anon USING (false);
CREATE POLICY deny_all_auth ON public.gd_medical_events FOR ALL TO authenticated USING (false);

CREATE POLICY deny_all_anon ON public.gd_notes FOR ALL TO anon USING (false);
CREATE POLICY deny_all_auth ON public.gd_notes FOR ALL TO authenticated USING (false);

CREATE POLICY deny_all_anon ON public.notification_queue FOR ALL TO anon USING (false);
CREATE POLICY deny_all_auth ON public.notification_queue FOR ALL TO authenticated USING (false);

CREATE POLICY deny_all_anon ON public.smart_form_submissions FOR ALL TO anon USING (false);
CREATE POLICY deny_all_auth ON public.smart_form_submissions FOR ALL TO authenticated USING (false);
