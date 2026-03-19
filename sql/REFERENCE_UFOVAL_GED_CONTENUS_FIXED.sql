-- =============================================================================
-- RÉFÉRENCE COMPLÈTE : CONTENUS UFOVAL → GED (Groupe & Découverte)
-- Version corrigée : 2026-02-17
-- Usage : Exécuter dans Supabase SQL Editor pour visualiser tous les contenus
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. VUE D'ENSEMBLE : Tous les séjours renommés (UFOVAL → GED)
--    Historique complet des renommages avec état final
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  slug,
  title                  AS "Nom UFOVAL (original)",
  marketing_title        AS "Nom GED (final)",
  carousel_group         AS "Univers",
  emotion_tag            AS "Badge Émotion",
  published              AS "En ligne",
  CASE
    WHEN marketing_title IS NOT NULL AND marketing_title != title THEN '✅ Renommé'
    WHEN marketing_title IS NOT NULL AND marketing_title = title THEN '⚠️ Titre identique'
    WHEN marketing_title IS NULL THEN '❌ Pas de titre GED'
  END AS "Statut renommage"
FROM gd_stays
ORDER BY
  CASE carousel_group
    WHEN 'ADRENALINE_SENSATIONS' THEN 1
    WHEN 'ALTITUDE_AVENTURE'     THEN 2
    WHEN 'AVENTURE_DECOUVERTE'   THEN 2
    WHEN 'OCEAN_FUN'             THEN 3
    WHEN 'MA_PREMIERE_COLO'      THEN 4
    ELSE 5
  END,
  slug;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CONTENUS MARKETING COMPLETS : Tout le contenu GED par séjour
--    Tous les champs premium remplis pour chaque séjour
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  slug,
  title                    AS "Titre UFOVAL",
  marketing_title          AS "Titre GED",
  punchline                AS "Punchline (H2)",
  expert_pitch             AS "Expert Pitch (body)",
  emotion_tag              AS "Badge Émotion",
  carousel_group           AS "Univers Carousel",
  spot_label               AS "Lieu (spot)",
  standing_label           AS "Standing",
  expertise_label          AS "Expertise encadrement",
  intensity_label          AS "Intensité",
  price_includes_features  AS "Inclus dans le prix (JSON)"
FROM gd_stays
WHERE marketing_title IS NOT NULL
ORDER BY carousel_group, marketing_title;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. HISTORIQUE DES RENOMMAGES : Traçabilité complète
--    Correspond aux 3 fichiers SQL de migration :
--      002_fill_premium_data_24_stays.sql (V1 initial)
--      004_update_marketing_titles.sql    (V2 renommage définitif)
--      005_rename_yamakasi_aquamix.sql    (V3 correctif)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  slug,
  title AS "UFOVAL (base)",
  -- V1 : premier marketing_title (002)
  CASE slug
    WHEN 'moto-moto'                   THEN 'MX RIDER ACADEMY'
    WHEN 'dh-experience-11-13-ans'     THEN 'DH EXPERIENCE'
    WHEN 'annecy-element'              THEN 'ALPINE SKY CAMP'
    WHEN 'sperienza-in-corsica-1'      THEN 'SPERIENZA CORSICA'
    WHEN 'surf-sur-le-bassin'          THEN 'SURF SUR LE BASSIN'
    WHEN 'destination-soleil'          THEN 'DESTINATION SOLEIL'
    WHEN 'les-robinson-des-glieres'    THEN 'SURVIVOR CAMP 74'
    WHEN 'survie-dans-le-beaufortain'  THEN 'SURVIE BEAUFORTAIN'
    WHEN 'yamakasi'                    THEN 'URBAN MOVE ACADEMY'
    WHEN 'e-sport-and-sport'           THEN 'E-SPORT & SPORT'
    WHEN 'explore-mountain'            THEN 'EXPLORE'
    WHEN 'mountain-and-chill'          THEN 'MOUNTAIN & CHILL'
    WHEN 'glieraventures'              THEN 'GLIÈRAVENTURES'
    WHEN 'nature-picture'              THEN 'NATURE PICTURE'
    WHEN 'aqua-fun'                    THEN 'AZUR DIVE & JET'
    WHEN 'aqua-mix'                    THEN 'AQUA MIX'
    WHEN 'breizh-equit-kids-8-11-ans'  THEN 'BRETAGNE OCEAN RIDE'
    WHEN 'destination-bassin-darcachon-1' THEN 'DESTINATION BASSIN'
    WHEN 'laventure-verticale'         THEN 'L''AVENTURE VERTICALE'
    WHEN 'les-ptits-puisotins-1'       THEN 'MY LITTLE FOREST'
    WHEN 'croc-marmotte'               THEN 'ALPOO KIDS'
    WHEN 'aqua-gliss'                  THEN 'BABY RIDERS'
    WHEN 'natation-et-sensation'       THEN 'SWIM ACADEMY'
    WHEN 'les-apprentis-montagnards'   THEN 'HUSKY ADVENTURE'
    ELSE NULL
  END AS "V1 (002_fill)",
  -- V2 : renommage définitif (004)
  CASE slug
    WHEN 'moto-moto'                   THEN 'MX RIDER ACADEMY'
    WHEN 'aqua-fun'                    THEN 'AZUR DIVE & JET'
    WHEN 'annecy-element'              THEN 'ALPINE SKY CAMP'
    WHEN 'destination-soleil'          THEN 'RIVIERA SPEED CLUB'
    WHEN 'dh-experience-11-13-ans'     THEN 'GRAVITY BIKE PARK'
    WHEN 'sperienza-in-corsica-1'      THEN 'CORSICA WILD TRIP'
    WHEN 'surf-sur-le-bassin'          THEN 'WEST COAST SURF CAMP'
    WHEN 'les-robinson-des-glieres'    THEN 'SURVIVOR CAMP 74'
    WHEN 'survie-dans-le-beaufortain'  THEN 'INTO THE WILD'
    WHEN 'breizh-equit-kids-8-11-ans'  THEN 'BRETAGNE OCEAN RIDE'
    WHEN 'yamakasi'                    THEN 'URBAN MOVE ACADEMY'
    WHEN 'destination-bassin-darcachon-1' THEN 'DUNE & OCEAN KIDS'
    WHEN 'glieraventures'              THEN 'DUAL CAMP : LAC & MONTAGNE'
    WHEN 'nature-picture'              THEN 'WILDLIFE REPORTER'
    WHEN 'mountain-and-chill'          THEN 'ADRENALINE & CHILL'
    WHEN 'explore-mountain'            THEN 'ALPINE TREK JUNIOR'
    WHEN 'laventure-verticale'         THEN 'ROCKS & PADDLE'
    WHEN 'e-sport-and-sport'           THEN 'GAMING HOUSE 1850'
    WHEN 'les-ptits-puisotins-1'       THEN 'MY LITTLE FOREST'
    WHEN 'croc-marmotte'               THEN 'ALPOO KIDS'
    WHEN 'aqua-gliss'                  THEN 'BABY RIDERS'
    WHEN 'natation-et-sensation'       THEN 'SWIM ACADEMY'
    WHEN 'les-apprentis-montagnards'   THEN 'HUSKY ADVENTURE'
    ELSE NULL
  END AS "V2 (004_update)",
  -- V3 : correctif yamakasi + aqua-mix (005)
  CASE slug
    WHEN 'yamakasi' THEN 'PARKOUR'
    WHEN 'aqua-mix' THEN 'BLUE EXPERIENCE'
    ELSE NULL
  END AS "V3 (005_correctif)",
  -- État final actuel en DB
  marketing_title AS "ÉTAT FINAL DB"
FROM gd_stays
WHERE marketing_title IS NOT NULL
   OR slug IN (
     'moto-moto','dh-experience-11-13-ans','annecy-element',
     'sperienza-in-corsica-1','surf-sur-le-bassin','destination-soleil',
     'les-robinson-des-glieres','survie-dans-le-beaufortain','yamakasi',
     'e-sport-and-sport','explore-mountain','mountain-and-chill',
     'glieraventures','nature-picture','aqua-fun','aqua-mix',
     'breizh-equit-kids-8-11-ans','destination-bassin-darcachon-1',
     'laventure-verticale','les-ptits-puisotins-1','croc-marmotte',
     'aqua-gliss','natation-et-sensation','les-apprentis-montagnards'
   )
ORDER BY carousel_group, slug;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. CONTENUS TECHNIQUES + SESSIONS : Vue opérationnelle
--    Séjours GED avec leurs sessions, prix et places
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  s.slug,
  s.marketing_title        AS "Titre GED",
  s.title                  AS "Titre UFOVAL",
  s.age_min || '-' || s.age_max || ' ans' AS "Tranche d'âge",
  s.duration_days || ' jours' AS "Durée",
  s.spot_label             AS "Lieu",
  ss.start_date            AS "Début session",
  ss.end_date              AS "Fin session",
  ss.seats_left            AS "Places restantes",
  sp.city_departure        AS "Ville départ",
  sp.price_ged_total       AS "Prix GED (€)",
  sp.transport_surcharge_ged AS "Surcharge transport (€)"
FROM gd_stays s
LEFT JOIN gd_stay_sessions ss ON ss.stay_slug = s.slug
LEFT JOIN gd_session_prices sp ON sp.stay_slug = s.slug AND sp.start_date = ss.start_date
WHERE s.marketing_title IS NOT NULL
  AND s.published = true
ORDER BY s.carousel_group, s.marketing_title, ss.start_date, sp.city_departure;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. AUDIT COMPLÉTUDE : Champs premium manquants
--    Identifier les trous dans le contenu GED
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  slug,
  marketing_title AS "Titre GED",
  CASE WHEN punchline IS NULL THEN '❌' ELSE '✅' END AS "Punchline",
  CASE WHEN expert_pitch IS NULL THEN '❌' ELSE '✅' END AS "Expert Pitch",
  CASE WHEN emotion_tag IS NULL THEN '❌' ELSE '✅' END AS "Émotion",
  CASE WHEN carousel_group IS NULL THEN '❌' ELSE '✅' END AS "Univers",
  CASE WHEN spot_label IS NULL THEN '❌' ELSE '✅' END AS "Spot",
  CASE WHEN standing_label IS NULL THEN '❌' ELSE '✅' END AS "Standing",
  CASE WHEN expertise_label IS NULL THEN '❌' ELSE '✅' END AS "Expertise",
  CASE WHEN intensity_label IS NULL THEN '❌' ELSE '✅' END AS "Intensité",
  CASE WHEN price_includes_features IS NULL THEN '❌' ELSE '✅' END AS "Inclus Prix"
FROM gd_stays
WHERE published = true
ORDER BY
  (CASE WHEN punchline IS NULL THEN 1 ELSE 0 END +
   CASE WHEN expert_pitch IS NULL THEN 1 ELSE 0 END +
   CASE WHEN emotion_tag IS NULL THEN 1 ELSE 0 END) DESC,
  carousel_group, marketing_title;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. SÉJOURS NON RENOMMÉS : Restés en noms UFOVAL
--    Candidats pour le prochain lot de renommage
--    ⚠️ CORRIGÉ : utilise 'programme' au lieu de 'description_short'
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  slug,
  title AS "Titre UFOVAL (non renommé)",
  LEFT(programme::text, 100) AS "Programme (extrait)",
  age_min || '-' || age_max || ' ans' AS "Tranche d'âge",
  published AS "Publié",
  CASE
    WHEN published = true THEN '⚠️ PUBLIÉ SANS NOM GED'
    ELSE 'Non publié'
  END AS "Alerte"
FROM gd_stays
WHERE marketing_title IS NULL
ORDER BY published DESC, slug;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. EXPORT COMPLET CSV-READY : Tous les champs pour tableau de bord
--    ⚠️ CORRIGÉ : supprimé 'description_short', ajouté 'programme'
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  slug,
  title                    AS titre_ufoval,
  marketing_title          AS titre_ged,
  punchline,
  expert_pitch,
  emotion_tag,
  carousel_group           AS univers,
  spot_label               AS lieu,
  standing_label           AS standing,
  expertise_label          AS expertise,
  intensity_label          AS intensite,
  price_includes_features::text AS inclus_prix,
  LEFT(programme::text, 200) AS programme_extrait,
  age_min,
  age_max,
  duration_days            AS duree_jours,
  geography                AS geo,
  geo_label,
  geo_precision,
  accommodation,
  accommodation_label,
  accommodation_type,
  published                AS en_ligne,
  price_from               AS prix_base
FROM gd_stays
ORDER BY carousel_group NULLS LAST, marketing_title NULLS LAST, slug;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. BONUS : TABLE DE CORRESPONDANCE COMPLÈTE (24 séjours)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  ROW_NUMBER() OVER (ORDER BY carousel_group, marketing_title) AS "N°",
  slug,
  title AS "Nom UFOVAL",
  marketing_title AS "Nom GED (CityCrunch)",
  carousel_group AS "Univers",
  age_min || '-' || age_max AS "Âge"
FROM gd_stays
WHERE marketing_title IS NOT NULL
ORDER BY carousel_group, marketing_title;
