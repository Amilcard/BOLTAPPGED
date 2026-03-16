-- ============================================================
-- Migration : Professionnalisation parcours pro GED_APP
-- Phase 1 + Phase 2 — À exécuter dans Supabase → SQL Editor
-- ============================================================

-- ============================================================
-- PHASE 1 : colonnes inscription pro + suivi
-- ============================================================

-- 1a. Colonne organisation dédiée (extraction du champ remarques)
ALTER TABLE gd_inscriptions
  ADD COLUMN IF NOT EXISTS organisation TEXT;

-- 1b. Référence dossier unique (format DOS-YYYYMMDD-XXXXXXXX)
ALTER TABLE gd_inscriptions
  ADD COLUMN IF NOT EXISTS dossier_ref TEXT UNIQUE;

-- 1c. Token de suivi pro (magic link, pas de mot de passe)
ALTER TABLE gd_inscriptions
  ADD COLUMN IF NOT EXISTS suivi_token UUID DEFAULT gen_random_uuid();

-- 1d. Timestamp updated_at avec trigger auto
ALTER TABLE gd_inscriptions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================
-- PHASE 2 : colonnes suivi séjour + admin
-- ============================================================

-- 2a. Statut documents (en_attente | partiellement_recus | complets)
ALTER TABLE gd_inscriptions
  ADD COLUMN IF NOT EXISTS documents_status TEXT DEFAULT 'en_attente';

-- 2b. Besoins spécifiques pris en compte (toggle admin)
ALTER TABLE gd_inscriptions
  ADD COLUMN IF NOT EXISTS besoins_pris_en_compte BOOLEAN DEFAULT false;

-- 2c. Équipe informée (toggle admin)
ALTER TABLE gd_inscriptions
  ADD COLUMN IF NOT EXISTS equipe_informee BOOLEAN DEFAULT false;

-- 2d. Note pro visible côté suivi
ALTER TABLE gd_inscriptions
  ADD COLUMN IF NOT EXISTS note_pro TEXT;

-- ============================================================
-- SÉQUENCE pour numérotation dossier_ref
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS gd_dossier_ref_seq START 1;

-- ============================================================
-- TRIGGER updated_at automatique
-- ============================================================
CREATE OR REPLACE FUNCTION set_inscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inscriptions_updated_at ON gd_inscriptions;

CREATE TRIGGER trg_inscriptions_updated_at
  BEFORE UPDATE ON gd_inscriptions
  FOR EACH ROW
  EXECUTE FUNCTION set_inscriptions_updated_at();

-- ============================================================
-- BACKFILL : générer dossier_ref + suivi_token pour inscriptions existantes
-- ============================================================

-- Backfill suivi_token (celles qui n'en ont pas encore)
UPDATE gd_inscriptions
SET suivi_token = gen_random_uuid()
WHERE suivi_token IS NULL;

-- Backfill dossier_ref (celles qui n'en ont pas encore)
-- Format : DOS-YYYYMMDD-NNNNNNNN (date de création + séquence 8 chiffres)
UPDATE gd_inscriptions
SET dossier_ref = 'DOS-' || TO_CHAR(created_at, 'YYYYMMDD') || '-' || LPAD(nextval('gd_dossier_ref_seq')::TEXT, 8, '0')
WHERE dossier_ref IS NULL;

-- Backfill organisation depuis remarques (extraction [ORGANISATION]: ...)
UPDATE gd_inscriptions
SET organisation = TRIM(SUBSTRING(remarques FROM '\[ORGANISATION\]:\s*(.+?)(?:\n|$)'))
WHERE organisation IS NULL
  AND remarques IS NOT NULL
  AND remarques LIKE '%[ORGANISATION]%';

-- ============================================================
-- VÉRIFICATION
-- ============================================================
SELECT id, dossier_ref, suivi_token, organisation, documents_status, created_at
FROM gd_inscriptions
ORDER BY created_at DESC
LIMIT 10;
