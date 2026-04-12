-- Migration 053 : Étendre gd_incidents pour le workflow alertes
-- Évite la duplication avec une table gd_alertes_sejour séparée.
-- À appliquer dans Supabase SQL Editor.

ALTER TABLE gd_incidents
  ADD COLUMN IF NOT EXISTS titre        TEXT,
  ADD COLUMN IF NOT EXISTS vu_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vu_by_code   TEXT,
  ADD COLUMN IF NOT EXISTS resolution_note TEXT;

-- Index pour les alertes urgentes non résolues (SejourAlertsBanner)
CREATE INDEX IF NOT EXISTS idx_incidents_urgent_open
  ON gd_incidents (structure_id, severity, status)
  WHERE severity = 'urgent' AND status != 'resolu';
