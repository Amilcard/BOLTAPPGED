-- 045_calls_and_notes.sql
-- Table des appels significatifs (tracés par CDS/direction)
-- Table des notes par enfant (non éditables, traçabilité RGPD)

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Appels significatifs
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gd_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES gd_structures(id) ON DELETE CASCADE,
  inscription_id UUID REFERENCES gd_inscriptions(id) ON DELETE SET NULL, -- nullable : appel logistique sans enfant
  call_type TEXT NOT NULL CHECK (call_type IN ('ged_colo', 'educ_colo', 'colo_structure', 'astreinte', 'parents')),
  direction TEXT NOT NULL CHECK (direction IN ('entrant', 'sortant')),
  interlocuteur TEXT NOT NULL, -- champ libre : "M. Martin, directeur colo"
  resume TEXT NOT NULL,
  parent_accord BOOLEAN DEFAULT false, -- si call_type = 'parents', accord structure obtenu
  created_by TEXT NOT NULL, -- email du saisisseur
  call_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calls_structure ON gd_calls(structure_id);
CREATE INDEX IF NOT EXISTS idx_calls_inscription ON gd_calls(inscription_id);
CREATE INDEX IF NOT EXISTS idx_calls_date ON gd_calls(call_date DESC);

ALTER TABLE gd_calls ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Notes par enfant (non éditables — traçabilité RGPD Art. 9)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gd_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES gd_structures(id) ON DELETE CASCADE,
  inscription_id UUID NOT NULL REFERENCES gd_inscriptions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by TEXT NOT NULL, -- email de l'auteur
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  -- PAS de updated_at : les notes ne sont JAMAIS modifiées (traçabilité)
);

CREATE INDEX IF NOT EXISTS idx_notes_structure ON gd_notes(structure_id);
CREATE INDEX IF NOT EXISTS idx_notes_inscription ON gd_notes(inscription_id);
CREATE INDEX IF NOT EXISTS idx_notes_date ON gd_notes(created_at DESC);

ALTER TABLE gd_notes ENABLE ROW LEVEL SECURITY;
