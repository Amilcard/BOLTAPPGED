-- 037_inscription_status_logs.sql
-- Historique des changements de statut des inscriptions.
-- Référencé dans PUT /api/admin/inscriptions/[id] (lignes 156-165) mais jamais créé.

CREATE TABLE IF NOT EXISTS gd_inscription_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inscription_id UUID NOT NULL REFERENCES gd_inscriptions(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour requêtes par inscription
CREATE INDEX IF NOT EXISTS idx_status_logs_inscription
  ON gd_inscription_status_logs (inscription_id, created_at DESC);

-- RLS : service_role only (données admin)
ALTER TABLE gd_inscription_status_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on status_logs"
  ON gd_inscription_status_logs
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE gd_inscription_status_logs IS
  'Historique changements statut inscriptions — audit métier pour traçabilité admin.';
