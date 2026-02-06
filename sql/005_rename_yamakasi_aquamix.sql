UPDATE gd_stays SET marketing_title = 'PARKOUR' WHERE slug = 'yamakasi';
UPDATE gd_stays SET marketing_title = 'BLUE EXPERIENCE' WHERE slug = 'aqua-mix';

SELECT slug, marketing_title FROM gd_stays WHERE slug IN ('yamakasi', 'aqua-mix');
