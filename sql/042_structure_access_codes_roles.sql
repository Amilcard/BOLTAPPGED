-- 042_structure_access_codes_roles.sql
-- Système de rôles structure : direction, cds, secretariat, educateur
-- Remplace la logique "longueur du code = rôle" par un lookup table

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Table des codes d'accès structure avec rôles
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gd_structure_access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES gd_structures(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('direction', 'cds', 'secretariat', 'educateur')),
  roles TEXT[] NOT NULL DEFAULT '{}',
  label TEXT,
  email TEXT,
  prenom TEXT,
  nom TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_access_codes_code ON gd_structure_access_codes (code) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_access_codes_structure ON gd_structure_access_codes (structure_id);

-- RLS : service_role only
ALTER TABLE gd_structure_access_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON gd_structure_access_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Colonnes délégation sur gd_structures
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE gd_structures ADD COLUMN IF NOT EXISTS delegation_active_from TIMESTAMPTZ;
ALTER TABLE gd_structures ADD COLUMN IF NOT EXISTS delegation_active_until TIMESTAMPTZ;
ALTER TABLE gd_structures ADD COLUMN IF NOT EXISTS delegated_to_email TEXT;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Migration : codes existants → access_codes
-- Les codes CDS (6 chars) et directeur (10 chars) existants sont migrés
-- ═══════════════════════════════════════════════════════════════════════

-- CDS codes → rôle 'cds' avec accès admin+educatif
INSERT INTO gd_structure_access_codes (structure_id, code, role, roles, label, active, expires_at)
SELECT id, code, 'cds', ARRAY['cds', 'admin', 'educatif'], 'Chef de service (migré)', true, code_expires_at
FROM gd_structures
WHERE code IS NOT NULL AND status = 'active'
ON CONFLICT (code) DO NOTHING;

-- Directeur codes → rôle 'direction' avec tous accès
INSERT INTO gd_structure_access_codes (structure_id, code, role, roles, label, active, expires_at)
SELECT id, code_directeur, 'direction', ARRAY['direction', 'cds', 'admin', 'educatif'], 'Directeur (migré)', true, code_directeur_expires_at
FROM gd_structures
WHERE code_directeur IS NOT NULL AND status = 'active'
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE gd_structure_access_codes IS
  'Codes d''accès structure avec rôles (direction, cds, secretariat, educateur). Remplace la logique longueur=rôle.';
