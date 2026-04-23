-- ============================================================
-- Migration 036 — Villes de départ + surcoûts transport
-- Séjours : atlantic-surf-sessions, high-ranch-experience, lake-sky-extreme
--
-- Stratégie : CROSS JOIN sans_transport × villes → INSERT ON CONFLICT DO UPDATE
-- transport_surcharge_ged est GENERATED (ufoval + 18 si > 0)
-- price_ged_total = base + markup_durée + transport_ged
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ATLANTIC SURF SESSIONS
--    Villes : bordeaux=170, paris=245, poitiers=170, rennes=245
-- ============================================================

INSERT INTO gd_session_prices (
  stay_slug, start_date, end_date, city_departure,
  base_price_eur, transport_surcharge_ufoval, price_ged_total, is_full
)
SELECT
  sp.stay_slug,
  sp.start_date,
  sp.end_date,
  c.city_departure,
  sp.base_price_eur,
  c.surcharge_ufoval,
  -- price_ged_total = base + durée_markup + transport_ged
  sp.base_price_eur
    + CASE
        WHEN (sp.end_date - sp.start_date) <= 8  THEN 180   -- 7j
        WHEN (sp.end_date - sp.start_date) <= 15 THEN 240   -- 14j
        ELSE 410                                              -- 21j
      END
    + CASE WHEN c.surcharge_ufoval > 0 THEN c.surcharge_ufoval + 18 ELSE 0 END,
  sp.is_full
FROM gd_session_prices sp
CROSS JOIN (VALUES
  ('bordeaux', 170),
  ('paris',    245),
  ('poitiers', 170),
  ('rennes',   245)
) AS c(city_departure, surcharge_ufoval)
WHERE sp.stay_slug = 'atlantic-surf-sessions'
  AND sp.city_departure = 'sans_transport'
ON CONFLICT (stay_slug, start_date, end_date, city_departure)
DO UPDATE SET
  transport_surcharge_ufoval = EXCLUDED.transport_surcharge_ufoval,
  price_ged_total = EXCLUDED.price_ged_total;


-- ============================================================
-- 2. HIGH RANCH EXPERIENCE
--    17 villes
-- ============================================================

INSERT INTO gd_session_prices (
  stay_slug, start_date, end_date, city_departure,
  base_price_eur, transport_surcharge_ufoval, price_ged_total, is_full
)
SELECT
  sp.stay_slug,
  sp.start_date,
  sp.end_date,
  c.city_departure,
  sp.base_price_eur,
  c.surcharge_ufoval,
  sp.base_price_eur
    + CASE
        WHEN (sp.end_date - sp.start_date) <= 8  THEN 180
        WHEN (sp.end_date - sp.start_date) <= 15 THEN 240
        ELSE 410
      END
    + CASE WHEN c.surcharge_ufoval > 0 THEN c.surcharge_ufoval + 18 ELSE 0 END,
  sp.is_full
FROM gd_session_prices sp
CROSS JOIN (VALUES
  ('albertville',       110),
  ('annecy',             65),
  ('annemasse',          65),
  ('bordeaux',          315),
  ('chambery',          110),
  ('clermont ferrand',  135),
  ('cluses',             65),
  ('grenoble',          110),
  ('lille',             315),
  ('lyon',              135),
  ('marseille',         245),
  ('nancy',             315),
  ('nantes',            315),
  ('paris',             220),
  ('rennes',            315),
  ('st etienne',        135),
  ('valence',           135)
) AS c(city_departure, surcharge_ufoval)
WHERE sp.stay_slug = 'high-ranch-experience'
  AND sp.city_departure = 'sans_transport'
ON CONFLICT (stay_slug, start_date, end_date, city_departure)
DO UPDATE SET
  transport_surcharge_ufoval = EXCLUDED.transport_surcharge_ufoval,
  price_ged_total = EXCLUDED.price_ged_total;


-- ============================================================
-- 3. LAKE & SKY EXTREME
--    17 villes (annecy = 35, reste identique à High Ranch)
-- ============================================================

INSERT INTO gd_session_prices (
  stay_slug, start_date, end_date, city_departure,
  base_price_eur, transport_surcharge_ufoval, price_ged_total, is_full
)
SELECT
  sp.stay_slug,
  sp.start_date,
  sp.end_date,
  c.city_departure,
  sp.base_price_eur,
  c.surcharge_ufoval,
  sp.base_price_eur
    + CASE
        WHEN (sp.end_date - sp.start_date) <= 8  THEN 180
        WHEN (sp.end_date - sp.start_date) <= 15 THEN 240
        ELSE 410
      END
    + CASE WHEN c.surcharge_ufoval > 0 THEN c.surcharge_ufoval + 18 ELSE 0 END,
  sp.is_full
FROM gd_session_prices sp
CROSS JOIN (VALUES
  ('albertville',       110),
  ('annecy',             35),
  ('annemasse',          65),
  ('bordeaux',          315),
  ('chambery',          110),
  ('clermont ferrand',  135),
  ('cluses',             65),
  ('grenoble',          110),
  ('lille',             315),
  ('lyon',              135),
  ('marseille',         245),
  ('nancy',             315),
  ('nantes',            315),
  ('paris',             220),
  ('rennes',            315),
  ('st etienne',        135),
  ('valence',           135)
) AS c(city_departure, surcharge_ufoval)
WHERE sp.stay_slug = 'lake-sky-extreme'
  AND sp.city_departure = 'sans_transport'
ON CONFLICT (stay_slug, start_date, end_date, city_departure)
DO UPDATE SET
  transport_surcharge_ufoval = EXCLUDED.transport_surcharge_ufoval,
  price_ged_total = EXCLUDED.price_ged_total;


-- ============================================================
-- Vérification post-insert
-- ============================================================

-- Nombre de lignes par séjour et ville
SELECT
  stay_slug,
  city_departure,
  COUNT(*) AS nb_sessions,
  MIN(transport_surcharge_ufoval) AS surcharge_ufoval,
  MIN(transport_surcharge_ged) AS surcharge_ged,
  MIN(price_ged_total) AS prix_min,
  MAX(price_ged_total) AS prix_max
FROM gd_session_prices
WHERE stay_slug IN ('atlantic-surf-sessions', 'high-ranch-experience', 'lake-sky-extreme')
GROUP BY stay_slug, city_departure
ORDER BY stay_slug, city_departure;

COMMIT;
