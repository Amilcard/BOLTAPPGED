-- ============================================
-- DATA FILL: 24 séjours – Champs Premium Marketing
-- Source de vérité: brief Univers + Tranche d'âge
-- Règle: aucun champ affiché Home ne doit rester NULL
-- ============================================

-- ========================
-- UNIVERS 1: ADRÉNALINE & SENSATIONS (12-17 ans)
-- ========================

-- LOT 3 CityCrunch — MX RIDER ACADEMY (ex: Moto Moto)
UPDATE gd_stays SET
  marketing_title = 'MX RIDER ACADEMY',
  punchline = 'Stage Pilotage VIP : Circuit privé, Mécanique et Piscine.',
  expert_pitch = 'Oublie la console. Ici, ça sent l''essence, la poussière et la liberté. Tu enfourches de vraies bécanes de cross sur un circuit privé, rien que pour ton groupe. Tu apprends à piloter : accél, freinage, équilibre en saut. Tu mets les mains dans le cambouis pour l''entretien. Le soir : piscine chauffée. Intense, physique, classe.',
  emotion_tag = 'MÉCANIQUE',
  carousel_group = 'ADRENALINE_SENSATIONS',
  spot_label = 'Haute-Savoie - Les Carroz',
  standing_label = 'Centre avec Piscine',
  expertise_label = 'Moniteurs Brevet d''État',
  intensity_label = 'Intense & Technique',
  price_includes_features = '["Coût Technique Inclus : motos + carburant + entretien + protections", "Sécurité Maximale : BE Moto sur terrain homologué", "Standing : hébergement avec piscine"]'::jsonb
WHERE slug = 'moto-moto';

UPDATE gd_stays SET
  marketing_title = 'DH EXPERIENCE',
  punchline = 'VTT descente, jumps & adrénaline en montagne.',
  emotion_tag = 'SPORT',
  carousel_group = 'ADRENALINE_SENSATIONS',
  spot_label = 'Haute-Savoie - Les Glières',
  standing_label = 'Centre en pleine nature',
  expertise_label = 'Moniteurs VTT Diplômés',
  intensity_label = 'Intense & Engagé',
  price_includes_features = '["VTT & casque fournis", "Encadrement moniteur", "Navettes remontées"]'::jsonb
WHERE slug = 'dh-experience-11-13-ans';

-- LOT 3 CityCrunch — ALPINE SKY CAMP (ex: Annecy Elément) — P0 FIX: standing = Camping
UPDATE gd_stays SET
  marketing_title = 'ALPINE SKY CAMP',
  punchline = 'Le grand saut : Parapente au-dessus du lac, Camping et Canyoning.',
  expert_pitch = 'Le lac d''Annecy vu du ciel, ça se mérite. Et ça se vit ici. Ce séjour est un concentré de sensations verticales : on décolle en parapente biplace au-dessus du lac, on descend des cascades en canyoning, on grimpe des parois en via ferrata. Et le soir ? On plante la tente en mode camping tribu, loin du béton. Ce n''est pas une colo, c''est un camp de base pour ceux qui veulent se prouver qu''ils peuvent tout faire. Standing sobre (camping), expériences riches.',
  emotion_tag = 'AÉRIEN',
  carousel_group = 'ADRENALINE_SENSATIONS',
  spot_label = 'Haute-Savoie - Lac d''Annecy',
  standing_label = 'Camping & Autonomie',
  expertise_label = 'Pilote Parapente BE + Guide Canyon',
  intensity_label = 'Intense & Aérien',
  price_includes_features = '["Coût Technique Inclus : vol parapente biplace + canyoning + via ferrata", "Expertise Air : pilote Brevet d''État + guide canyon certifié", "Immersion Nature : camping encadré, vie collective"]'::jsonb
WHERE slug = 'annecy-element';

UPDATE gd_stays SET
  marketing_title = 'SPERIENZA CORSICA',
  punchline = 'Corse VIP : Plongée, Voile & Canyoning.',
  emotion_tag = 'AVENTURE',
  carousel_group = 'ADRENALINE_SENSATIONS',
  spot_label = 'Haute-Corse - Saint-Florent',
  standing_label = 'Camping aménagé',
  expertise_label = 'Moniteurs Plongée & Montagne',
  intensity_label = 'Exploration totale',
  price_includes_features = '["Traversée Corse incluse", "Activités mer & montagne", "Transports sur l''île"]'::jsonb
WHERE slug = 'sperienza-in-corsica-1';

UPDATE gd_stays SET
  marketing_title = 'SURF SUR LE BASSIN',
  punchline = 'Surf, bodyboard & glisse sur les spots du Bassin.',
  emotion_tag = 'GLISSE',
  carousel_group = 'ADRENALINE_SENSATIONS',
  spot_label = 'Gironde - Bassin d''Arcachon',
  standing_label = 'Centre bord de mer',
  expertise_label = 'Moniteurs Surf Diplômés',
  intensity_label = 'Glisse & Fun',
  price_includes_features = '["Combinaison & planche fournies", "Cours collectifs quotidiens", "Encadrement qualifié"]'::jsonb
WHERE slug = 'surf-sur-le-bassin';

UPDATE gd_stays SET
  marketing_title = 'DESTINATION SOLEIL',
  punchline = 'Kitesurf, wakeboard & vitesse au soleil.',
  emotion_tag = 'VITESSE',
  carousel_group = 'ADRENALINE_SENSATIONS',
  spot_label = 'Hérault - Méditerranée',
  standing_label = 'Centre littoral',
  expertise_label = 'Moniteurs Sports Nautiques',
  intensity_label = 'Dynamique & Solaire',
  price_includes_features = '["Matériel nautique fourni", "Moniteurs diplômés", "Accès plage quotidien"]'::jsonb
WHERE slug = 'destination-soleil';

-- ========================
-- UNIVERS 2: ALTITUDE & AVENTURE (8-15 ans)
-- ========================

-- LOT 2 CityCrunch — SURVIVOR CAMP 74 (ex: Robinson des Glières)
UPDATE gd_stays SET
  marketing_title = 'SURVIVOR CAMP 74',
  punchline = 'Apprendre à survivre : Cabanes, Orientation et Nuit sous les étoiles.',
  expert_pitch = 'Avis aux apprentis aventuriers ! Ici, pas de 4G, mais une connexion haut débit avec la nature. On marche sur les traces de Robinson pour apprendre à se débrouiller : construire un abri étanche (le test du seau d''eau est impitoyable !), s''orienter sans Google Maps et allumer un feu de camp sécurisé. L''aboutissement ? Une nuit en bivouac, préparée et gérée par les enfants eux-mêmes. C''est l''école de l''autonomie, où l''on apprend que le confort, ça se mérite et ça se construit ensemble.',
  emotion_tag = 'SURVIE',
  carousel_group = 'ALTITUDE_AVENTURE',
  spot_label = 'Haute-Savoie - Plateau des Glières',
  standing_label = 'Centre Dur + Bivouac',
  expertise_label = 'Guides Montagne (AMM)',
  intensity_label = 'Aventure & Autonomie',
  price_includes_features = '["Expertise Montagne : AMM spécialisés survie", "Pédagogie Autonomie : valorisation par le faire", "Sécurité Bivouac : matériel fourni + repli assuré"]'::jsonb
WHERE slug = 'les-robinson-des-glieres';

UPDATE gd_stays SET
  marketing_title = 'SURVIE BEAUFORTAIN',
  punchline = 'Techniques de survie & nature sauvage en Beaufortain.',
  emotion_tag = 'SURVIE',
  carousel_group = 'ALTITUDE_AVENTURE',
  spot_label = 'Savoie - Beaufortain',
  standing_label = 'Refuge & Bivouac',
  expertise_label = 'Guides Survie & Montagne',
  intensity_label = 'Intense & Immersif',
  price_includes_features = '["Matériel bivouac complet", "Ateliers survie quotidiens", "Encadrement guides"]'::jsonb
WHERE slug = 'survie-dans-le-beaufortain';

-- LOT 2 CityCrunch — URBAN MOVE ACADEMY (ex: Yamakasi)
UPDATE gd_stays SET
  marketing_title = 'URBAN MOVE ACADEMY',
  punchline = 'L''Art du Déplacement : Franchir les obstacles avec les pros de l''ADD Academy.',
  expert_pitch = 'Tu veux bouger comme dans les films ? Apprends à le faire pour de vrai, sans te casser. Avec les coachs de l''ADD Academy, le mobilier urbain et la nature deviennent un terrain de jeu. On apprend la précision, la réception, le flow. Sport exigeant mentalement : motricité fine et respect du corps et de l''environnement.',
  emotion_tag = 'URBAIN',
  carousel_group = 'ALTITUDE_AVENTURE',
  spot_label = 'Savoie (73) - Courchevel',
  standing_label = 'Centre Vacances',
  expertise_label = 'Experts ADD Academy',
  intensity_label = 'Dynamique & Créatif',
  price_includes_features = '["Partenariat : intervenants ADD Academy", "Sécurité Active : chute + évaluation risque", "Matériel : modules + tapis réception pro"]'::jsonb
WHERE slug = 'yamakasi';

UPDATE gd_stays SET
  marketing_title = 'E-SPORT & SPORT',
  punchline = 'Gaming, e-sport & activités sportives : le combo parfait.',
  emotion_tag = 'GAMING',
  carousel_group = 'ALTITUDE_AVENTURE',
  spot_label = 'Haute-Savoie - Les Glières',
  standing_label = 'Centre multimédia & sport',
  expertise_label = 'Animateurs Gaming & Sport',
  intensity_label = 'Mixte & Fun',
  price_includes_features = '["Salle gaming équipée", "Tournois e-sport", "Activités sportives variées"]'::jsonb
WHERE slug = 'e-sport-and-sport';

UPDATE gd_stays SET
  marketing_title = 'EXPLORE',
  punchline = 'Randonnée, orientation & découverte de la montagne.',
  emotion_tag = 'EXPLORATION',
  carousel_group = 'ALTITUDE_AVENTURE',
  spot_label = 'Haute-Savoie - Massif des Glières',
  standing_label = 'Centre montagne',
  expertise_label = 'Accompagnateurs Montagne',
  intensity_label = 'Progressif & Nature',
  price_includes_features = '["Randonnées encadrées", "Matériel rando fourni", "Veillées nature"]'::jsonb
WHERE slug = 'explore-mountain';

UPDATE gd_stays SET
  marketing_title = 'MOUNTAIN & CHILL',
  punchline = 'Montagne décontractée : rando, baignade & détente.',
  emotion_tag = 'MIXTE',
  carousel_group = 'ALTITUDE_AVENTURE',
  spot_label = 'Haute-Savoie',
  standing_label = 'Centre confort',
  expertise_label = 'Animateurs Polyvalents',
  intensity_label = 'Cool & Détendu',
  price_includes_features = '["Activités au choix", "Rythme adapté ados", "Sorties baignade"]'::jsonb
WHERE slug = 'mountain-and-chill';

UPDATE gd_stays SET
  marketing_title = 'GLIÈRAVENTURES',
  punchline = 'Multi-activités montagne pour les explorateurs en herbe.',
  emotion_tag = 'DYNAMIQUE',
  carousel_group = 'ALTITUDE_AVENTURE',
  spot_label = 'Haute-Savoie - Plateau des Glières',
  standing_label = 'Centre nature',
  expertise_label = 'Animateurs Multi-Activités',
  intensity_label = 'Dynamique & Varié',
  price_includes_features = '["Multi-activités incluses", "Encadrement renforcé", "Matériel fourni"]'::jsonb
WHERE slug = 'glieraventures';

UPDATE gd_stays SET
  marketing_title = 'NATURE PICTURE',
  punchline = 'Photo nature, art & exploration en montagne.',
  emotion_tag = 'ART & NATURE',
  carousel_group = 'ALTITUDE_AVENTURE',
  spot_label = 'Haute-Savoie - Les Glières',
  standing_label = 'Centre créatif & nature',
  expertise_label = 'Photographes & Animateurs Nature',
  intensity_label = 'Créatif & Contemplatif',
  price_includes_features = '["Appareil photo prêté", "Ateliers photo quotidiens", "Sorties nature encadrées"]'::jsonb
WHERE slug = 'nature-picture';

-- ========================
-- UNIVERS 3: HORIZON OCÉAN & FUN (7-14 ans)
-- ========================

-- LOT 3 CityCrunch — AZUR DIVE & JET (ex: Aqua Fun)
UPDATE gd_stays SET
  marketing_title = 'AZUR DIVE & JET',
  punchline = 'Le Programme VIP : Plongée, Jet-Ski et virée à St-Tropez.',
  expert_pitch = 'Le Golfe de Saint-Tropez, ce n''est pas juste pour les yachts. C''est un terrain de jeu nautique incroyable pour les ados qui veulent du lourd. Au programme : baptême de plongée pour toucher les poissons sans aquarium, sessions Jet-Ski encadrées pour sentir la vitesse, et journée à Aqualand pour se lâcher sur les toboggans. Le bonus : accès direct à la mer via un tunnel privé (zéro route à traverser). C''est les vacances version premium, les pieds dans l''eau et l''adrénaline en intraveineuse.',
  emotion_tag = 'NAUTIQUE',
  carousel_group = 'ADRENALINE_SENSATIONS',
  spot_label = 'Var - Golfe de St Tropez',
  standing_label = 'Accès Mer Direct (Tunnel)',
  expertise_label = 'MF Plongée + MNS + Permis Jet',
  intensity_label = 'Premium & Nautique',
  price_includes_features = '["Coût Technique Inclus : baptême plongée + Jet-Ski + Aqualand", "Sécurité Mer : MF Plongée + MNS + tunnel privatif", "Standing : accès plage privé, cadre Golfe de St Tropez"]'::jsonb
WHERE slug = 'aqua-fun';

UPDATE gd_stays SET
  marketing_title = 'AQUA MIX',
  punchline = 'Découverte mer, plage & activités variées.',
  emotion_tag = 'DÉCOUVERTE',
  carousel_group = 'OCEAN_FUN',
  spot_label = 'Finistère - Littoral breton',
  standing_label = 'Centre bord de mer',
  expertise_label = 'Animateurs Multi-Activités',
  intensity_label = 'Doux & Varié',
  price_includes_features = '["Activités mer & terre", "Découverte faune marine", "Sorties plage"]'::jsonb
WHERE slug = 'aqua-mix';

-- LOT 2 CityCrunch — BRETAGNE OCEAN RIDE (ex: Breizh Equit')
UPDATE gd_stays SET
  marketing_title = 'BRETAGNE OCEAN RIDE',
  punchline = 'Vivre au rythme de l''écurie : Soins, Galop sur la plage et Vie de château.',
  expert_pitch = 'Ce n''est pas juste "faire du poney une heure par jour". C''est vivre avec eux. On apprend à parler cheval : le pansage, la nourriture, la communication non-verbale. Le rêve devient réalité lors des balades sur la plage du Finistère, crinière au vent. Et parce qu''on est en Bretagne, on ne rate pas la pêche à pied et les veillées crêpes au coin du feu. C''est un séjour passion, intense et iodé, pour ceux qui ont des posters de chevaux plein leur chambre.',
  emotion_tag = 'PASSION',
  carousel_group = 'OCEAN_FUN',
  spot_label = 'Finistère (29) - Plozévet',
  standing_label = 'Centre Vacances Océan',
  expertise_label = 'Moniteurs Équitation BE',
  intensity_label = 'Passion & Nature',
  price_includes_features = '["Médiation Animale : canaliser énergie / vaincre timidité", "Cavalerie Adaptée : centre équestre labellisé", "Cadre Océan : hébergement bord de mer, accès sentiers"]'::jsonb
WHERE slug = 'breizh-equit-kids-8-11-ans';

UPDATE gd_stays SET
  marketing_title = 'DESTINATION BASSIN',
  punchline = 'Nature, découverte & aventures sur le Bassin d''Arcachon.',
  emotion_tag = 'NATURE',
  carousel_group = 'OCEAN_FUN',
  spot_label = 'Gironde - Bassin d''Arcachon',
  standing_label = 'Centre nature & mer',
  expertise_label = 'Animateurs Nature & Mer',
  intensity_label = 'Découverte & Douceur',
  price_includes_features = '["Sorties nature quotidiennes", "Découverte ostréiculture", "Baignade surveillée"]'::jsonb
WHERE slug = 'destination-bassin-darcachon-1';

UPDATE gd_stays SET
  marketing_title = 'L''AVENTURE VERTICALE',
  punchline = 'Escalade, accrobranche & défis en bord de mer.',
  emotion_tag = 'ACTION',
  carousel_group = 'OCEAN_FUN',
  spot_label = 'Finistère - Côte bretonne',
  standing_label = 'Centre sportif littoral',
  expertise_label = 'Moniteurs Escalade BE',
  intensity_label = 'Actif & Engagé',
  price_includes_features = '["Escalade & accrobranche inclus", "Matériel sécurité fourni", "Encadrement diplômé"]'::jsonb
WHERE slug = 'laventure-verticale';

-- ========================
-- UNIVERS 4: MA PREMIÈRE COLO (3-9 ans)
-- ========================

-- LOT 1 CityCrunch — MY LITTLE FOREST (ex: Les P'tits Puisotins)
UPDATE gd_stays SET
  marketing_title = 'MY LITTLE FOREST',
  punchline = 'La Forêt Magique : Poneys, Cabanes et Histoires du soir.',
  expert_pitch = 'Bienvenue au paradis des tout-petits ! Ici, on quitte maman et papa pour la première fois, alors on a mis le paquet sur la douceur. Au cœur de la forêt du Semnoz, le rythme est calé sur l''horloge biologique des enfants (oui, la sieste est sacrée !). Au programme : devenir copain avec les poneys, construire des cabanes de lutins et grimper aux arbres en sécurité absolue. C''est l''aventure à hauteur de 3 pommes, avec une équipe qui sait gérer les doudous perdus et les lacets défaits.',
  emotion_tag = 'DOUCEUR',
  carousel_group = 'MA_PREMIERE_COLO',
  spot_label = 'Haute-Savoie - Forêt du Semnoz',
  standing_label = 'Centre Petite Enfance « Les Puisots »',
  expertise_label = 'Encadrement Nursing (taux très élevé)',
  intensity_label = 'Doux & Rassurant',
  price_includes_features = '["Encadrement Nursing : taux très élevé (toilette, habillage, repas)", "Structure Maternelle : centre adapté aux -6 ans (mobilier, sanitaires)", "Rythme Biologique : alternance stricte jeux moteurs / temps calmes"]'::jsonb
WHERE slug = 'les-ptits-puisotins-1';

-- LOT 1 CityCrunch — ALPOO KIDS (ex: Croc' Marmotte)
UPDATE gd_stays SET
  marketing_title = 'ALPOO KIDS',
  punchline = 'Première fois : Marmottes, Confitures et Piscine.',
  expert_pitch = 'La montagne, ce n''est pas que pour les skieurs de l''extrême ! Ce séjour, c''est la version "douce" des Alpes. On part en balade facile pour siffler avec les marmottes, on caresse les lapins de la ferme pédagogique et on joue aux petits chefs en fabriquant sa propre confiture (fierté garantie au retour !). Et parce que c''est les vacances, on finit la journée à la piscine. C''est le séjour idéal pour un premier départ sans le vertige, juste avec des étoiles dans les yeux.',
  emotion_tag = 'COCOONING',
  carousel_group = 'MA_PREMIERE_COLO',
  spot_label = 'Savoie - Beaufortain',
  standing_label = 'Centre montagne apaisant',
  expertise_label = 'Gestion éloignement + lien famille',
  intensity_label = 'Doux & Nature',
  price_includes_features = '["Gestion de l''éloignement : équipe formée pour le cafard du soir + lien famille", "Activités Sensorielles : toucher/goût/vue, top développement cognitif", "Cadre Apaisant : Beaufortain calme, loin grandes stations"]'::jsonb
WHERE slug = 'croc-marmotte';

-- LOT 1 CityCrunch — BABY RIDERS (ex: Aqua' Gliss)
UPDATE gd_stays SET
  marketing_title = 'BABY RIDERS',
  punchline = 'Premières Vagues : Baby Kayak et Canapé Flottant.',
  expert_pitch = 'Qui a dit que les petits ne pouvaient pas glisser ? Aux Issambres, on a adapté les sports nautiques pour les 7-8 ans. Pas de peur, que du fun ! On embarque sur des Baby Kayaks insubmersibles pour apprendre à ramer, et on teste le fameux Canapé Tracté (un gros fauteuil tiré par un bateau à vitesse lente). Entre deux ploufs, c''est châteaux de sable et baignades surveillées. C''est l''intro parfaite avant de passer aux séjours ados dans quelques années.',
  emotion_tag = 'EAU CALME',
  carousel_group = 'MA_PREMIERE_COLO',
  spot_label = 'Var - Les Issambres',
  standing_label = 'Centre bord de mer (accès tunnel privé)',
  expertise_label = 'SB + animateurs nautiques petite taille',
  intensity_label = 'Doux & Aquatique',
  price_includes_features = '["Sécurité Absolue : accès mer via tunnel privé (aucune route)", "Matériel Adapté : embarcations + gilets petites tailles", "Encadrement Baignade : SB + animateurs"]'::jsonb
WHERE slug = 'aqua-gliss';

-- LOT 1 CityCrunch — SWIM ACADEMY (ex: Natation & Sensation)
UPDATE gd_stays SET
  marketing_title = 'SWIM ACADEMY',
  punchline = 'Objectif Poisson : Apprendre à nager avec un Maître Nageur.',
  expert_pitch = 'Savoir nager, c''est le passeport pour la liberté (et la tranquillité des parents !). Objectif : 5 vraies séances techniques avec un Maître Nageur Sauveteur (MNS) pour ne plus avoir peur de mettre la tête sous l''eau ou pour perfectionner sa brasse. Mais attention, on n''est pas à l''école ! Après l''effort, le réconfort : direction la Grande Roue de Saint-Raphaël et la plage pour jouer avec les copains. On rentre grandi, et fier.',
  emotion_tag = 'APPRENTISSAGE',
  carousel_group = 'MA_PREMIERE_COLO',
  spot_label = 'Var - Saint-Raphaël',
  standing_label = 'Centre en dur « Les Colombes »',
  expertise_label = 'MNS diplômé d''État (cours inclus)',
  intensity_label = 'Progressif & Fun',
  price_includes_features = '["Prestation Technique : cours par MNS diplômé d''État", "Compétence Vitale : investissement sécurité future", "Cadre Confort : centre en dur (Les Colombes), rassurant"]'::jsonb
WHERE slug = 'natation-et-sensation';

-- LOT 1 CityCrunch — HUSKY ADVENTURE (ex: Les Apprentis Montagnards)
UPDATE gd_stays SET
  marketing_title = 'HUSKY ADVENTURE',
  punchline = 'L''ami des bêtes : Chiens de traîneau et Piscine chauffée.',
  expert_pitch = 'Tu aimes les animaux plus que tout ? Ce séjour est pour toi. La star ici, c''est le chien de traîneau ! Tu vas faire de la cani-rando : tu marches, relié au chien par une ceinture, et c''est lui qui t''aide à avancer. Une connexion magique se crée avec l''animal. Pour varier les plaisirs, on t''initie à l''escalade (sur des petits rochers faciles) et on profite de la piscine chauffée du centre. Un cocktail parfait de nature et de câlins canins.',
  emotion_tag = 'ANIMAUX',
  carousel_group = 'MA_PREMIERE_COLO',
  spot_label = 'Haute-Savoie - Massif des Glières',
  standing_label = 'Centre « Creil''Alpes » + piscine chauffée',
  expertise_label = 'Musher pro + Moniteur Escalade BE',
  intensity_label = 'Doux & Découverte',
  price_includes_features = '["Médiation Animale : musher pro, idéal introvertis/hyperactifs", "Diversité Technique : escalade BE + activité canine", "Standing Hébergement : Creil''Alpes + piscine chauffée"]'::jsonb
WHERE slug = 'les-apprentis-montagnards';

-- ========================
-- VÉRIFICATION FINALE
-- ========================
SELECT slug, marketing_title, emotion_tag, carousel_group, spot_label, standing_label
FROM gd_stays
WHERE published = true
ORDER BY carousel_group, slug;
