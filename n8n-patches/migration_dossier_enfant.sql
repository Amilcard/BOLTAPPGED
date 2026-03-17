-- ============================================================
-- Migration : gd_dossier_enfant
-- Stockage structuré des dossiers enfants (formulaires officiels)
-- Chaque inscription = 1 dossier enfant potentiel
-- Les données de chaque document sont en JSONB (flexible, évolutif)
-- ============================================================

-- Table principale : dossier enfant lié à une inscription
CREATE TABLE IF NOT EXISTS gd_dossier_enfant (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inscription_id UUID NOT NULL REFERENCES gd_inscriptions(id) ON DELETE CASCADE,

  -- Bloc 1 : Complément bulletin d'inscription
  -- (adresses départ/retour, contact urgence, financement, autorisation)
  bulletin_complement JSONB DEFAULT '{}'::jsonb,

  -- Bloc 2 : Fiche sanitaire de liaison (le gros morceau)
  -- (responsables légaux, délégations, vaccins, médical, allergies, recommandations)
  fiche_sanitaire JSONB DEFAULT '{}'::jsonb,

  -- Bloc 3 : Fiche de liaison page 1 — partie jeune + éducateur
  -- (établissement, choix séjour, engagement, signature)
  fiche_liaison_jeune JSONB DEFAULT '{}'::jsonb,

  -- Bloc 4 : Fiche de renseignements (séjours handicap uniquement)
  -- (déficience, autonomie, comportement, mode de vie)
  fiche_renseignements JSONB DEFAULT NULL,

  -- Documents joints (liste des fichiers uploadés)
  -- Format: [{ "type": "vaccins|ordonnance|pass_nautique|certificat_plongee|autre", "filename": "...", "storage_path": "...", "uploaded_at": "..." }]
  documents_joints JSONB DEFAULT '[]'::jsonb,

  -- Suivi de complétion
  bulletin_completed BOOLEAN DEFAULT false,
  sanitaire_completed BOOLEAN DEFAULT false,
  liaison_completed BOOLEAN DEFAULT false,
  renseignements_completed BOOLEAN DEFAULT false,
  -- NULL = non requis pour ce séjour
  renseignements_required BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour lookup rapide par inscription
CREATE UNIQUE INDEX IF NOT EXISTS idx_dossier_enfant_inscription
  ON gd_dossier_enfant(inscription_id);

-- Trigger updated_at automatique
CREATE OR REPLACE FUNCTION update_dossier_enfant_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dossier_enfant_updated_at ON gd_dossier_enfant;
CREATE TRIGGER trg_dossier_enfant_updated_at
  BEFORE UPDATE ON gd_dossier_enfant
  FOR EACH ROW EXECUTE FUNCTION update_dossier_enfant_updated_at();

-- Colonne optionnelle sur gd_stays : documents requis par séjour
-- Format: ["bulletin", "sanitaire", "liaison", "renseignements", "pass_nautique", "certificat_plongee", "certificat_parapente"]
ALTER TABLE gd_stays ADD COLUMN IF NOT EXISTS documents_requis JSONB DEFAULT '["bulletin", "sanitaire", "liaison"]'::jsonb;

-- ============================================================
-- Vérification
-- ============================================================
SELECT
  column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'gd_dossier_enfant'
ORDER BY ordinal_position;
