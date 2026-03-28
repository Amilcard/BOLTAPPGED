-- 026_espace_structure.sql
-- Espace Structure — rattachement multi-éducateurs par code 6 caractères
--
-- Contexte : les éducateurs de la même structure inscrivent des enfants
-- indépendamment. Le code structure permet de regrouper les inscriptions
-- sans dépendre de l'email (email perso, sous-domaine inconnu, etc.).

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Enrichir gd_structures
-- ═══════════════════════════════════════════════════════════════════════

-- Le champ domain n'est plus obligatoire (email perso = pas de domaine)
ALTER TABLE gd_structures ALTER COLUMN domain DROP NOT NULL;

-- Nouveaux champs
ALTER TABLE gd_structures ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE gd_structures ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE gd_structures ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE gd_structures ADD COLUMN IF NOT EXISTS type TEXT;  -- asso, ccas, centre_social, maison_quartier, autre
ALTER TABLE gd_structures ADD COLUMN IF NOT EXISTS email TEXT;  -- email officiel de la structure
ALTER TABLE gd_structures ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';  -- active, inactive
ALTER TABLE gd_structures ADD COLUMN IF NOT EXISTS created_by_email TEXT;  -- email de l'éducateur qui a créé l'entrée

-- Contrainte UNIQUE sur code (déjà nullable, on ajoute la contrainte)
ALTER TABLE gd_structures DROP CONSTRAINT IF EXISTS gd_structures_code_key;
ALTER TABLE gd_structures ADD CONSTRAINT gd_structures_code_key UNIQUE (code);

-- Index sur postal_code pour la recherche par CP
CREATE INDEX IF NOT EXISTS idx_structures_postal_code ON gd_structures (postal_code);

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Fonction de génération de code unique 6 caractères
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION generate_structure_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_code TEXT;
  exists_already BOOLEAN;
BEGIN
  LOOP
    -- 6 caractères alphanum majuscules
    new_code := UPPER(SUBSTR(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 6));
    -- Vérifier unicité
    SELECT EXISTS(SELECT 1 FROM gd_structures WHERE code = new_code) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN new_code;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Trigger : générer le code automatiquement si non fourni
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION trg_structure_generate_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := generate_structure_code();
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_structure_code ON gd_structures;
CREATE TRIGGER trg_structure_code
  BEFORE INSERT ON gd_structures
  FOR EACH ROW
  EXECUTE FUNCTION trg_structure_generate_code();

-- ═══════════════════════════════════════════════════════════════════════
-- 4. Colonnes supplémentaires sur gd_inscriptions
-- ═══════════════════════════════════════════════════════════════════════

-- structure_id et structure_domain existent déjà (migration 020)
-- On ajoute les champs de capture pour le rattachement a posteriori

ALTER TABLE gd_inscriptions
  ADD COLUMN IF NOT EXISTS structure_pending_name TEXT;  -- nom saisi sans code

ALTER TABLE gd_inscriptions
  ADD COLUMN IF NOT EXISTS structure_email TEXT;  -- email structure saisi dans le formulaire

ALTER TABLE gd_inscriptions
  ADD COLUMN IF NOT EXISTS structure_postal_code TEXT;  -- CP structure saisi

ALTER TABLE gd_inscriptions
  ADD COLUMN IF NOT EXISTS structure_city TEXT;  -- ville structure saisie

ALTER TABLE gd_inscriptions
  ADD COLUMN IF NOT EXISTS structure_type TEXT;  -- type de structure saisi

ALTER TABLE gd_inscriptions
  ADD COLUMN IF NOT EXISTS structure_address TEXT;  -- adresse structure saisie

-- Index pour requêtes admin filtrées par structure
CREATE INDEX IF NOT EXISTS idx_inscriptions_structure_pending
  ON gd_inscriptions (structure_pending_name)
  WHERE structure_pending_name IS NOT NULL AND structure_id IS NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- 5. Backfill : générer les codes pour les structures existantes
-- ═══════════════════════════════════════════════════════════════════════

UPDATE gd_structures
SET code = generate_structure_code()
WHERE code IS NULL;

COMMENT ON TABLE gd_structures IS
  'Structures sociales (asso, CCAS, centres sociaux). Code 6 chars pour rattachement multi-éducateurs.';
