-- Migration 083 — Métadonnées de signature électronique simple (SES eIDAS)
-- Date : 2026-04-19
-- Motif : l'éducateur ASE peut signer les blocs Bulletin / Sanitaire / Liaison
-- en ligne (canvas + consentement), sans impression. Pour preuve juridique, on
-- persiste horodatage + IP + qualité signataire + hash PNG signature + version
-- du texte de consentement.
--
-- Conformité : RGPD Art. 9 (données Art. 9 déjà tracées via auditLog). Cette
-- migration complète le dispositif avec traçabilité cryptographique minimale
-- suffisante pour SES eIDAS (signature électronique simple).
--
-- Colonnes additives uniquement. Aucune suppression, backfill NULL acceptable.
-- Zéro impact sur les dossiers existants (NULL signifie "pas encore signé").

-- ═══════════════════════════════════════════════════════════════════════
-- 1. BULLETIN — métadonnées signature
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.gd_dossier_enfant
  ADD COLUMN IF NOT EXISTS bulletin_signed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS bulletin_signed_ip text,
  ADD COLUMN IF NOT EXISTS bulletin_signer_qualite text,
  ADD COLUMN IF NOT EXISTS bulletin_signature_hash text;

COMMENT ON COLUMN public.gd_dossier_enfant.bulletin_signed_at
  IS 'Horodatage de la signature du bulletin (SES eIDAS). NULL = non signé.';
COMMENT ON COLUMN public.gd_dossier_enfant.bulletin_signed_ip
  IS 'Adresse IP source au moment de la signature (preuve identification).';
COMMENT ON COLUMN public.gd_dossier_enfant.bulletin_signer_qualite
  IS 'Qualité du signataire : responsable_legal | delegataire_ase | tuteur.';
COMMENT ON COLUMN public.gd_dossier_enfant.bulletin_signature_hash
  IS 'Hash SHA-256 du PNG de signature canvas (preuve d intégrité).';

-- ═══════════════════════════════════════════════════════════════════════
-- 2. FICHE SANITAIRE — métadonnées signature
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.gd_dossier_enfant
  ADD COLUMN IF NOT EXISTS sanitaire_signed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS sanitaire_signed_ip text,
  ADD COLUMN IF NOT EXISTS sanitaire_signer_qualite text,
  ADD COLUMN IF NOT EXISTS sanitaire_signature_hash text;

COMMENT ON COLUMN public.gd_dossier_enfant.sanitaire_signed_at
  IS 'Horodatage de la signature de la fiche sanitaire (SES eIDAS). NULL = non signé.';
COMMENT ON COLUMN public.gd_dossier_enfant.sanitaire_signed_ip
  IS 'Adresse IP source au moment de la signature (preuve identification).';
COMMENT ON COLUMN public.gd_dossier_enfant.sanitaire_signer_qualite
  IS 'Qualité du signataire : responsable_legal | delegataire_ase | tuteur.';
COMMENT ON COLUMN public.gd_dossier_enfant.sanitaire_signature_hash
  IS 'Hash SHA-256 du PNG de signature canvas (preuve d intégrité).';

-- ═══════════════════════════════════════════════════════════════════════
-- 3. FICHE DE LIAISON — métadonnées signature
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.gd_dossier_enfant
  ADD COLUMN IF NOT EXISTS liaison_signed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS liaison_signed_ip text,
  ADD COLUMN IF NOT EXISTS liaison_signer_qualite text,
  ADD COLUMN IF NOT EXISTS liaison_signature_hash text;

COMMENT ON COLUMN public.gd_dossier_enfant.liaison_signed_at
  IS 'Horodatage de la signature de la fiche de liaison (SES eIDAS). NULL = non signé.';
COMMENT ON COLUMN public.gd_dossier_enfant.liaison_signed_ip
  IS 'Adresse IP source au moment de la signature (preuve identification).';
COMMENT ON COLUMN public.gd_dossier_enfant.liaison_signer_qualite
  IS 'Qualité du signataire : responsable_legal | delegataire_ase | tuteur.';
COMMENT ON COLUMN public.gd_dossier_enfant.liaison_signature_hash
  IS 'Hash SHA-256 du PNG de signature canvas (preuve d intégrité).';

-- ═══════════════════════════════════════════════════════════════════════
-- 4. VERSION DU TEXTE DE CONSENTEMENT (partagé les 3 blocs)
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.gd_dossier_enfant
  ADD COLUMN IF NOT EXISTS consent_text_version text;

COMMENT ON COLUMN public.gd_dossier_enfant.consent_text_version
  IS 'Version du texte de consentement légal signé (ex: v2026-04). Permet de retrouver l exacte formulation acceptée pour audit.';

-- ═══════════════════════════════════════════════════════════════════════
-- 5. CHECK CONSTRAINTS — qualité signataire dans enum applicatif
-- ═══════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gd_dossier_enfant_bulletin_signer_qualite_check') THEN
    ALTER TABLE public.gd_dossier_enfant
      ADD CONSTRAINT gd_dossier_enfant_bulletin_signer_qualite_check
      CHECK (bulletin_signer_qualite IS NULL OR bulletin_signer_qualite IN ('responsable_legal', 'delegataire_ase', 'tuteur'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gd_dossier_enfant_sanitaire_signer_qualite_check') THEN
    ALTER TABLE public.gd_dossier_enfant
      ADD CONSTRAINT gd_dossier_enfant_sanitaire_signer_qualite_check
      CHECK (sanitaire_signer_qualite IS NULL OR sanitaire_signer_qualite IN ('responsable_legal', 'delegataire_ase', 'tuteur'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gd_dossier_enfant_liaison_signer_qualite_check') THEN
    ALTER TABLE public.gd_dossier_enfant
      ADD CONSTRAINT gd_dossier_enfant_liaison_signer_qualite_check
      CHECK (liaison_signer_qualite IS NULL OR liaison_signer_qualite IN ('responsable_legal', 'delegataire_ase', 'tuteur'));
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 6. INDEX sur signed_at (pour reporting GED — dossiers signés récemment)
-- ═══════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_gd_dossier_enfant_bulletin_signed_at
  ON public.gd_dossier_enfant (bulletin_signed_at)
  WHERE bulletin_signed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gd_dossier_enfant_sanitaire_signed_at
  ON public.gd_dossier_enfant (sanitaire_signed_at)
  WHERE sanitaire_signed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gd_dossier_enfant_liaison_signed_at
  ON public.gd_dossier_enfant (liaison_signed_at)
  WHERE liaison_signed_at IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- 7. VÉRIFICATION post-migration
-- ═══════════════════════════════════════════════════════════════════════

-- À exécuter manuellement après migration pour vérifier :
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'gd_dossier_enfant'
--     AND column_name LIKE '%signed%' OR column_name LIKE '%signer%' OR column_name LIKE '%consent%';

-- Fin migration 083
