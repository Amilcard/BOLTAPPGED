-- ============================================
-- TABLE IMAGES SÉJOURS FLOOOW
-- Stockage des métadonnées images collectées via n8n
-- Sources: Unsplash + Pexels
-- ============================================

CREATE TABLE IF NOT EXISTS sejours_images (
  -- Identifiant
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Référence séjour
  slug VARCHAR(255) NOT NULL,
  marketing_title VARCHAR(255) NOT NULL,
  emotion_tag VARCHAR(50) NOT NULL,
  carousel_group VARCHAR(50) NOT NULL,
  age_range VARCHAR(20) NOT NULL,

  -- Source image
  source VARCHAR(20) NOT NULL CHECK (source IN ('unsplash', 'pexels')),
  source_id VARCHAR(100) NOT NULL,

  -- URLs et stockage
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  thumbnail_url TEXT,

  -- Attribution photographe
  photographer_name VARCHAR(255) NOT NULL,
  photographer_url TEXT,
  photographer_portfolio TEXT,

  -- Métadonnées image
  alt_description TEXT,
  keyword_used VARCHAR(255),
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  color VARCHAR(10),
  likes INTEGER DEFAULT 0,

  -- Statut et qualité
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'rejected')),
  quality_score INTEGER DEFAULT 5 CHECK (quality_score BETWEEN 1 AND 10),
  manual_selection BOOLEAN DEFAULT FALSE,

  -- Tracking
  imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,

  -- Contrainte unicité
  UNIQUE(source, source_id)
);

-- Index de performance
CREATE INDEX idx_sejours_images_slug ON sejours_images(slug);
CREATE INDEX idx_sejours_images_carousel ON sejours_images(carousel_group);
CREATE INDEX idx_sejours_images_emotion ON sejours_images(emotion_tag);
CREATE INDEX idx_sejours_images_age_range ON sejours_images(age_range);
CREATE INDEX idx_sejours_images_status ON sejours_images(status);
CREATE INDEX idx_sejours_images_source ON sejours_images(source, source_id);
CREATE INDEX idx_sejours_images_quality ON sejours_images(quality_score DESC);
CREATE INDEX idx_sejours_images_imported ON sejours_images(imported_at DESC);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_sejours_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
CREATE TRIGGER trigger_sejours_images_updated_at
  BEFORE UPDATE ON sejours_images
  FOR EACH ROW
  EXECUTE FUNCTION update_sejours_images_updated_at();

-- ============================================
-- TABLE LOGS IMPORTS
-- Historique des imports d'images
-- ============================================

CREATE TABLE IF NOT EXISTS import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  total_items INTEGER NOT NULL DEFAULT 0,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_import_logs_type ON import_logs(type);
CREATE INDEX idx_import_logs_created ON import_logs(created_at DESC);

-- ============================================
-- VUES UTILES
-- ============================================

-- Vue : Images par séjour avec stats
CREATE OR REPLACE VIEW v_sejours_images_stats AS
SELECT
  slug,
  marketing_title,
  carousel_group,
  COUNT(*) as total_images,
  COUNT(*) FILTER (WHERE status = 'active') as active_images,
  COUNT(*) FILTER (WHERE source = 'unsplash') as from_unsplash,
  COUNT(*) FILTER (WHERE source = 'pexels') as from_pexels,
  AVG(quality_score) as avg_quality,
  MAX(imported_at) as last_import_date
FROM sejours_images
GROUP BY slug, marketing_title, carousel_group
ORDER BY total_images DESC;

-- Vue : Top images par qualité et usage
CREATE OR REPLACE VIEW v_top_sejours_images AS
SELECT
  id,
  slug,
  marketing_title,
  emotion_tag,
  source,
  public_url,
  thumbnail_url,
  photographer_name,
  quality_score,
  usage_count,
  (quality_score * 0.6 + LEAST(usage_count, 10) * 0.4) as relevance_score
FROM sejours_images
WHERE status = 'active'
ORDER BY relevance_score DESC;

-- Vue : Images manquantes par séjour
CREATE OR REPLACE VIEW v_sejours_missing_images AS
WITH expected_sejours AS (
  SELECT DISTINCT slug, marketing_title, carousel_group
  FROM gd_stays
  WHERE published = true
)
SELECT
  es.slug,
  es.marketing_title,
  es.carousel_group,
  COALESCE(si.image_count, 0) as current_images,
  CASE
    WHEN COALESCE(si.image_count, 0) = 0 THEN 'CRITICAL'
    WHEN COALESCE(si.image_count, 0) < 3 THEN 'LOW'
    WHEN COALESCE(si.image_count, 0) < 6 THEN 'MEDIUM'
    ELSE 'OK'
  END as priority
FROM expected_sejours es
LEFT JOIN (
  SELECT slug, COUNT(*) as image_count
  FROM sejours_images
  WHERE status = 'active'
  GROUP BY slug
) si ON es.slug = si.slug
ORDER BY current_images ASC, es.slug;

-- ============================================
-- FONCTIONS UTILES
-- ============================================

-- Fonction : Obtenir une image aléatoire pour un séjour
CREATE OR REPLACE FUNCTION get_random_sejour_image(sejour_slug VARCHAR)
RETURNS TABLE (
  id UUID,
  public_url TEXT,
  thumbnail_url TEXT,
  alt_description TEXT,
  photographer_name VARCHAR,
  photographer_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    si.id,
    si.public_url,
    si.thumbnail_url,
    si.alt_description,
    si.photographer_name,
    si.photographer_url
  FROM sejours_images si
  WHERE si.slug = sejour_slug
    AND si.status = 'active'
  ORDER BY RANDOM()
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Fonction : Obtenir les meilleures images pour un séjour
CREATE OR REPLACE FUNCTION get_top_sejour_images(
  sejour_slug VARCHAR,
  limit_count INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  public_url TEXT,
  thumbnail_url TEXT,
  alt_description TEXT,
  photographer_name VARCHAR,
  photographer_url TEXT,
  quality_score INTEGER,
  usage_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    si.id,
    si.public_url,
    si.thumbnail_url,
    si.alt_description,
    si.photographer_name,
    si.photographer_url,
    si.quality_score,
    si.usage_count
  FROM sejours_images si
  WHERE si.slug = sejour_slug
    AND si.status = 'active'
  ORDER BY
    (si.quality_score * 0.6 + LEAST(si.usage_count, 10) * 0.4) DESC,
    si.imported_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Fonction : Incrémenter usage d'une image
CREATE OR REPLACE FUNCTION increment_image_usage(image_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE sejours_images
  SET
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE id = image_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTAIRES
-- ============================================

COMMENT ON TABLE sejours_images IS 'Stockage des métadonnées des images de séjours collectées depuis Unsplash et Pexels via n8n';
COMMENT ON COLUMN sejours_images.slug IS 'Référence unique du séjour (ex: moto-moto, annecy-element)';
COMMENT ON COLUMN sejours_images.emotion_tag IS 'Tag émotionnel (MÉCANIQUE, AÉRIEN, SURVIE, etc.)';
COMMENT ON COLUMN sejours_images.carousel_group IS 'Groupe carousel (ADRENALINE_SENSATIONS, ALTITUDE_AVENTURE, etc.)';
COMMENT ON COLUMN sejours_images.quality_score IS 'Score qualité manuel 1-10, défaut 5';
COMMENT ON COLUMN sejours_images.manual_selection IS 'TRUE si sélectionné manuellement par équipe';
COMMENT ON COLUMN sejours_images.usage_count IS 'Nombre de fois où l''image a été affichée';

-- ============================================
-- DONNÉES INITIALES (optionnel)
-- ============================================

-- Exemple : Marquer certaines images comme sélection manuelle premium
-- UPDATE sejours_images
-- SET manual_selection = TRUE, quality_score = 10
-- WHERE source_id IN ('id1', 'id2', 'id3');
