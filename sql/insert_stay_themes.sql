-- ============================================
-- INSERT gd_stay_themes (multi-thèmes)
-- 24 séjours × 5 thèmes possibles
-- ============================================

-- 1. Vider la table existante (évite doublons)
DELETE FROM gd_stay_themes;

-- 2. Insérer tous les mappings
INSERT INTO gd_stay_themes (stay_slug, theme) VALUES
-- annecy-element: MONTAGNE, PLEIN_AIR
('annecy-element', 'MONTAGNE'),
('annecy-element', 'PLEIN_AIR'),

-- aqua-fun: MER, SPORT
('aqua-fun', 'MER'),
('aqua-fun', 'SPORT'),

-- aqua-gliss: MER
('aqua-gliss', 'MER'),

-- aqua-mix: MER
('aqua-mix', 'MER'),

-- breizh-equit-kids-8-11-ans: DECOUVERTE, MER
('breizh-equit-kids-8-11-ans', 'DECOUVERTE'),
('breizh-equit-kids-8-11-ans', 'MER'),

-- croc-marmotte: DECOUVERTE, MONTAGNE
('croc-marmotte', 'DECOUVERTE'),
('croc-marmotte', 'MONTAGNE'),

-- destination-bassin-darcachon-1: DECOUVERTE, MER
('destination-bassin-darcachon-1', 'DECOUVERTE'),
('destination-bassin-darcachon-1', 'MER'),

-- destination-soleil: MER, SPORT
('destination-soleil', 'MER'),
('destination-soleil', 'SPORT'),

-- dh-experience-11-13-ans: MONTAGNE, SPORT
('dh-experience-11-13-ans', 'MONTAGNE'),
('dh-experience-11-13-ans', 'SPORT'),

-- e-sport-and-sport: MONTAGNE, SPORT
('e-sport-and-sport', 'MONTAGNE'),
('e-sport-and-sport', 'SPORT'),

-- explore-mountain: DECOUVERTE, MONTAGNE
('explore-mountain', 'DECOUVERTE'),
('explore-mountain', 'MONTAGNE'),

-- glieraventures: MONTAGNE, PLEIN_AIR
('glieraventures', 'MONTAGNE'),
('glieraventures', 'PLEIN_AIR'),

-- laventure-verticale: MER, SPORT
('laventure-verticale', 'MER'),
('laventure-verticale', 'SPORT'),

-- les-apprentis-montagnards: DECOUVERTE, MONTAGNE
('les-apprentis-montagnards', 'DECOUVERTE'),
('les-apprentis-montagnards', 'MONTAGNE'),

-- les-ptits-puisotins-1: DECOUVERTE, MONTAGNE
('les-ptits-puisotins-1', 'DECOUVERTE'),
('les-ptits-puisotins-1', 'MONTAGNE'),

-- les-robinson-des-glieres: MONTAGNE, PLEIN_AIR
('les-robinson-des-glieres', 'MONTAGNE'),
('les-robinson-des-glieres', 'PLEIN_AIR'),

-- moto-moto: MONTAGNE, SPORT
('moto-moto', 'MONTAGNE'),
('moto-moto', 'SPORT'),

-- mountain-and-chill: MONTAGNE, PLEIN_AIR
('mountain-and-chill', 'MONTAGNE'),
('mountain-and-chill', 'PLEIN_AIR'),

-- natation-et-sensation: MER
('natation-et-sensation', 'MER'),

-- nature-picture: DECOUVERTE, MONTAGNE
('nature-picture', 'DECOUVERTE'),
('nature-picture', 'MONTAGNE'),

-- sperienza-in-corsica-1: MER, PLEIN_AIR
('sperienza-in-corsica-1', 'MER'),
('sperienza-in-corsica-1', 'PLEIN_AIR'),

-- surf-sur-le-bassin: MER, SPORT
('surf-sur-le-bassin', 'MER'),
('surf-sur-le-bassin', 'SPORT'),

-- survie-dans-le-beaufortain: MONTAGNE, PLEIN_AIR
('survie-dans-le-beaufortain', 'MONTAGNE'),
('survie-dans-le-beaufortain', 'PLEIN_AIR'),

-- yamakasi: MONTAGNE, SPORT
('yamakasi', 'MONTAGNE'),
('yamakasi', 'SPORT');

-- 3. Vérification
SELECT theme, COUNT(*) as nb_sejours
FROM gd_stay_themes
GROUP BY theme
ORDER BY nb_sejours DESC;
