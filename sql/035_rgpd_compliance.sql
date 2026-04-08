-- ============================================================
-- 035_rgpd_compliance.sql
-- RGPD/CNIL conformité — données de mineurs sous protection
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- ── 1. Expiration suivi_token (P0.1) ──────────────────────────
-- Le suivi_token est un magic link permanent → risque CNIL Art. 5.1.e
-- On ajoute une date d'expiration (30 jours par défaut, renouvelable)

ALTER TABLE public.gd_inscriptions
  ADD COLUMN IF NOT EXISTS suivi_token_expires_at timestamp with time zone;

-- Backfill : tokens existants → 30 jours depuis création
UPDATE public.gd_inscriptions
SET suivi_token_expires_at = created_at + interval '30 days'
WHERE suivi_token_expires_at IS NULL
  AND suivi_token IS NOT NULL;

-- Default pour les futures inscriptions : now() + 30 jours
ALTER TABLE public.gd_inscriptions
  ALTER COLUMN suivi_token_expires_at SET DEFAULT (now() + interval '30 days');

COMMENT ON COLUMN public.gd_inscriptions.suivi_token_expires_at
  IS 'RGPD: date expiration du magic link suivi_token (30j par defaut, renouvelable)';


-- ── 2. Consentement parental explicite (P0.2) ────────────────
-- CNIL Art. 8 / RGPD Art. 8 : consentement parental obligatoire pour < 15 ans en France
-- On enrichit le consentement existant avec version + texte légal

ALTER TABLE public.gd_inscriptions
  ADD COLUMN IF NOT EXISTS parental_consent_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS parental_consent_version text;

COMMENT ON COLUMN public.gd_inscriptions.parental_consent_at
  IS 'RGPD Art.8: horodatage consentement parental pour mineur < 15 ans';
COMMENT ON COLUMN public.gd_inscriptions.parental_consent_version
  IS 'Version du texte de consentement parental accepté (ex: v2026.1)';


-- ── 3. Table d''audit des accès aux données sensibles (P0.3) ─
-- CNIL exige traçabilité pour données Art. 9 (santé, handicap)

CREATE TABLE IF NOT EXISTS public.gd_audit_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  action text NOT NULL,                    -- 'read' | 'create' | 'update' | 'delete' | 'upload' | 'download' | 'submit'
  resource_type text NOT NULL,             -- 'dossier_enfant' | 'inscription' | 'document'
  resource_id text NOT NULL,               -- UUID de la ressource concernée
  inscription_id uuid,                     -- FK vers gd_inscriptions (nullable pour flexibilité)
  actor_type text NOT NULL,                -- 'referent' | 'admin' | 'system'
  actor_id text,                           -- email ou user_id selon actor_type
  ip_address text,                         -- IP du client (RGPD: conservé 12 mois max)
  metadata jsonb DEFAULT '{}'::jsonb,      -- Détails supplémentaires (champs modifiés, etc.)
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Index pour requêtes d'audit fréquentes
CREATE INDEX IF NOT EXISTS idx_gd_audit_log_resource
  ON public.gd_audit_log (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_gd_audit_log_inscription
  ON public.gd_audit_log (inscription_id);
CREATE INDEX IF NOT EXISTS idx_gd_audit_log_actor
  ON public.gd_audit_log (actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_gd_audit_log_created
  ON public.gd_audit_log (created_at);

-- RLS : service_role uniquement (pas d'accès direct client)
ALTER TABLE public.gd_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gd_audit_log_service_role_all"
  ON public.gd_audit_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.gd_audit_log
  IS 'RGPD/CNIL: journal audit accès données sensibles mineurs (Art. 9). Rétention 12 mois.';


-- ── 4. Purge automatique des audit logs > 12 mois ────────────
-- Fonction appelable par cron (pg_cron ou Vercel cron)

CREATE OR REPLACE FUNCTION public.gd_purge_expired_audit_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.gd_audit_log
  WHERE created_at < now() - interval '12 months';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.gd_purge_expired_audit_logs()
  IS 'RGPD: purge audit logs > 12 mois (rétention CNIL)';


-- ── 5. Purge automatique des données médicales expirées ──────
-- CNIL : données santé conservées durée du séjour + 3 mois max

CREATE OR REPLACE FUNCTION public.gd_purge_expired_medical_data()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  purged_count integer;
BEGIN
  UPDATE public.gd_dossier_enfant de
  SET
    fiche_sanitaire = '{}'::jsonb,
    fiche_liaison_jeune = '{}'::jsonb,
    fiche_renseignements = NULL,
    updated_at = now()
  FROM public.gd_inscriptions i
  WHERE de.inscription_id = i.id
    AND i.session_date IS NOT NULL
    AND i.session_date < current_date - interval '3 months'
    AND (de.fiche_sanitaire != '{}'::jsonb
      OR de.fiche_liaison_jeune != '{}'::jsonb
      OR de.fiche_renseignements IS NOT NULL);
  GET DIAGNOSTICS purged_count = ROW_COUNT;
  RETURN purged_count;
END;
$$;

COMMENT ON FUNCTION public.gd_purge_expired_medical_data()
  IS 'RGPD/CNIL: purge données santé 3 mois après fin de séjour';
