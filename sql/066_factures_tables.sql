-- 066: Tables factures — gd_factures, gd_facture_lignes, gd_facture_paiements
-- Pattern: RLS activé + zéro policy = service_role only (ref: 063)

-- ============================================================
-- Séquence numérotation factures
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS gd_facture_numero_seq START 1;

-- ============================================================
-- Table gd_factures
-- ============================================================

CREATE TABLE IF NOT EXISTS gd_factures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL DEFAULT 'F-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(nextval('gd_facture_numero_seq')::TEXT, 3, '0'),
  structure_id UUID REFERENCES gd_structures(id) ON DELETE SET NULL,
  structure_nom TEXT NOT NULL,
  structure_adresse TEXT DEFAULT '',
  structure_cp TEXT DEFAULT '',
  structure_ville TEXT DEFAULT '',
  montant_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon','envoyee','payee_partiel','payee','annulee')),
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_factures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_factures_updated_at ON gd_factures;

CREATE TRIGGER trg_factures_updated_at
  BEFORE UPDATE ON gd_factures
  FOR EACH ROW
  EXECUTE FUNCTION set_factures_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_factures_statut ON gd_factures(statut);
CREATE INDEX IF NOT EXISTS idx_factures_structure_id ON gd_factures(structure_id);
CREATE INDEX IF NOT EXISTS idx_factures_numero ON gd_factures(numero);

-- RLS: service_role only
ALTER TABLE gd_factures ENABLE ROW LEVEL SECURITY;

CREATE POLICY deny_all_anon ON public.gd_factures
  FOR ALL TO anon USING (false);

CREATE POLICY deny_all_auth ON public.gd_factures
  FOR ALL TO authenticated USING (false);

-- ============================================================
-- Table gd_facture_lignes
-- ============================================================

CREATE TABLE IF NOT EXISTS gd_facture_lignes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id UUID NOT NULL REFERENCES gd_factures(id) ON DELETE CASCADE,
  enfant_nom TEXT NOT NULL,
  enfant_prenom TEXT NOT NULL,
  inscription_id UUID REFERENCES gd_inscriptions(id) ON DELETE SET NULL,
  sejour_titre TEXT NOT NULL,
  session_start DATE,
  session_end DATE,
  ville_depart TEXT DEFAULT '',
  prix_sejour DECIMAL(10,2) DEFAULT 0,
  prix_transport DECIMAL(10,2) DEFAULT 0,
  prix_encadrement DECIMAL(10,2) DEFAULT 0,
  prix_ligne_total DECIMAL(10,2) DEFAULT 0
);

-- RLS: service_role only
ALTER TABLE gd_facture_lignes ENABLE ROW LEVEL SECURITY;

CREATE POLICY deny_all_anon ON public.gd_facture_lignes
  FOR ALL TO anon USING (false);

CREATE POLICY deny_all_auth ON public.gd_facture_lignes
  FOR ALL TO authenticated USING (false);

-- ============================================================
-- Table gd_facture_paiements
-- ============================================================

CREATE TABLE IF NOT EXISTS gd_facture_paiements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id UUID NOT NULL REFERENCES gd_factures(id) ON DELETE CASCADE,
  date_paiement DATE NOT NULL,
  montant DECIMAL(10,2) NOT NULL,
  methode TEXT NOT NULL CHECK (methode IN ('virement','cb_stripe','cheque')),
  reference TEXT DEFAULT '',
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: service_role only
ALTER TABLE gd_facture_paiements ENABLE ROW LEVEL SECURITY;

CREATE POLICY deny_all_anon ON public.gd_facture_paiements
  FOR ALL TO anon USING (false);

CREATE POLICY deny_all_auth ON public.gd_facture_paiements
  FOR ALL TO authenticated USING (false);
