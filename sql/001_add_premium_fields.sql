-- ============================================
-- MIGRATION: Ajout champs Premium Marketing
-- Table: gd_stays
-- But: Séparer données Admin/ERP du wording Premium côté front
-- Mode: NO REGRESSION (fallback côté app si champ NULL)
-- ============================================

-- 1. Nouveaux champs Premium
ALTER TABLE gd_stays
  ADD COLUMN IF NOT EXISTS marketing_title    TEXT,          -- Home H3 + Détail H1 (court, marque)
  ADD COLUMN IF NOT EXISTS punchline          TEXT,          -- Home sous-titre + Détail H2 (accroche courte, 1-2 phrases)
  ADD COLUMN IF NOT EXISTS expert_pitch       TEXT,          -- Détail corps de texte (storytelling long, style CityCrunch)
  ADD COLUMN IF NOT EXISTS emotion_tag        TEXT,          -- Badge unique (valeur émotion, pas géo)
  ADD COLUMN IF NOT EXISTS carousel_group     TEXT,          -- Routing carrousel Home (univers)
  ADD COLUMN IF NOT EXISTS spot_label         TEXT,          -- Lieu lisible (département / spot)
  ADD COLUMN IF NOT EXISTS standing_label     TEXT,          -- Confort/standing réel (pas nom administratif)
  ADD COLUMN IF NOT EXISTS expertise_label    TEXT,          -- Encadrement/diplômes (vendeur)
  ADD COLUMN IF NOT EXISTS intensity_label    TEXT,          -- Optionnel: intensité/rythme
  ADD COLUMN IF NOT EXISTS price_includes_features JSONB;   -- Bullets dynamiques 'inclus' (max 3-5)

-- 2. Index pour le tri par carousel_group (Home page)
CREATE INDEX IF NOT EXISTS idx_gd_stays_carousel_group ON gd_stays(carousel_group);

-- 3. Vérification
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'gd_stays'
  AND column_name IN (
    'marketing_title', 'punchline', 'expert_pitch', 'emotion_tag', 'carousel_group',
    'spot_label', 'standing_label', 'expertise_label', 'intensity_label',
    'price_includes_features'
  )
ORDER BY column_name;
