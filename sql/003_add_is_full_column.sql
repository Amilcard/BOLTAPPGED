-- ============================================
-- 003 – Ajout colonne is_full sur gd_stays + gd_stay_sessions
-- Permet de marquer les séjours/sessions UFOVAL complets
-- (détecté par le scraping n8n via classe CSS "availability-status-full")
-- ============================================
-- À exécuter dans Supabase SQL Editor

-- 1. Colonne is_full sur gd_stays (séjour global)
-- Logique : true dès qu'au moins 1 session est complète
ALTER TABLE gd_stays
ADD COLUMN IF NOT EXISTS is_full BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_gd_stays_is_full ON gd_stays (is_full);

COMMENT ON COLUMN gd_stays.is_full IS 'Au moins 1 session complète. Mis à jour par scraping n8n (classe CSS availability-status-full sur pages UFOVAL).';

-- 2. Colonne is_full sur gd_stay_sessions (session par session)
ALTER TABLE gd_stay_sessions
ADD COLUMN IF NOT EXISTS is_full BOOLEAN DEFAULT false;

COMMENT ON COLUMN gd_stay_sessions.is_full IS 'Session complète (grisée sur UFOVAL). Détecté par scraping n8n.';
