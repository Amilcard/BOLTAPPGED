-- ============================================
-- SMART FORM ROUTING - Fonctions SQL
-- Support backend pour business_logic_rules.json
-- ============================================

-- ============================================
-- 1. FONCTION : Get Suggested Stays par Niveau Inclusion
-- ============================================

CREATE OR REPLACE FUNCTION get_suggested_stays_by_inclusion_level(
  inclusion_level VARCHAR,
  child_age INTEGER DEFAULT NULL
)
RETURNS TABLE (
  slug VARCHAR,
  marketing_title VARCHAR,
  emotion_tag VARCHAR,
  carousel_group VARCHAR,
  age_min INTEGER,
  age_max INTEGER,
  punchline TEXT,
  spot_label VARCHAR,
  image_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  CASE inclusion_level
    WHEN 'NIVEAU_1_INCLUSION' THEN
      -- Séjours doux, première colo, découverte
      SELECT
        s.slug,
        s.marketing_title,
        s.emotion_tag,
        s.carousel_group,
        s.age_min,
        s.age_max,
        s.punchline,
        s.spot_label,
        si.public_url as image_url
      FROM gd_stays s
      LEFT JOIN LATERAL (
        SELECT public_url
        FROM sejours_images
        WHERE slug = s.slug
          AND status = 'active'
        ORDER BY quality_score DESC, usage_count ASC
        LIMIT 1
      ) si ON true
      WHERE s.published = true
        AND s.carousel_group IN ('MA_PREMIERE_COLO', 'OCEAN_FUN')
        AND s.emotion_tag IN ('DOUCEUR', 'DÉCOUVERTE', 'NATURE', 'COCOONING')
        AND (child_age IS NULL OR (s.age_min <= child_age AND s.age_max >= child_age))
      ORDER BY s.carousel_group, s.age_min
      LIMIT 12;

    WHEN 'NIVEAU_2_RENFORCE' THEN
      -- Séjours à cadre renforcé, canalisation énergie
      SELECT
        s.slug,
        s.marketing_title,
        s.emotion_tag,
        s.carousel_group,
        s.age_min,
        s.age_max,
        s.punchline,
        s.spot_label,
        si.public_url as image_url
      FROM gd_stays s
      LEFT JOIN LATERAL (
        SELECT public_url
        FROM sejours_images
        WHERE slug = s.slug
          AND status = 'active'
        ORDER BY quality_score DESC
        LIMIT 1
      ) si ON true
      WHERE s.published = true
        AND s.carousel_group IN ('ADRENALINE_SENSATIONS', 'ALTITUDE_AVENTURE')
        AND s.emotion_tag IN ('MÉCANIQUE', 'SPORT', 'ACTION', 'PASSION', 'SURVIE', 'DYNAMIQUE')
        AND (child_age IS NULL OR (s.age_min <= child_age AND s.age_max >= child_age))
      ORDER BY
        CASE s.emotion_tag
          WHEN 'MÉCANIQUE' THEN 1
          WHEN 'SURVIE' THEN 2
          WHEN 'PASSION' THEN 3
          ELSE 4
        END,
        s.age_min
      LIMIT 12;

    ELSE
      -- Fallback : tous séjours publiés
      SELECT
        s.slug,
        s.marketing_title,
        s.emotion_tag,
        s.carousel_group,
        s.age_min,
        s.age_max,
        s.punchline,
        s.spot_label,
        si.public_url as image_url
      FROM gd_stays s
      LEFT JOIN LATERAL (
        SELECT public_url
        FROM sejours_images
        WHERE slug = s.slug
          AND status = 'active'
        ORDER BY quality_score DESC
        LIMIT 1
      ) si ON true
      WHERE s.published = true
        AND (child_age IS NULL OR (s.age_min <= child_age AND s.age_max >= child_age))
      ORDER BY s.carousel_group, s.marketing_title
      LIMIT 20;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. FONCTION : Get Stays par Tags
-- ============================================

CREATE OR REPLACE FUNCTION get_stays_by_tags(
  filter_tags TEXT[],
  child_age INTEGER DEFAULT NULL,
  limit_count INTEGER DEFAULT 12
)
RETURNS TABLE (
  slug VARCHAR,
  marketing_title VARCHAR,
  emotion_tag VARCHAR,
  carousel_group VARCHAR,
  age_min INTEGER,
  age_max INTEGER,
  punchline TEXT,
  image_url TEXT,
  match_score INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.slug,
    s.marketing_title,
    s.emotion_tag,
    s.carousel_group,
    s.age_min,
    s.age_max,
    s.punchline,
    si.public_url as image_url,
    (
      -- Score de matching : nb de tags correspondants
      SELECT COUNT(*)::INTEGER
      FROM unnest(filter_tags) AS tag
      WHERE s.emotion_tag ILIKE '%' || tag || '%'
        OR s.punchline ILIKE '%' || tag || '%'
        OR s.carousel_group ILIKE '%' || tag || '%'
    ) as match_score
  FROM gd_stays s
  LEFT JOIN LATERAL (
    SELECT public_url
    FROM sejours_images
    WHERE slug = s.slug
      AND status = 'active'
    ORDER BY quality_score DESC
    LIMIT 1
  ) si ON true
  WHERE s.published = true
    AND (child_age IS NULL OR (s.age_min <= child_age AND s.age_max >= child_age))
    AND EXISTS (
      SELECT 1
      FROM unnest(filter_tags) AS tag
      WHERE s.emotion_tag ILIKE '%' || tag || '%'
        OR s.punchline ILIKE '%' || tag || '%'
        OR s.carousel_group ILIKE '%' || tag || '%'
    )
  ORDER BY match_score DESC, s.marketing_title
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. FONCTION : Get Stay Images pour Carousel
-- ============================================

CREATE OR REPLACE FUNCTION get_stay_carousel_images(
  stay_slug VARCHAR,
  image_limit INTEGER DEFAULT 6
)
RETURNS TABLE (
  id UUID,
  public_url TEXT,
  thumbnail_url TEXT,
  alt_description TEXT,
  photographer_name VARCHAR,
  photographer_url TEXT,
  visual_mood VARCHAR,
  color_palette TEXT,
  quality_score INTEGER
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
    si.visual_mood,
    si.color_palette,
    si.quality_score
  FROM sejours_images si
  WHERE si.slug = stay_slug
    AND si.status = 'active'
  ORDER BY
    -- Prioriser :
    -- 1. Images manuellement sélectionnées
    si.manual_selection DESC,
    -- 2. Images de query primary
    CASE si.query_type WHEN 'primary' THEN 1 ELSE 2 END,
    -- 3. Score qualité visuelle
    si.quality_score DESC,
    -- 4. Moins utilisées (pour rotation)
    si.usage_count ASC,
    -- 5. Plus récentes
    si.imported_at DESC
  LIMIT image_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. FONCTION : Log Smart Form Submission
-- ============================================

CREATE TABLE IF NOT EXISTS smart_form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inclusion_level VARCHAR(50),
  child_age INTEGER,
  interests TEXT[],
  urgence_48h BOOLEAN DEFAULT FALSE,
  handicap BOOLEAN DEFAULT FALSE,
  qf INTEGER,
  qpv BOOLEAN DEFAULT FALSE,
  referent_organization VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  suggested_stays JSONB,
  alert_priority VARCHAR(50),
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  crm_synced_at TIMESTAMP WITH TIME ZONE,
  crm_lead_id VARCHAR(100)
);

CREATE INDEX idx_smart_form_level ON smart_form_submissions(inclusion_level);
CREATE INDEX idx_smart_form_submitted ON smart_form_submissions(submitted_at DESC);
CREATE INDEX idx_smart_form_urgence ON smart_form_submissions(urgence_48h) WHERE urgence_48h = TRUE;

CREATE OR REPLACE FUNCTION log_smart_form_submission(
  p_inclusion_level VARCHAR,
  p_child_age INTEGER,
  p_interests TEXT[],
  p_urgence_48h BOOLEAN,
  p_handicap BOOLEAN,
  p_qf INTEGER,
  p_qpv BOOLEAN,
  p_referent_organization VARCHAR,
  p_contact_email VARCHAR,
  p_contact_phone VARCHAR,
  p_suggested_stays JSONB
)
RETURNS UUID AS $$
DECLARE
  v_submission_id UUID;
  v_alert_priority VARCHAR(50);
BEGIN
  -- Déterminer priorité alerte selon business logic
  v_alert_priority := CASE
    WHEN p_inclusion_level = 'NIVEAU_3_RUPTURE' THEN 'HIGH_PRIORITY_CALL_NOW'
    WHEN p_urgence_48h = TRUE THEN 'HOT_LEAD'
    WHEN p_inclusion_level = 'NIVEAU_2_RENFORCE' THEN 'MEDIUM_PRIORITY'
    ELSE 'STANDARD'
  END;

  -- Insérer soumission
  INSERT INTO smart_form_submissions (
    inclusion_level,
    child_age,
    interests,
    urgence_48h,
    handicap,
    qf,
    qpv,
    referent_organization,
    contact_email,
    contact_phone,
    suggested_stays,
    alert_priority
  ) VALUES (
    p_inclusion_level,
    p_child_age,
    p_interests,
    p_urgence_48h,
    p_handicap,
    p_qf,
    p_qpv,
    p_referent_organization,
    p_contact_email,
    p_contact_phone,
    p_suggested_stays,
    v_alert_priority
  )
  RETURNING id INTO v_submission_id;

  RETURN v_submission_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. FONCTION : Get Financial Aid Estimate
-- ============================================

CREATE OR REPLACE FUNCTION estimate_financial_aid(
  p_qf INTEGER,
  p_qpv BOOLEAN,
  p_sejour_price INTEGER
)
RETURNS TABLE (
  aide_montant INTEGER,
  reste_a_charge INTEGER,
  taux_prise_en_charge NUMERIC,
  eligible_aide_max BOOLEAN
) AS $$
DECLARE
  v_aide_montant INTEGER;
  v_reste_a_charge INTEGER;
  v_taux NUMERIC;
BEGIN
  -- Logique simplifiée d'aides financières
  -- Basée sur business_logic_rules.json

  IF p_qf IS NULL THEN
    -- Pas de QF fourni, pas d'estimation possible
    RETURN QUERY SELECT 0, p_sejour_price, 0.0::NUMERIC, FALSE;
    RETURN;
  END IF;

  -- Calcul aide selon QF (logique à affiner selon vos barèmes)
  v_taux := CASE
    WHEN p_qf <= 400 THEN 1.0  -- 100% pris en charge
    WHEN p_qf <= 600 THEN 0.9  -- 90%
    WHEN p_qf <= 800 THEN 0.75 -- 75%
    WHEN p_qf <= 1000 THEN 0.6 -- 60%
    WHEN p_qf <= 1200 THEN 0.4 -- 40%
    ELSE 0.2                    -- 20%
  END;

  -- Bonus QPV : +10% de prise en charge
  IF p_qpv = TRUE THEN
    v_taux := LEAST(1.0, v_taux + 0.1);
  END IF;

  v_aide_montant := FLOOR(p_sejour_price * v_taux);
  v_reste_a_charge := p_sejour_price - v_aide_montant;

  RETURN QUERY SELECT
    v_aide_montant,
    v_reste_a_charge,
    v_taux,
    (v_taux >= 1.0) as eligible_aide_max;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. VUES UTILES pour Dashboard Admin
-- ============================================

-- Vue : Statistiques soumissions Smart Form
CREATE OR REPLACE VIEW v_smart_form_stats AS
SELECT
  inclusion_level,
  COUNT(*) as total_submissions,
  COUNT(*) FILTER (WHERE urgence_48h = TRUE) as urgent_count,
  COUNT(*) FILTER (WHERE handicap = TRUE) as handicap_count,
  COUNT(*) FILTER (WHERE qpv = TRUE) as qpv_count,
  AVG(child_age) as avg_child_age,
  AVG(qf) as avg_qf,
  COUNT(*) FILTER (WHERE crm_synced_at IS NOT NULL) as synced_to_crm,
  MAX(submitted_at) as last_submission
FROM smart_form_submissions
GROUP BY inclusion_level
ORDER BY total_submissions DESC;

-- Vue : Alertes prioritaires en attente
CREATE OR REPLACE VIEW v_smart_form_urgent_alerts AS
SELECT
  id,
  inclusion_level,
  child_age,
  referent_organization,
  contact_email,
  contact_phone,
  alert_priority,
  submitted_at,
  EXTRACT(EPOCH FROM (NOW() - submitted_at))/3600 as hours_since_submission
FROM smart_form_submissions
WHERE alert_priority IN ('HIGH_PRIORITY_CALL_NOW', 'HOT_LEAD')
  AND crm_synced_at IS NULL
ORDER BY
  CASE alert_priority
    WHEN 'HIGH_PRIORITY_CALL_NOW' THEN 1
    WHEN 'HOT_LEAD' THEN 2
  END,
  submitted_at ASC;

-- ============================================
-- 7. TRIGGER : Notification automatique alertes urgentes
-- ============================================

CREATE OR REPLACE FUNCTION notify_urgent_submission()
RETURNS TRIGGER AS $$
BEGIN
  -- Si alerte high priority ou hot lead, déclencher notification
  IF NEW.alert_priority IN ('HIGH_PRIORITY_CALL_NOW', 'HOT_LEAD') THEN
    -- Ici : appel webhook, email, SMS selon votre stack
    -- Exemple simplifié : log dans table notifications
    INSERT INTO notification_queue (
      type,
      priority,
      recipient,
      subject,
      payload,
      created_at
    ) VALUES (
      'smart_form_alert',
      NEW.alert_priority,
      'sales_team_oncall',
      CONCAT('[', NEW.alert_priority, '] Nouvelle demande urgente'),
      json_build_object(
        'submission_id', NEW.id,
        'inclusion_level', NEW.inclusion_level,
        'contact_phone', NEW.contact_phone,
        'organization', NEW.referent_organization
      ),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_urgent_submission
  AFTER INSERT ON smart_form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION notify_urgent_submission();

-- ============================================
-- 8. TABLE : Queue notifications
-- ============================================

CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  priority VARCHAR(50) NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  subject TEXT,
  payload JSONB,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

CREATE INDEX idx_notification_queue_status ON notification_queue(status, created_at);
CREATE INDEX idx_notification_queue_priority ON notification_queue(priority, created_at);

-- ============================================
-- COMMENTAIRES
-- ============================================

COMMENT ON FUNCTION get_suggested_stays_by_inclusion_level IS 'Retourne les séjours suggérés selon niveau inclusion (NIVEAU_1/2/3)';
COMMENT ON FUNCTION get_stays_by_tags IS 'Recherche séjours par tags avec score de pertinence';
COMMENT ON FUNCTION get_stay_carousel_images IS 'Récupère images optimisées pour carousel séjour';
COMMENT ON FUNCTION log_smart_form_submission IS 'Enregistre soumission smart form avec routage alerte';
COMMENT ON FUNCTION estimate_financial_aid IS 'Estime aide financière selon QF et QPV';

-- ============================================
-- EXEMPLES D'UTILISATION
-- ============================================

-- Exemple 1 : Récupérer séjours niveau 1 pour enfant de 8 ans
-- SELECT * FROM get_suggested_stays_by_inclusion_level('NIVEAU_1_INCLUSION', 8);

-- Exemple 2 : Rechercher séjours par tags
-- SELECT * FROM get_stays_by_tags(ARRAY['Mécanique', 'Sport Intensif'], 14, 10);

-- Exemple 3 : Images carousel pour un séjour
-- SELECT * FROM get_stay_carousel_images('moto-moto', 6);

-- Exemple 4 : Estimer aide financière
-- SELECT * FROM estimate_financial_aid(450, true, 850);

-- Exemple 5 : Logger soumission
-- SELECT log_smart_form_submission(
--   'NIVEAU_2_RENFORCE',
--   13,
--   ARRAY['moto', 'sport'],
--   false,
--   false,
--   650,
--   true,
--   'ASE Haute-Savoie',
--   'travailleur@ase74.fr',
--   '0612345678',
--   '{"suggested_stays": ["moto-moto", "survivor-camp"]}'::jsonb
-- );
