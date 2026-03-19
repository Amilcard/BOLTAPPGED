-- ============================================
-- v02_03 — marketing_title définitif (24 séjours)
-- Seul vrai changement vs 004+005 : glieraventures
-- Les 2 autres lignes sont idempotentes (couverture 005)
-- ============================================

-- AVENTURE_DECOUVERTE — seul changement réel
UPDATE gd_stays SET marketing_title = 'DUAL CAMP'       WHERE slug = 'glieraventures';

-- Confirmations idempotentes (couverture de 005 au cas où non appliqué)
UPDATE gd_stays SET marketing_title = 'PARKOUR'         WHERE slug = 'yamakasi';
UPDATE gd_stays SET marketing_title = 'BLUE EXPERIENCE' WHERE slug = 'aqua-mix';

-- Vérification
SELECT slug, marketing_title FROM gd_stays
WHERE slug IN ('glieraventures', 'yamakasi', 'aqua-mix')
ORDER BY slug;
