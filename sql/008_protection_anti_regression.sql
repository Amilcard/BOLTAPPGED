-- ============================================
-- PROTECTION ANTI-RÉGRESSION : Verrouillage contenus CityCrunch
-- Date: 2026-02-15
-- Objectif: Empêcher l'affichage d'anciens contenus UFOVAL
-- ============================================

-- 1. CONTRAINTE: Un séjour publié DOIT avoir un marketing_title
-- → Empêche les régressions vers les anciens noms UFOVAL
ALTER TABLE gd_stays
  ADD CONSTRAINT check_published_has_marketing_title
  CHECK (published = false OR marketing_title IS NOT NULL);

-- 2. CONTRAINTE: Un séjour publié DOIT avoir une punchline
-- → Empêche les H2 vides ou legacy
ALTER TABLE gd_stays
  ADD CONSTRAINT check_published_has_punchline
  CHECK (published = false OR punchline IS NOT NULL);

-- 3. CONTRAINTE: Un séjour publié DOIT avoir un expert_pitch OU descriptionKids
-- → Garantit un contenu body premium minimum
ALTER TABLE gd_stays
  ADD CONSTRAINT check_published_has_content
  CHECK (published = false OR expert_pitch IS NOT NULL OR description_kids IS NOT NULL);

-- 4. INDEX: Accélérer la vérification des champs premium
CREATE INDEX IF NOT EXISTS idx_gd_stays_premium_check
  ON gd_stays(published, marketing_title, punchline, expert_pitch)
  WHERE published = true;

-- 5. FONCTION TRIGGER: Logger les modifications des champs premium
CREATE OR REPLACE FUNCTION log_premium_fields_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Si un champ premium est modifié sur un séjour publié, logger
  IF NEW.published = true AND (
    OLD.marketing_title IS DISTINCT FROM NEW.marketing_title OR
    OLD.punchline IS DISTINCT FROM NEW.punchline OR
    OLD.expert_pitch IS DISTINCT FROM NEW.expert_pitch
  ) THEN
    RAISE NOTICE 'ALERTE: Modification champ premium sur séjour publié % (slug: %)',
      NEW.id, NEW.slug;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. TRIGGER: Activer le logging automatique
DROP TRIGGER IF EXISTS trigger_log_premium_changes ON gd_stays;
CREATE TRIGGER trigger_log_premium_changes
  BEFORE UPDATE ON gd_stays
  FOR EACH ROW
  EXECUTE FUNCTION log_premium_fields_update();

-- 7. VUE: Détecter les régressions potentielles
CREATE OR REPLACE VIEW v_regression_risk AS
SELECT
  slug,
  title AS legacy_title,
  marketing_title,
  CASE
    WHEN published = true AND marketing_title IS NULL THEN 'CRITIQUE'
    WHEN published = true AND punchline IS NULL THEN 'ÉLEVÉ'
    WHEN published = true AND expert_pitch IS NULL AND description_kids IS NULL THEN 'MOYEN'
    ELSE 'OK'
  END AS risk_level
FROM gd_stays
WHERE published = true
ORDER BY
  CASE
    WHEN marketing_title IS NULL THEN 1
    WHEN punchline IS NULL THEN 2
    WHEN expert_pitch IS NULL AND description_kids IS NULL THEN 3
    ELSE 4
  END;

-- 8. VÉRIFICATION: Afficher les séjours à risque de régression
SELECT * FROM v_regression_risk WHERE risk_level != 'OK';

-- 9. COMMENTAIRES DOCUMENTATION
COMMENT ON CONSTRAINT check_published_has_marketing_title ON gd_stays IS
  'Protection anti-régression: empêche affichage anciens noms UFOVAL';

COMMENT ON CONSTRAINT check_published_has_punchline ON gd_stays IS
  'Protection anti-régression: garantit un H2 premium';

COMMENT ON CONSTRAINT check_published_has_content ON gd_stays IS
  'Protection anti-régression: garantit un contenu body minimum CityCrunch';

-- ============================================
-- RÉSULTAT ATTENDU
-- ============================================
-- ✅ Tout UPDATE qui tente de mettre marketing_title = NULL sur un séjour publié → ERREUR
-- ✅ Tout INSERT d'un séjour publié sans marketing_title → ERREUR
-- ✅ Vue v_regression_risk permet de détecter les séjours à risque
-- ✅ Logs automatiques si modification des champs premium

-- ROLLBACK (si besoin de désactiver) :
-- ALTER TABLE gd_stays DROP CONSTRAINT IF EXISTS check_published_has_marketing_title;
-- ALTER TABLE gd_stays DROP CONSTRAINT IF EXISTS check_published_has_punchline;
-- ALTER TABLE gd_stays DROP CONSTRAINT IF EXISTS check_published_has_content;
-- DROP TRIGGER IF EXISTS trigger_log_premium_changes ON gd_stays;
-- DROP FUNCTION IF EXISTS log_premium_fields_update();
-- DROP VIEW IF EXISTS v_regression_risk;
