-- ============================================================
-- Migration : Structures + Souhaits kids
-- Phase 4 — À exécuter dans Supabase → SQL Editor
-- Ordre : exécuter les blocs un par un, de haut en bas
-- ============================================================


-- ============================================================
-- BLOC 1 : Table gd_structures
-- Regroupe les éducateurs d'une même structure par domaine email
-- Pas de système d'auth, pas de compte — juste du regroupement
-- ============================================================

CREATE TABLE IF NOT EXISTS gd_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,           -- ex: 'ccas-lyon.fr'
  name TEXT NOT NULL,                     -- ex: 'CCAS Lyon' (initialisé à la 1ère inscription)
  code TEXT UNIQUE,                       -- code optionnel 6 chars pour rattachement manuel
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour lookup rapide par domaine
CREATE INDEX IF NOT EXISTS idx_structures_domain ON gd_structures(domain);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_structures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_structures_updated_at ON gd_structures;

CREATE TRIGGER trg_structures_updated_at
  BEFORE UPDATE ON gd_structures
  FOR EACH ROW
  EXECUTE FUNCTION set_structures_updated_at();


-- ============================================================
-- BLOC 2 : Colonne structure_domain sur gd_inscriptions
-- Nullable, remplie automatiquement, zéro impact sur l'existant
-- ============================================================

ALTER TABLE gd_inscriptions
  ADD COLUMN IF NOT EXISTS structure_domain TEXT;

ALTER TABLE gd_inscriptions
  ADD COLUMN IF NOT EXISTS structure_id UUID REFERENCES gd_structures(id);

-- Index pour regrouper par structure
CREATE INDEX IF NOT EXISTS idx_inscriptions_structure_domain ON gd_inscriptions(structure_domain);
CREATE INDEX IF NOT EXISTS idx_inscriptions_structure_id ON gd_inscriptions(structure_id);


-- ============================================================
-- BLOC 3 : Backfill structure_domain depuis referent_email existants
-- Extrait le domaine de chaque email déjà en base
-- Ignore les emails génériques (gmail, outlook, yahoo, etc.)
-- ============================================================

-- 3a. Remplir structure_domain pour toutes les inscriptions existantes
UPDATE gd_inscriptions
SET structure_domain = LOWER(SPLIT_PART(referent_email, '@', 2))
WHERE referent_email IS NOT NULL
  AND referent_email LIKE '%@%'
  AND structure_domain IS NULL;

-- 3b. Créer les structures à partir des domaines non-génériques
INSERT INTO gd_structures (domain, name)
SELECT DISTINCT
  structure_domain,
  -- Prendre le nom d'organisation de la première inscription de ce domaine
  (SELECT organisation FROM gd_inscriptions gi2
   WHERE gi2.structure_domain = gi.structure_domain
     AND gi2.organisation IS NOT NULL
   ORDER BY gi2.created_at ASC
   LIMIT 1)
FROM gd_inscriptions gi
WHERE structure_domain IS NOT NULL
  AND structure_domain NOT IN (
    'gmail.com', 'outlook.fr', 'outlook.com', 'hotmail.com', 'hotmail.fr',
    'yahoo.fr', 'yahoo.com', 'live.fr', 'live.com', 'orange.fr', 'free.fr',
    'sfr.fr', 'laposte.net', 'wanadoo.fr', 'icloud.com', 'protonmail.com',
    'gmx.fr', 'gmx.com', 'aol.com', 'msn.com'
  )
  AND structure_domain != ''
ON CONFLICT (domain) DO NOTHING;

-- 3c. Lier les inscriptions aux structures créées
UPDATE gd_inscriptions gi
SET structure_id = gs.id
FROM gd_structures gs
WHERE gi.structure_domain = gs.domain
  AND gi.structure_id IS NULL;


-- ============================================================
-- BLOC 4 : Générer un code 6 chars pour chaque structure
-- Permet le rattachement manuel des éducateurs avec email perso
-- ============================================================

UPDATE gd_structures
SET code = UPPER(SUBSTRING(MD5(id::TEXT || created_at::TEXT) FROM 1 FOR 6))
WHERE code IS NULL;


-- ============================================================
-- BLOC 5 : Table gd_souhaits
-- Un kid émet un souhait, un éducateur peut répondre
-- Stocké côté serveur (pas localStorage)
-- ============================================================

CREATE TABLE IF NOT EXISTS gd_souhaits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Qui souhaite
  kid_prenom TEXT NOT NULL,
  kid_prenom_referent TEXT,              -- optionnel : "Marie" (l'accompagnant)

  -- Quel séjour
  sejour_slug TEXT NOT NULL,
  sejour_titre TEXT,                      -- snapshot du titre au moment du souhait

  -- Pourquoi
  motivation TEXT,                        -- texte libre du kid (max 280 chars)

  -- Vers qui
  educateur_email TEXT NOT NULL,          -- email de l'accompagnant/éducateur
  structure_domain TEXT,                  -- domaine extrait automatiquement
  structure_id UUID REFERENCES gd_structures(id),

  -- Statut du souhait
  status TEXT NOT NULL DEFAULT 'emis',
  -- Valeurs : 'emis', 'vu', 'en_discussion', 'valide', 'refuse'

  -- Réponse de l'éducateur
  reponse_educateur TEXT,                 -- "C'est noté, on en reparle lundi"
  reponse_date TIMESTAMPTZ,

  -- Si le souhait aboutit à une inscription
  inscription_id UUID REFERENCES gd_inscriptions(id),

  -- Token de suivi pour le kid (consulter l'état de ses souhaits)
  suivi_token_kid UUID DEFAULT gen_random_uuid(),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les lookups fréquents
CREATE INDEX IF NOT EXISTS idx_souhaits_educateur_email ON gd_souhaits(educateur_email);
CREATE INDEX IF NOT EXISTS idx_souhaits_sejour_slug ON gd_souhaits(sejour_slug);
CREATE INDEX IF NOT EXISTS idx_souhaits_status ON gd_souhaits(status);
CREATE INDEX IF NOT EXISTS idx_souhaits_suivi_token ON gd_souhaits(suivi_token_kid);
CREATE INDEX IF NOT EXISTS idx_souhaits_structure_id ON gd_souhaits(structure_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_souhaits_updated_at ON gd_souhaits;

CREATE TRIGGER trg_souhaits_updated_at
  BEFORE UPDATE ON gd_souhaits
  FOR EACH ROW
  EXECUTE FUNCTION set_inscriptions_updated_at();
  -- Réutilise la même fonction générique (elle fait juste NEW.updated_at = NOW())


-- ============================================================
-- BLOC 6 : RLS (Row Level Security) sur gd_souhaits
-- Le service_role a accès total, les anon n'ont rien
-- ============================================================

ALTER TABLE gd_souhaits ENABLE ROW LEVEL SECURITY;

-- Policy : service_role peut tout faire (via API routes backend)
CREATE POLICY "service_role_all" ON gd_souhaits
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Pas de policy anon : aucun accès direct Supabase n'est légitime.
-- Tous les accès passent par l'API Next.js (service_role, bypass RLS).
-- Policy "anon_read_own_souhaits" supprimée le 2026-03-31 (USING true = toute la table lisible via clé anon publique).
-- DROP POLICY IF EXISTS "anon_read_own_souhaits" ON gd_souhaits; -- déjà exécuté en prod


-- ============================================================
-- BLOC 7 : RLS sur gd_structures
-- ============================================================

ALTER TABLE gd_structures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON gd_structures
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "anon_read_structures" ON gd_structures
  FOR SELECT
  USING (true);


-- ============================================================
-- BLOC 8 : Vérification
-- Exécuter après tous les blocs pour confirmer
-- ============================================================

-- Vérifier les structures créées
SELECT id, domain, name, code, created_at
FROM gd_structures
ORDER BY created_at DESC
LIMIT 20;

-- Vérifier les inscriptions liées
SELECT
  gi.id,
  gi.referent_email,
  gi.structure_domain,
  gs.name AS structure_name,
  gs.code AS structure_code
FROM gd_inscriptions gi
LEFT JOIN gd_structures gs ON gi.structure_id = gs.id
WHERE gi.structure_domain IS NOT NULL
ORDER BY gi.created_at DESC
LIMIT 20;

-- Vérifier la table souhaits (vide pour l'instant)
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'gd_souhaits'
ORDER BY ordinal_position;

-- Compter les structures vs emails perso non-rattachés
SELECT
  COUNT(*) FILTER (WHERE structure_id IS NOT NULL) AS rattachees,
  COUNT(*) FILTER (WHERE structure_id IS NULL AND structure_domain IS NOT NULL) AS email_perso,
  COUNT(*) FILTER (WHERE structure_domain IS NULL) AS sans_email,
  COUNT(*) AS total
FROM gd_inscriptions;
