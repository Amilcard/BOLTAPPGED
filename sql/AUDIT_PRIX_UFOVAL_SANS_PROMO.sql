-- =============================================================================
-- AUDIT : Vérification prix UFOVAL = prix normaux (AUCUNE RÉDUCTION)
-- Date: 2026-02-22
-- Objectif: S'assurer que les prix base UFOVAL ne contiennent PAS de promo/réduction
-- Rappel règle: price_ged_total = base_price_eur + markup_durée + transport_surcharge_ged
--   Markup 7j: +180€ | Markup 14j: +240€ | Markup 21j: +410€
--   Transport GED: transport_surcharge_ufoval + 18€
--   AUCUNE réduction ne doit apparaître
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PRIX UFOVAL PAR SÉJOUR ET DURÉE (sans_transport = prix de base pur)
--    Vérifier que les prix UFOVAL sont cohérents et sans promo
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  sp.stay_slug,
  s.marketing_title AS "Titre GED",
  (sp.end_date::date - sp.start_date::date) + 1 AS duree_jours,
  sp.base_price_eur AS "Prix base UFOVAL",
  sp.price_ged_total AS "Prix GED total",
  sp.transport_surcharge_ufoval AS "Transport UFOVAL",
  sp.transport_surcharge_ged AS "Transport GED",
  sp.price_ged_total - sp.base_price_eur - COALESCE(sp.transport_surcharge_ged, 0) AS "Markup calculé",
  CASE
    WHEN sp.city_departure = 'sans_transport' THEN
      CASE
        WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 5 AND 8
          AND sp.price_ged_total - sp.base_price_eur = 180
        THEN '✅ Markup 180€ correct (7j)'
        WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 11 AND 15
          AND sp.price_ged_total - sp.base_price_eur = 240
        THEN '✅ Markup 240€ correct (14j)'
        WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 18 AND 22
          AND sp.price_ged_total - sp.base_price_eur = 410
        THEN '✅ Markup 410€ correct (21j)'
        ELSE '⚠️ MARKUP À VÉRIFIER'
      END
    ELSE
      CASE
        WHEN sp.transport_surcharge_ged - sp.transport_surcharge_ufoval = 18
        THEN '✅ Marge transport 18€ OK'
        WHEN sp.transport_surcharge_ged IS NULL
        THEN '❌ Transport GED MANQUANT'
        ELSE '⚠️ Marge transport ≠ 18€'
      END
  END AS "Statut"
FROM gd_session_prices sp
JOIN gd_stays s ON s.slug = sp.stay_slug
WHERE sp.stay_slug IN (
  'aqua-fun', 'aqua-gliss', 'aqua-mix', 'destination-bassin-darcachon-1',
  'dh-experience-11-13-ans', 'natation-et-sensation', 'laventure-verticale',
  'les-ptits-puisotins-1'
)
ORDER BY sp.stay_slug, duree_jours, sp.city_departure;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. VÉRIFICATION FORMULE : price_ged_total doit être EXACTEMENT
--    base_price_eur + markup + transport_surcharge_ged (SANS aucune promo !)
-- ─────────────────────────────────────────────────────────────────────────────
WITH prix_attendu AS (
  SELECT
    sp.stay_slug,
    s.marketing_title,
    sp.start_date,
    sp.end_date,
    sp.city_departure,
    sp.base_price_eur,
    (sp.end_date::date - sp.start_date::date) + 1 AS duree_jours,
    sp.transport_surcharge_ged,
    sp.price_ged_total AS prix_actuel,

    -- Calcul prix attendu SANS PROMO
    sp.base_price_eur
      + CASE
          WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 5 AND 8 THEN 180
          WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 11 AND 15 THEN 240
          WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 18 AND 22 THEN 410
          ELSE 0
        END
      + COALESCE(sp.transport_surcharge_ged, 0)
    AS prix_attendu_sans_promo,

    -- Calcul prix avec promo 5% (NE DEVRAIT PAS MATCHER si pas de promo)
    ROUND((sp.base_price_eur
      + CASE
          WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 5 AND 8 THEN 180
          WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 11 AND 15 THEN 240
          WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 18 AND 22 THEN 410
          ELSE 0
        END
      + COALESCE(sp.transport_surcharge_ged, 0)
    ) * 0.95) AS prix_avec_promo_5pct

  FROM gd_session_prices sp
  JOIN gd_stays s ON s.slug = sp.stay_slug
  WHERE sp.stay_slug IN (
    'aqua-fun', 'aqua-gliss', 'aqua-mix', 'destination-bassin-darcachon-1',
    'dh-experience-11-13-ans', 'natation-et-sensation', 'laventure-verticale',
    'les-ptits-puisotins-1'
  )
)
SELECT
  stay_slug,
  marketing_title,
  duree_jours,
  city_departure,
  base_price_eur AS "Prix UFOVAL",
  transport_surcharge_ged AS "Transport GED",
  prix_actuel AS "Prix actuel en DB",
  prix_attendu_sans_promo AS "Prix attendu SANS promo",
  prix_avec_promo_5pct AS "Prix si promo 5% (NE DOIT PAS)",
  CASE
    WHEN prix_actuel = prix_attendu_sans_promo
    THEN '✅ PRIX NORMAL (sans promo)'
    WHEN prix_actuel = prix_avec_promo_5pct
    THEN '🔴 ALERTE : PRIX AVEC PROMO 5% DÉTECTÉE !'
    WHEN ABS(prix_actuel - prix_attendu_sans_promo) <= 2
    THEN '⚠️ Écart mineur (arrondi ?)'
    ELSE '❌ PRIX INCOHÉRENT'
  END AS "Statut"
FROM prix_attendu
ORDER BY
  CASE
    WHEN prix_actuel = prix_avec_promo_5pct THEN 1  -- Promo détectée → en premier
    WHEN prix_actuel != prix_attendu_sans_promo THEN 2  -- Incohérent
    ELSE 3  -- OK
  END,
  stay_slug, duree_jours, city_departure;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RÉSUMÉ : Combien de lignes avec promo vs sans promo ?
-- ─────────────────────────────────────────────────────────────────────────────
WITH verification AS (
  SELECT
    sp.stay_slug,
    sp.base_price_eur,
    sp.price_ged_total,
    sp.transport_surcharge_ged,
    (sp.end_date::date - sp.start_date::date) + 1 AS duree_jours,

    sp.base_price_eur
      + CASE
          WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 5 AND 8 THEN 180
          WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 11 AND 15 THEN 240
          WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 18 AND 22 THEN 410
          ELSE 0
        END
      + COALESCE(sp.transport_surcharge_ged, 0)
    AS prix_sans_promo,

    ROUND((sp.base_price_eur
      + CASE
          WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 5 AND 8 THEN 180
          WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 11 AND 15 THEN 240
          WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 18 AND 22 THEN 410
          ELSE 0
        END
      + COALESCE(sp.transport_surcharge_ged, 0)
    ) * 0.95) AS prix_promo_5pct

  FROM gd_session_prices sp
  WHERE sp.stay_slug IN (
    'aqua-fun', 'aqua-gliss', 'aqua-mix', 'destination-bassin-darcachon-1',
    'dh-experience-11-13-ans', 'natation-et-sensation', 'laventure-verticale',
    'les-ptits-puisotins-1'
  )
)
SELECT
  COUNT(*) FILTER (WHERE price_ged_total = prix_sans_promo) AS "✅ Prix normaux (sans promo)",
  COUNT(*) FILTER (WHERE price_ged_total = prix_promo_5pct) AS "🔴 Prix avec promo 5%",
  COUNT(*) FILTER (WHERE price_ged_total != prix_sans_promo AND price_ged_total != prix_promo_5pct) AS "❌ Prix incohérents",
  COUNT(*) AS "Total lignes prix"
FROM verification;
