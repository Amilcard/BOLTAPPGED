-- 2026-04-17 — drop FK dupliquée sur gd_session_prices.stay_slug
-- Préserve fk_session_prices_stay (référence sql/010).
-- gd_session_prices_stay_fk est redondante et ajoute ON DELETE CASCADE non voulu.
ALTER TABLE gd_session_prices DROP CONSTRAINT IF EXISTS gd_session_prices_stay_fk;
