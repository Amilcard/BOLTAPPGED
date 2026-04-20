-- Migration 084 — Correctifs sécurité (audit post-12-avril)
-- Date : 2026-04-20
-- 1. Vue gd_structure_members : retirer last_jti + last_jti_exp (tokens internes exposés)
-- 2. CHECK length sur *_signature_hash (SHA-256 hex = 64 chars exactement)
-- 3. Commentaire rétention RGPD signed_ip (anonymisation à planifier)

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Vue gd_structure_members — retrait last_jti / last_jti_exp
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW gd_structure_members
WITH (security_invoker = true)
AS
SELECT
  id,
  structure_id,
  code,
  role,
  label,
  active,
  created_at,
  email,
  prenom,
  nom,
  roles,
  expires_at,
  invitation_expires_at,
  activated_at,
  invited_by_email
FROM gd_structure_access_codes
WHERE email IS NOT NULL;

COMMENT ON VIEW gd_structure_members IS
  'Vue des membres de structure avec email (post team-invite). Exclut les codes CDS/direction legacy (email NULL). Exclut password_hash, invitation_token, last_jti, last_jti_exp. security_invoker=true : RLS de la table source est respecté.';

-- ═══════════════════════════════════════════════════════════════════════
-- 2. CHECK constraints — intégrité hash SHA-256 (64 chars hex)
-- ═══════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gd_dossier_enfant_bulletin_signature_hash_check') THEN
    ALTER TABLE public.gd_dossier_enfant
      ADD CONSTRAINT gd_dossier_enfant_bulletin_signature_hash_check
      CHECK (bulletin_signature_hash IS NULL OR char_length(bulletin_signature_hash) = 64);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gd_dossier_enfant_sanitaire_signature_hash_check') THEN
    ALTER TABLE public.gd_dossier_enfant
      ADD CONSTRAINT gd_dossier_enfant_sanitaire_signature_hash_check
      CHECK (sanitaire_signature_hash IS NULL OR char_length(sanitaire_signature_hash) = 64);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gd_dossier_enfant_liaison_signature_hash_check') THEN
    ALTER TABLE public.gd_dossier_enfant
      ADD CONSTRAINT gd_dossier_enfant_liaison_signature_hash_check
      CHECK (liaison_signature_hash IS NULL OR char_length(liaison_signature_hash) = 64);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Rétention RGPD signed_ip — documentation (action cron à planifier)
-- ═══════════════════════════════════════════════════════════════════════
-- Les colonnes *_signed_ip contiennent des IPs = données personnelles.
-- Base légale : intérêt légitime (preuve identification SES eIDAS).
-- Durée de conservation recommandée : 3 ans post-séjour (alignée contrats).
-- TODO : ajouter anonymisation dans cron rgpd-purge (UPDATE SET *_signed_ip = NULL
--        WHERE séjour terminé depuis > 3 ans). Ticket backlog RGPD-signed-ip.

COMMENT ON COLUMN public.gd_dossier_enfant.bulletin_signed_ip
  IS 'IP source signature bulletin (SES eIDAS). Données personnelles — anonymisation après 3 ans post-séjour.';
COMMENT ON COLUMN public.gd_dossier_enfant.sanitaire_signed_ip
  IS 'IP source signature sanitaire (SES eIDAS). Données personnelles — anonymisation après 3 ans post-séjour.';
COMMENT ON COLUMN public.gd_dossier_enfant.liaison_signed_ip
  IS 'IP source signature liaison (SES eIDAS). Données personnelles — anonymisation après 3 ans post-séjour.';

-- Fin migration 084
