-- ============================================================
-- Migration 034 — Documents obligatoires par séjour
-- Peuple le champ gd_stays.documents_requis (JSON) pour
-- les séjours concernés par l'import de dossiers pré-validés.
--
-- Format JSON : tableau de strings identifiant les documents.
-- Valeurs reconnues :
--   'fiche_sanitaire'         — obligatoire tous séjours
--   'fiche_informations'      — obligatoire tous séjours
--   'pass_nautique'           — activités nautiques
--   'autorisation_parentale'  — séjours spécifiques (parapente, etc.)
--   'certificat_medical'      — séjours spécifiques (parapente, plongée)
--   'attestation_assurance'   — séjours spécifiques (moto, parapente)
--
-- IMPORTANT : remplacer les slugs ci-dessous par les slugs réels
-- de vos séjours dans gd_stays. Vérifier via :
--   SELECT slug, marketing_title FROM gd_stays WHERE marketing_title ILIKE '%nom%';
-- ============================================================

-- AZUR DIVE & JET (plongée + jet ski)
UPDATE gd_stays SET documents_requis = '["fiche_sanitaire","fiche_informations","pass_nautique","certificat_medical","autorisation_parentale"]'::jsonb
WHERE slug ILIKE '%azur%dive%' OR slug ILIKE '%azur-dive%';

-- ATLANTIC SURF SESSIONS
UPDATE gd_stays SET documents_requis = '["fiche_sanitaire","fiche_informations","pass_nautique"]'::jsonb
WHERE slug ILIKE '%atlantic%surf%';

-- BRETAGNE OCEAN RIDE
UPDATE gd_stays SET documents_requis = '["fiche_sanitaire","fiche_informations","pass_nautique"]'::jsonb
WHERE slug ILIKE '%bretagne%ocean%';

-- GRAVITY BIKE PARK (14 jours — pas de pass nautique)
UPDATE gd_stays SET documents_requis = '["fiche_sanitaire","fiche_informations"]'::jsonb
WHERE slug ILIKE '%gravity%bike%';

-- WILDLIFE REPORTER
UPDATE gd_stays SET documents_requis = '["fiche_sanitaire","fiche_informations"]'::jsonb
WHERE slug ILIKE '%wildlife%reporter%';

-- BLUE EXPERIENCES
UPDATE gd_stays SET documents_requis = '["fiche_sanitaire","fiche_informations","pass_nautique"]'::jsonb
WHERE slug ILIKE '%blue%experience%';

-- MX RIDER ACADEMY (moto — assurance RC obligatoire)
UPDATE gd_stays SET documents_requis = '["fiche_sanitaire","fiche_informations","pass_nautique","attestation_assurance"]'::jsonb
WHERE slug ILIKE '%mx%rider%' OR slug ILIKE '%mx-rider%';

-- DUNE OCEAN
UPDATE gd_stays SET documents_requis = '["fiche_sanitaire","pass_nautique"]'::jsonb
WHERE slug ILIKE '%dune%ocean%';

-- HIGH RANCH EXPERIENCE
UPDATE gd_stays SET documents_requis = '["fiche_sanitaire","fiche_informations"]'::jsonb
WHERE slug ILIKE '%high%ranch%';

-- MY LITTLE FOREST
UPDATE gd_stays SET documents_requis = '["fiche_sanitaire","fiche_informations"]'::jsonb
WHERE slug ILIKE '%little%forest%';

-- ADRENALINE & CHILL
UPDATE gd_stays SET documents_requis = '["fiche_sanitaire","fiche_informations","pass_nautique"]'::jsonb
WHERE slug ILIKE '%adrenaline%chill%' OR slug = 'adrenaline-and-chill';

-- LAKE & SKY EXTREME (parapente — médical + assurance obligatoires)
UPDATE gd_stays SET documents_requis = '["fiche_sanitaire","fiche_informations","pass_nautique","autorisation_parentale","certificat_medical","attestation_assurance"]'::jsonb
WHERE slug ILIKE '%lake%sky%' OR slug ILIKE '%sky%extreme%';

-- ============================================================
-- Vérification post-migration
-- ============================================================
SELECT slug, marketing_title,
       jsonb_array_length(documents_requis::jsonb) AS nb_docs_requis,
       documents_requis
FROM gd_stays
WHERE documents_requis IS NOT NULL
ORDER BY marketing_title;
