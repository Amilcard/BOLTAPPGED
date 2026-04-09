-- 036_multi_codes_structure.sql
-- Système multi-codes par structure : éducateur / CDS / directeur
--
-- Contexte : le code structure unique (6 chars) donne accès à tous les dossiers
-- sans distinction de rôle. Cette migration ajoute 3 niveaux d'accès :
--   - code_educateur (6 chars)  → inscriptions créées par cet éducateur uniquement
--   - code (existant, 8 chars)  → toutes inscriptions de la structure (CDS)
--   - code_directeur (10 chars) → accès total + régénération codes + audit
--
-- Hiérarchie de délégation :
--   Éducateur absent → CDS prend le relais (voit tout)
--   CDS absent → Directeur prend la main (voit tout + gère les codes)

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Nouveaux champs sur gd_structures
-- ═══════════════════════════════════════════════════════════════════════

-- Code directeur (10 chars, accès total + admin codes)
ALTER TABLE gd_structures ADD COLUMN IF NOT EXISTS code_directeur TEXT;
ALTER TABLE gd_structures ADD CONSTRAINT gd_structures_code_directeur_key UNIQUE (code_directeur);

-- Expiration par code
ALTER TABLE gd_structures ADD COLUMN IF NOT EXISTS code_expires_at TIMESTAMPTZ;
ALTER TABLE gd_structures ADD COLUMN IF NOT EXISTS code_directeur_expires_at TIMESTAMPTZ;

-- Traçabilité
ALTER TABLE gd_structures ADD COLUMN IF NOT EXISTS code_generated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE gd_structures ADD COLUMN IF NOT EXISTS code_directeur_generated_at TIMESTAMPTZ;

-- Révocation
ALTER TABLE gd_structures ADD COLUMN IF NOT EXISTS code_revoked_at TIMESTAMPTZ;
ALTER TABLE gd_structures ADD COLUMN IF NOT EXISTS code_directeur_revoked_at TIMESTAMPTZ;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Fonction de génération code directeur (10 chars)
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION generate_director_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_code TEXT;
  exists_already BOOLEAN;
BEGIN
  LOOP
    -- 10 caractères alphanum majuscules
    new_code := UPPER(SUBSTR(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 10));
    SELECT EXISTS(SELECT 1 FROM gd_structures WHERE code_directeur = new_code) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN new_code;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Backfill : codes existants → expiration 90j (CDS) + code directeur
-- ═══════════════════════════════════════════════════════════════════════

-- CDS : expiration 90 jours à partir de maintenant
UPDATE gd_structures
SET code_expires_at = NOW() + INTERVAL '90 days',
    code_generated_at = COALESCE(code_generated_at, NOW())
WHERE code IS NOT NULL AND code_expires_at IS NULL;

-- Directeur : générer pour toutes les structures actives
UPDATE gd_structures
SET code_directeur = generate_director_code(),
    code_directeur_expires_at = NOW() + INTERVAL '180 days',
    code_directeur_generated_at = NOW()
WHERE code IS NOT NULL AND code_directeur IS NULL AND status = 'active';

-- ═══════════════════════════════════════════════════════════════════════
-- 4. Index pour lookup rapide par code directeur
-- ═══════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_structures_code_directeur
  ON gd_structures (code_directeur)
  WHERE code_directeur IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- 5. Vue audit : qui accède via quel code
-- ═══════════════════════════════════════════════════════════════════════

COMMENT ON COLUMN gd_structures.code IS
  'Code CDS (6 chars) — accès toutes inscriptions de la structure. Expire après 90 jours.';
COMMENT ON COLUMN gd_structures.code_directeur IS
  'Code directeur (10 chars) — accès total + régénération codes. Expire après 180 jours.';

-- ═══════════════════════════════════════════════════════════════════════
-- NOTE : le code éducateur n'est PAS un nouveau champ.
-- L'éducateur utilise le suivi_token par inscription (déjà existant).
-- Le code CDS (existant) permet au CDS de voir TOUTES les inscriptions.
-- Le code directeur (nouveau) ajoute le même accès + gestion des codes.
-- ═══════════════════════════════════════════════════════════════════════
