-- Migration 021 : Compléments table gd_souhaits
-- Ajoute les colonnes nécessaires au magic link éducateur
-- À exécuter dans Supabase → SQL Editor

-- Token unique pour le magic link de réponse éducateur
ALTER TABLE gd_souhaits
  ADD COLUMN IF NOT EXISTS educateur_token UUID DEFAULT gen_random_uuid() UNIQUE;

-- Prénom de l'éducateur (optionnel, pour personnaliser l'email)
ALTER TABLE gd_souhaits
  ADD COLUMN IF NOT EXISTS educateur_prenom TEXT;

-- kid_token de session (UUID généré côté client, distinct de suivi_token_kid)
-- suivi_token_kid reste le token "permanent" généré côté serveur
-- kid_session_token est le UUID stocké en localStorage côté kid
ALTER TABLE gd_souhaits
  ADD COLUMN IF NOT EXISTS kid_session_token UUID;

-- Index pour récupérer les souhaits d'un kid via son token de session
CREATE INDEX IF NOT EXISTS idx_souhaits_kid_session_token ON gd_souhaits(kid_session_token);

-- Index pour le magic link éducateur
CREATE INDEX IF NOT EXISTS idx_souhaits_educateur_token ON gd_souhaits(educateur_token);

-- Vérification
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'gd_souhaits'
ORDER BY ordinal_position;
