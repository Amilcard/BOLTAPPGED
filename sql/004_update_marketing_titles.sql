-- ============================================
-- UPDATE marketing_title DÉFINITIF (23 séjours)
-- Scope: UNIQUEMENT marketing_title + P0 standing_label annecy
-- Aucun autre champ modifié
-- ============================================

-- ADRENALINE_SENSATIONS (7)
UPDATE gd_stays SET marketing_title = 'MX RIDER ACADEMY' WHERE slug = 'moto-moto';
UPDATE gd_stays SET marketing_title = 'AZUR DIVE & JET' WHERE slug = 'aqua-fun';
UPDATE gd_stays SET marketing_title = 'ALPINE SKY CAMP' WHERE slug = 'annecy-element';
UPDATE gd_stays SET marketing_title = 'RIVIERA SPEED CLUB' WHERE slug = 'destination-soleil';
UPDATE gd_stays SET marketing_title = 'GRAVITY BIKE PARK' WHERE slug = 'dh-experience-11-13-ans';
UPDATE gd_stays SET marketing_title = 'CORSICA WILD TRIP' WHERE slug = 'sperienza-in-corsica-1';
UPDATE gd_stays SET marketing_title = 'WEST COAST SURF CAMP' WHERE slug = 'surf-sur-le-bassin';

-- AVENTURE_DECOUVERTE (12)
UPDATE gd_stays SET marketing_title = 'SURVIVOR CAMP 74' WHERE slug = 'les-robinson-des-glieres';
UPDATE gd_stays SET marketing_title = 'INTO THE WILD' WHERE slug = 'survie-dans-le-beaufortain';
UPDATE gd_stays SET marketing_title = 'BRETAGNE OCEAN RIDE' WHERE slug = 'breizh-equit-kids-8-11-ans';
UPDATE gd_stays SET marketing_title = 'URBAN MOVE ACADEMY' WHERE slug = 'yamakasi';
UPDATE gd_stays SET marketing_title = 'DUNE & OCEAN KIDS' WHERE slug = 'destination-bassin-darcachon-1';
UPDATE gd_stays SET marketing_title = 'DUAL CAMP : LAC & MONTAGNE' WHERE slug = 'glieraventures';
UPDATE gd_stays SET marketing_title = 'WILDLIFE REPORTER' WHERE slug = 'nature-picture';
UPDATE gd_stays SET marketing_title = 'ADRENALINE & CHILL' WHERE slug = 'mountain-and-chill';
UPDATE gd_stays SET marketing_title = 'ALPINE TREK JUNIOR' WHERE slug = 'explore-mountain';
UPDATE gd_stays SET marketing_title = 'ROCKS & PADDLE' WHERE slug = 'laventure-verticale';
UPDATE gd_stays SET marketing_title = 'GAMING HOUSE 1850' WHERE slug = 'e-sport-and-sport';
-- aqua-mix: absent du mapping → conserve 'AQUA MIX'

-- MA_PREMIERE_COLO (5)
UPDATE gd_stays SET marketing_title = 'MY LITTLE FOREST' WHERE slug = 'les-ptits-puisotins-1';
UPDATE gd_stays SET marketing_title = 'ALPOO KIDS' WHERE slug = 'croc-marmotte';
UPDATE gd_stays SET marketing_title = 'BABY RIDERS' WHERE slug = 'aqua-gliss';
UPDATE gd_stays SET marketing_title = 'SWIM ACADEMY' WHERE slug = 'natation-et-sensation';
UPDATE gd_stays SET marketing_title = 'HUSKY ADVENTURE' WHERE slug = 'les-apprentis-montagnards';

-- P0 FIX: annecy-element standing_label
UPDATE gd_stays SET standing_label = 'Camping & Autonomie' WHERE slug = 'annecy-element';

-- VÉRIFICATION
SELECT slug, marketing_title, standing_label FROM gd_stays WHERE published = true ORDER BY carousel_group, marketing_title;
