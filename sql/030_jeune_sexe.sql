-- Migration 030 : Colonne jeune_sexe sur gd_inscriptions
-- Remplace le stockage dans le champ texte libre "remarques"
-- Valeurs : 'M' | 'F' | NULL (non renseigné)

ALTER TABLE gd_inscriptions
  ADD COLUMN IF NOT EXISTS jeune_sexe TEXT DEFAULT NULL;

-- Vérification
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'gd_inscriptions'
  AND column_name = 'jeune_sexe';
