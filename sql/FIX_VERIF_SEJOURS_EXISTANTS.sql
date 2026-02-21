-- Vérifier les séjours existants dans la base
SELECT slug, title, age_min, age_max
FROM gd_stays
ORDER BY slug
LIMIT 20;
