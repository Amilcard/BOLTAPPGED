-- ============================================
-- 004 – Mise à jour is_full sur gd_session_prices
-- Sessions complètes identifiées sur UFOVAL pour dh-experience-11-13-ans
-- Source : https://ufoval.fol74.org/sejours-colonies-de-vacances-a-la-montagne/dh-experience-11-13-ans
-- Date de vérification : 2026-02-18
-- ============================================
-- À exécuter dans Supabase SQL Editor

-- 1. D'abord, reset toutes les sessions de ce séjour à false (sécurité)
UPDATE gd_session_prices
SET is_full = false
WHERE stay_slug = 'dh-experience-11-13-ans';

-- 2. Sessions 7 jours COMPLÈTES
-- 12 juil → 18 juil 2026
UPDATE gd_session_prices
SET is_full = true
WHERE stay_slug = 'dh-experience-11-13-ans'
  AND start_date = '2026-07-12'
  AND end_date = '2026-07-18';

-- 2 août → 8 août 2026
UPDATE gd_session_prices
SET is_full = true
WHERE stay_slug = 'dh-experience-11-13-ans'
  AND start_date = '2026-08-02'
  AND end_date = '2026-08-08';

-- 3. Sessions 14 jours COMPLÈTES
-- 5 juil → 18 juil 2026
UPDATE gd_session_prices
SET is_full = true
WHERE stay_slug = 'dh-experience-11-13-ans'
  AND start_date = '2026-07-05'
  AND end_date = '2026-07-18';

-- 2 août → 15 août 2026
UPDATE gd_session_prices
SET is_full = true
WHERE stay_slug = 'dh-experience-11-13-ans'
  AND start_date = '2026-08-02'
  AND end_date = '2026-08-15';

-- 4. Sessions 21 jours COMPLÈTES
-- 5 juil → 25 juil 2026
UPDATE gd_session_prices
SET is_full = true
WHERE stay_slug = 'dh-experience-11-13-ans'
  AND start_date = '2026-07-05'
  AND end_date = '2026-07-25';

-- 2 août → 22 août 2026
UPDATE gd_session_prices
SET is_full = true
WHERE stay_slug = 'dh-experience-11-13-ans'
  AND start_date = '2026-08-02'
  AND end_date = '2026-08-22';

-- 5. Vérification : afficher le résultat
SELECT start_date, end_date, city_departure, is_full,
       (end_date::date - start_date::date) + 1 AS duration_days
FROM gd_session_prices
WHERE stay_slug = 'dh-experience-11-13-ans'
ORDER BY start_date, end_date, city_departure;
