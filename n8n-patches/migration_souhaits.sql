-- Migration : table gd_souhaits
-- Parcours souhait kids côté serveur
-- 2026-03-19

CREATE TABLE IF NOT EXISTS gd_souhaits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Identification du kid (token anonyme stocké en localStorage)
  kid_token uuid NOT NULL,
  kid_prenom varchar(50) NOT NULL,

  -- Séjour
  sejour_slug varchar(200) NOT NULL,
  sejour_titre varchar(500),
  sejour_url varchar(1000),

  -- Motivation
  motivation text NOT NULL,

  -- Éducateur destinataire
  educateur_email varchar(200) NOT NULL,
  educateur_prenom varchar(100),

  -- Suivi
  statut varchar(30) NOT NULL DEFAULT 'emis'
    CHECK (statut IN ('emis', 'vu', 'en_discussion', 'valide', 'refuse')),
  commentaire text,

  -- Magic link pour la réponse éducateur
  educateur_token uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index pour récupérer les souhaits d'un kid
CREATE INDEX IF NOT EXISTS idx_gd_souhaits_kid_token ON gd_souhaits (kid_token);

-- Index pour la réponse éducateur
CREATE INDEX IF NOT EXISTS idx_gd_souhaits_educateur_token ON gd_souhaits (educateur_token);

-- Index pour requêtes par email éducateur
CREATE INDEX IF NOT EXISTS idx_gd_souhaits_educateur_email ON gd_souhaits (educateur_email);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_gd_souhaits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gd_souhaits_updated_at ON gd_souhaits;
CREATE TRIGGER trg_gd_souhaits_updated_at
  BEFORE UPDATE ON gd_souhaits
  FOR EACH ROW EXECUTE FUNCTION update_gd_souhaits_updated_at();

-- RLS : accès service_role uniquement (pas d'accès anon direct)
ALTER TABLE gd_souhaits ENABLE ROW LEVEL SECURITY;
