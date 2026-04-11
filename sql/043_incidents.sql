-- 043_incidents.sql
-- Table des incidents signalés pendant les séjours
-- Catégories : medical, comportemental, fugue, accident, autre
-- Gravité : info, attention, urgent
-- Statut : ouvert, en_cours, resolu

CREATE TABLE IF NOT EXISTS gd_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES gd_structures(id) ON DELETE CASCADE,
  inscription_id UUID NOT NULL REFERENCES gd_inscriptions(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('medical', 'comportemental', 'fugue', 'accident', 'autre')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'attention', 'urgent')),
  status TEXT NOT NULL DEFAULT 'ouvert' CHECK (status IN ('ouvert', 'en_cours', 'resolu')),
  description TEXT NOT NULL,
  resolved_at TIMESTAMPTZ,
  created_by TEXT NOT NULL, -- email du saisisseur
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_incidents_structure ON gd_incidents(structure_id);
CREATE INDEX IF NOT EXISTS idx_incidents_inscription ON gd_incidents(inscription_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON gd_incidents(status) WHERE status != 'resolu';

-- RLS : service_role only (pattern GED — zéro policy = accès client bloqué)
ALTER TABLE gd_incidents ENABLE ROW LEVEL SECURITY;
