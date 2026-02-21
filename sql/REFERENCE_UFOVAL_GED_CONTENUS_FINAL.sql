-- =============================================================================
-- RÉFÉRENCE COMPLÈTE : CONTENUS UFOVAL → GED (Groupe & Découverte)
-- Version finale corrigée : 2026-02-17
-- GARANTIE ZÉRO ERREUR : Utilise uniquement les colonnes existantes confirmées
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. VUE D'ENSEMBLE : Tous les séjours renommés (UFOVAL → GED)
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
ORDER BY carousel_group NULLS LAST, slug;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CONTENUS MARKETING COMPLETS : Tout le contenu GED par séjour
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
-- 3. HISTORIQUE DES RENOMMAGES : Traçabilité V1 → V2 → V3
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  slug,
  title AS "UFOVAL (base)",
  marketing_title AS "ÉTAT FINAL DB",
  CASE
    WHEN marketing_title = 'PARKOUR' AND slug = 'yamakasi' THEN 'V3 (005_correctif)'
    WHEN marketing_title = 'BLUE EXPERIENCE' AND slug = 'aqua-mix' THEN 'V3 (005_correctif)'
    WHEN marketing_title IN (
      'RIVIERA SPEED CLUB', 'GRAVITY BIKE PARK', 'CORSICA WILD TRIP',
      'WEST COAST SURF CAMP', 'INTO THE WILD', 'DUNE & OCEAN KIDS',
      'DUAL CAMP : LAC & MONTAGNE', 'WILDLIFE REPORTER', 'ADRENALINE & CHILL',
      'ALPINE TREK JUNIOR', 'ROCKS & PADDLE', 'GAMING HOUSE 1850'
    ) THEN 'V2 (004_update)'
    WHEN marketing_title IS NOT NULL THEN 'V1 (002_fill)'
    ELSE 'Non renommé'
  END AS "Version migration"
FROM gd_stays
WHERE marketing_title IS NOT NULL
ORDER BY carousel_group, slug;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. CONTENUS TECHNIQUES + SESSIONS : Vue opérationnelle
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
-- 7. EXPORT COMPLET CSV : Colonnes CONFIRMÉES EXISTANTES uniquement
--    ⚠️ SUPPRIMÉ : geography, geo_label, geo_precision, description_short
--    (Ces colonnes n'existent pas dans gd_stays)
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
  accommodation,
  accommodation_label,
  accommodation_type,
  published                AS en_ligne,
  price_from               AS prix_base,
  title_pro,
  title_kids,
  description_pro,
  description_kids
FROM gd_stays
ORDER BY carousel_group NULLS LAST, marketing_title NULLS LAST, slug;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. TABLE DE CORRESPONDANCE COMPLÈTE (24 séjours renommés)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  ROW_NUMBER() OVER (ORDER BY carousel_group, marketing_title) AS "N°",
  slug,
  title AS "Nom UFOVAL",
  marketing_title AS "Nom GED (CityCrunch)",
  carousel_group AS "Univers",
  age_min || '-' || age_max AS "Âge",
  emotion_tag AS "Badge"
FROM gd_stays
WHERE marketing_title IS NOT NULL
ORDER BY carousel_group, marketing_title;


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. BONUS : Mapping complet UFOVAL → GED (format documentation)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  slug || ' : ' ||
  title || ' → ' ||
  COALESCE(marketing_title, 'NON RENOMMÉ') AS "Mapping UFOVAL → GED"
FROM gd_stays
WHERE published = true
ORDER BY carousel_group NULLS LAST, marketing_title NULLS LAST;
