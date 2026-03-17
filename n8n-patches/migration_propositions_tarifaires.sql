-- ============================================================
-- Migration : gd_propositions_tarifaires
-- Table pour stocker les propositions tarifaires envoyées aux structures
-- Flux : GED crée la proposition → structure signe "BON POUR ACCORD" → séjour réservé
-- ============================================================

CREATE TABLE IF NOT EXISTS gd_propositions_tarifaires (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Infos structure sociale
  structure_nom TEXT NOT NULL,                    -- ex: "MECS La Clairière"
  structure_adresse TEXT NOT NULL,                -- ex: "72 rue de l'Impératrice Eugénie"
  structure_cp TEXT NOT NULL,                     -- ex: "60350"
  structure_ville TEXT NOT NULL,                  -- ex: "Pierrefonds"

  -- Infos enfant
  enfant_nom TEXT NOT NULL,                       -- ex: "LEBESGUE"
  enfant_prenom TEXT NOT NULL,                    -- ex: "Ilana"

  -- Infos séjour (référence vers gd_stays)
  sejour_slug TEXT NOT NULL REFERENCES gd_stays(slug),
  sejour_titre TEXT NOT NULL,                     -- copie du titre au moment de la création
  sejour_activites TEXT,                          -- description activités
  session_start DATE NOT NULL,
  session_end DATE NOT NULL,
  agrement_dscs TEXT DEFAULT '069ORG0667',

  -- Tarification
  ville_depart TEXT NOT NULL,                     -- ville de départ du transport
  prix_sejour DECIMAL(10,2) NOT NULL DEFAULT 0,   -- montant séjour brut
  prix_transport DECIMAL(10,2) NOT NULL DEFAULT 0, -- transport
  encadrement BOOLEAN NOT NULL DEFAULT false,      -- animateur dédié oui/non
  prix_encadrement DECIMAL(10,2) NOT NULL DEFAULT 0, -- 630€/semaine si encadrement
  adhesion TEXT DEFAULT 'Comprise',
  options TEXT DEFAULT 'Tranquillité : recherche individualisée, veille éducative, informations mise en lien, bilans.',
  prix_total DECIMAL(10,2) NOT NULL DEFAULT 0,     -- total calculé

  -- Statut du workflow
  status TEXT NOT NULL DEFAULT 'brouillon'
    CHECK (status IN ('brouillon', 'envoyee', 'validee', 'refusee', 'annulee')),
  -- brouillon : en préparation
  -- envoyee : envoyée à la structure
  -- validee : BON POUR ACCORD reçu → séjour réservé
  -- refusee : structure a refusé
  -- annulee : annulée par GED

  -- Lien vers l'inscription créée après validation
  inscription_id UUID REFERENCES gd_inscriptions(id) ON DELETE SET NULL,

  -- PDF stocké dans Supabase Storage
  pdf_storage_path TEXT,

  -- Métadonnées
  created_by TEXT,                                -- email admin GED qui a créé
  validated_at TIMESTAMPTZ,                       -- date de validation BON POUR ACCORD
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_propositions_status ON gd_propositions_tarifaires(status);
CREATE INDEX IF NOT EXISTS idx_propositions_structure ON gd_propositions_tarifaires(structure_nom);
CREATE INDEX IF NOT EXISTS idx_propositions_sejour ON gd_propositions_tarifaires(sejour_slug);
CREATE INDEX IF NOT EXISTS idx_propositions_enfant ON gd_propositions_tarifaires(enfant_nom, enfant_prenom);

-- RLS : service_role uniquement (admin backend)
ALTER TABLE gd_propositions_tarifaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on propositions"
  ON gd_propositions_tarifaires
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_propositions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_propositions_updated_at
  BEFORE UPDATE ON gd_propositions_tarifaires
  FOR EACH ROW
  EXECUTE FUNCTION update_propositions_updated_at();
