-- =============================================================================
-- AUDIT COMPLET : Markups durée + Transport pour les 24 séjours
-- Date: 2026-02-22
-- Vérifie : markup durée (180/240/410) + marge transport (18€) par séjour
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. MARKUPS PAR DURÉE PAR SÉJOUR (prix sans_transport uniquement)
--    Formule : markup = price_ged_total - base_price_eur (car transport = 0)
--    Attendu : 7j→180€ | 12-14j→240€ | 19-21j→410€
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  sp.stay_slug,
  s.marketing_title AS "Titre GED",
  (sp.end_date::date - sp.start_date::date) + 1 AS "Durée (jours)",
  COUNT(*) AS "Nb sessions",
  MIN(sp.base_price_eur) AS "Prix UFOVAL min",
  MAX(sp.base_price_eur) AS "Prix UFOVAL max",
  MIN(sp.price_ged_total) AS "Prix GED min",
  MAX(sp.price_ged_total) AS "Prix GED max",
  MIN(sp.price_ged_total - sp.base_price_eur) AS "Markup min",
  MAX(sp.price_ged_total - sp.base_price_eur) AS "Markup max",
  CASE
    WHEN MIN(sp.price_ged_total - sp.base_price_eur) = MAX(sp.price_ged_total - sp.base_price_eur)
    THEN (MIN(sp.price_ged_total - sp.base_price_eur))::text || '€'
    ELSE MIN(sp.price_ged_total - sp.base_price_eur)::text || '-' || MAX(sp.price_ged_total - sp.base_price_eur)::text || '€'
  END AS "Markup réel",
  CASE
    WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 5 AND 8 THEN '180€'
    WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 11 AND 15 THEN '240€'
    WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 18 AND 22 THEN '410€'
    ELSE '0€ (hors tranche)'
  END AS "Markup attendu",
  CASE
    WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 5 AND 8
      AND MIN(sp.price_ged_total - sp.base_price_eur) = 180
      AND MAX(sp.price_ged_total - sp.base_price_eur) = 180
    THEN '✅ 180€ OK'
    WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 11 AND 15
      AND MIN(sp.price_ged_total - sp.base_price_eur) = 240
      AND MAX(sp.price_ged_total - sp.base_price_eur) = 240
    THEN '✅ 240€ OK'
    WHEN (sp.end_date::date - sp.start_date::date) + 1 BETWEEN 18 AND 22
      AND MIN(sp.price_ged_total - sp.base_price_eur) = 410
      AND MAX(sp.price_ged_total - sp.base_price_eur) = 410
    THEN '✅ 410€ OK'
    ELSE '⚠️ À VÉRIFIER'
  END AS "Statut"
FROM gd_session_prices sp
JOIN gd_stays s ON s.slug = sp.stay_slug
WHERE sp.city_departure = 'sans_transport'
GROUP BY sp.stay_slug, s.marketing_title, (sp.end_date::date - sp.start_date::date) + 1
ORDER BY sp.stay_slug, "Durée (jours)";


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. MARGE TRANSPORT 18€ PAR SÉJOUR (toutes villes sauf sans_transport)
--    Formule : marge = transport_surcharge_ged - transport_surcharge_ufoval
--    Attendu : 18€ partout
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  sp.stay_slug,
  s.marketing_title AS "Titre GED",
  COUNT(DISTINCT sp.city_departure) AS "Nb villes",
  MIN(sp.transport_surcharge_ged - sp.transport_surcharge_ufoval) AS "Marge min",
  MAX(sp.transport_surcharge_ged - sp.transport_surcharge_ufoval) AS "Marge max",
  CASE
    WHEN MIN(sp.transport_surcharge_ged - sp.transport_surcharge_ufoval) = 18
      AND MAX(sp.transport_surcharge_ged - sp.transport_surcharge_ufoval) = 18
    THEN '✅ Marge 18€ uniforme'
    WHEN MIN(sp.transport_surcharge_ged - sp.transport_surcharge_ufoval) IS NULL
    THEN '❌ TRANSPORT GED MANQUANT'
    ELSE '⚠️ Marge variable !'
  END AS "Statut transport"
FROM gd_session_prices sp
JOIN gd_stays s ON s.slug = sp.stay_slug
WHERE sp.city_departure != 'sans_transport'
GROUP BY sp.stay_slug, s.marketing_title
ORDER BY sp.stay_slug;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RÉSUMÉ GLOBAL : Markup + Transport par séjour (vue consolidée)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  sp.stay_slug,
  s.marketing_title AS "Titre GED",
  STRING_AGG(DISTINCT ((sp.end_date::date - sp.start_date::date) + 1)::text, ', '
    ORDER BY ((sp.end_date::date - sp.start_date::date) + 1)::text) AS "Durées",
  STRING_AGG(DISTINCT
    CASE
      WHEN sp.city_departure = 'sans_transport'
      THEN ((sp.end_date::date - sp.start_date::date) + 1)::text || 'j→' ||
           (sp.price_ged_total - sp.base_price_eur)::text || '€'
      ELSE NULL
    END, ' | '
  ) AS "Markups durée",
  COUNT(DISTINCT sp.city_departure) - 1 AS "Nb villes transport",
  CASE
    WHEN MIN(CASE WHEN sp.city_departure != 'sans_transport'
              THEN sp.transport_surcharge_ged - sp.transport_surcharge_ufoval END) = 18
      AND MAX(CASE WHEN sp.city_departure != 'sans_transport'
              THEN sp.transport_surcharge_ged - sp.transport_surcharge_ufoval END) = 18
    THEN '✅ 18€'
    ELSE '⚠️'
  END AS "Marge transport",
  COUNT(*) AS "Total lignes prix"
FROM gd_session_prices sp
JOIN gd_stays s ON s.slug = sp.stay_slug
GROUP BY sp.stay_slug, s.marketing_title
ORDER BY sp.stay_slug;
