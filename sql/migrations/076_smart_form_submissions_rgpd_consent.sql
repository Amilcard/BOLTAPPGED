-- Migration 076 — smart_form_submissions RGPD traceability columns
-- Purpose: add consent_at / ip_hash / user_agent to support price-inquiry RGPD traceability.
-- Safety:
--   - All new columns are NULLABLE, no defaults → existing INSERTs (16 cols) keep working unchanged.
--   - Non-destructive: no column rename, no type change, no constraint tightening.
--   - RLS already correctly locked (deny_all_anon + deny_all_auth). Writes go through service_role.
--   - Table volume = 0 rows → zero risk of long rewrite / lock contention.
-- Downstream:
--   - If TypeScript types are regenerated via Supabase CLI, the new columns will appear as
--     `string | null` / `Date | null`. Existing client code ignoring them keeps compiling.
--   - No trigger / view / RLS policy references these columns → nothing else to update.

BEGIN;

ALTER TABLE public.smart_form_submissions
  ADD COLUMN IF NOT EXISTS consent_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ip_hash     TEXT,
  ADD COLUMN IF NOT EXISTS user_agent  TEXT;

COMMENT ON COLUMN public.smart_form_submissions.consent_at IS
  'RGPD: horodatage du consentement explicite donné par l''utilisateur lors de la soumission du formulaire price-inquiry.';

COMMENT ON COLUMN public.smart_form_submissions.ip_hash IS
  'RGPD: hash (SHA-256 + salt serveur) de l''IP source, conservé pour traçabilité anti-abus sans stocker l''IP en clair.';

COMMENT ON COLUMN public.smart_form_submissions.user_agent IS
  'RGPD: user-agent brut du navigateur au moment du consentement (preuve contextuelle en cas de litige).';

-- Note: pas d'index créé.
-- Justification: table à 0 rows, aucun filtre prévu sur ces colonnes côté lecture
-- (accès service_role + CRM sync sur submitted_at / alert_priority). À rajouter si un usage
-- analytique apparaît.

COMMIT;
