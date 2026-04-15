-- Migration 070 — VALIDATE CONSTRAINT FK (migration 010 NOT VALID)
-- Prérequis : SELECT * FROM v_orphaned_records; → doit retourner 0 ligne
-- Vérifié le 2026-04-15 : 0 orphelins en base
--
-- ATTENTION : chaque VALIDATE pose un ShareLock sur la table pendant le scan
-- → Exécuter en heure creuse (nuit / week-end)
-- → Exécuter chaque ALTER séparément si la table est grande

-- FK 1 : gd_stay_sessions.stay_slug → gd_stays.slug
ALTER TABLE gd_stay_sessions VALIDATE CONSTRAINT fk_stay_sessions_stay;

-- FK 2 : gd_session_prices.stay_slug → gd_stays.slug
ALTER TABLE gd_session_prices VALIDATE CONSTRAINT fk_session_prices_stay;

-- FK 3 : gd_inscriptions.sejour_slug → gd_stays.slug
ALTER TABLE gd_inscriptions VALIDATE CONSTRAINT fk_inscriptions_stay;

-- Vérification post-VALIDATE : les contraintes doivent passer de convalidated=false à true
SELECT conname, convalidated
FROM pg_constraint
WHERE conname IN (
  'fk_stay_sessions_stay',
  'fk_session_prices_stay',
  'fk_inscriptions_stay'
);
-- Attendu : convalidated = true pour les 3
