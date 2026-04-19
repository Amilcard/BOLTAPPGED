-- Migration 080 : normalise la casse de gd_stays.ged_theme
--
-- Contexte : champ legacy (UI consomme gd_stay_themes multi). 5 valeurs
-- distinctes dont 3 en Title Case et 2 en UPPERCASE — uniformise en
-- UPPERCASE + underscore, aligné sur la convention `carousel_group`.
--
-- Attention :
--   * Workflow n8n `GED_UFOVAL_SCRAPE_CONTENU_ALL_v2_is_full.json` écrit
--     dans ced champ — il est marked DANGEREUX/désactivé par consigne
--     (cf n8n-patches/GUIDE_SESSION_IS_FULL.md). SI v2 est réactivé, ma
--     normalisation sera écrasée par les valeurs UFOVAL brutes.
--   * Le workflow actif `v3_SAFE` ne touche pas ged_theme — safe.
--   * sql/035_insert_nouveaux_sejours.sql (one-shot historique) réinsérerait
--     les valeurs Title Case si ré-exécuté.
--
-- Impact UI : nul (champ non consommé).
-- Rollback : ROLLBACK_080.sql restaure les 3 valeurs Title Case.

UPDATE public.gd_stays SET ged_theme = 'LAC_MONTAGNE'      WHERE ged_theme = 'Lac & Montagne';
UPDATE public.gd_stays SET ged_theme = 'MER_SURF'          WHERE ged_theme = 'Mer & Surf';
UPDATE public.gd_stays SET ged_theme = 'NATURE_EQUITATION' WHERE ged_theme = 'Nature & Équitation';
