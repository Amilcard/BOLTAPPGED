-- 044_medical_events.sql
-- Table des événements médicaux — Art. 9 RGPD (données sensibles)
-- Séparée des incidents : obligation juridique de ne pas mélanger
-- Purge automatique : 3 mois post-séjour (cron rgpd-purge existant)

CREATE TABLE IF NOT EXISTS gd_medical_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES gd_structures(id) ON DELETE CASCADE,
  inscription_id UUID NOT NULL REFERENCES gd_inscriptions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- libre : "prise médicament", "consultation", "urgences", etc.
  description TEXT NOT NULL,
  created_by TEXT NOT NULL, -- email du saisisseur (GED ou éducateur)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_medical_events_structure ON gd_medical_events(structure_id);
CREATE INDEX IF NOT EXISTS idx_medical_events_inscription ON gd_medical_events(inscription_id);

-- RLS : service_role only (Art. 9 — aucun accès client direct)
ALTER TABLE gd_medical_events ENABLE ROW LEVEL SECURITY;

-- Note : la purge 3 mois est gérée par le cron rgpd-purge existant.
-- Il faudra ajouter un appel RPC gd_purge_expired_medical_events ou étendre gd_purge_expired_medical_data.
