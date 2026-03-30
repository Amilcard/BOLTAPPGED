-- ============================================================
-- Migration : Couche premium parcours pro GED_APP
-- Phase 3 — Préférences suivi + besoins spécifiques
-- À exécuter dans Supabase → SQL Editor
-- ============================================================

-- 1. Préférences de suivi pendant le séjour
ALTER TABLE gd_inscriptions
  ADD COLUMN IF NOT EXISTS pref_nouvelles_sejour TEXT DEFAULT 'si_besoin';
  -- Valeurs : 'oui', 'non', 'si_besoin'

ALTER TABLE gd_inscriptions
  ADD COLUMN IF NOT EXISTS pref_canal_contact TEXT DEFAULT 'email';
  -- Valeurs : 'email', 'telephone', 'les_deux'

ALTER TABLE gd_inscriptions
  ADD COLUMN IF NOT EXISTS pref_bilan_fin_sejour BOOLEAN DEFAULT false;

ALTER TABLE gd_inscriptions
  ADD COLUMN IF NOT EXISTS consignes_communication TEXT;
  -- Champ libre, consignes spécifiques du référent

-- 2. Besoins spécifiques avant départ (saisi par le référent)
ALTER TABLE gd_inscriptions
  ADD COLUMN IF NOT EXISTS besoins_specifiques TEXT;
  -- Texte libre : repères utiles, attention renforcée, modalités d'intégration

-- 3. Vérification
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'gd_inscriptions'
  AND column_name IN (
    'pref_nouvelles_sejour', 'pref_canal_contact',
    'pref_bilan_fin_sejour', 'consignes_communication',
    'besoins_specifiques'
  )
ORDER BY ordinal_position;
