-- ============================================================
-- Migration 033 — Import manuel : décomposition tarifaire
-- Ajoute les colonnes nécessaires à l'import de dossiers
-- pré-validés avec prix figés (devis validés hors app).
-- ============================================================
-- Idempotente : utilise ADD COLUMN IF NOT EXISTS

-- Décomposition du prix (montants devis validés)
ALTER TABLE gd_inscriptions
  ADD COLUMN IF NOT EXISTS prix_sejour     INTEGER,      -- Montant base séjour HT
  ADD COLUMN IF NOT EXISTS prix_transport  INTEGER,      -- Surcoût transport
  ADD COLUMN IF NOT EXISTS prix_encadrement INTEGER,     -- Surcoût encadrement renforcé

-- Traçabilité import
  ADD COLUMN IF NOT EXISTS price_locked    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS price_source    TEXT;         -- 'ufoval' | 'devis_externe' | 'manual'

-- Commentaires
COMMENT ON COLUMN gd_inscriptions.prix_sejour      IS 'Montant base séjour issu du devis validé';
COMMENT ON COLUMN gd_inscriptions.prix_transport   IS 'Surcoût transport issu du devis validé';
COMMENT ON COLUMN gd_inscriptions.prix_encadrement IS 'Surcoût encadrement renforcé (éducateur dédié)';
COMMENT ON COLUMN gd_inscriptions.price_locked     IS 'true = prix figé, ne pas recalculer depuis catalogue';
COMMENT ON COLUMN gd_inscriptions.price_source     IS 'Origine du prix : ufoval | devis_externe | manual';

-- Index utile pour requêtes d'audit import
CREATE INDEX IF NOT EXISTS idx_gd_inscriptions_price_source
  ON gd_inscriptions (price_source)
  WHERE price_source IS NOT NULL;
