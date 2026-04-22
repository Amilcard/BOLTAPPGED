-- ============================================================================
-- FIXTURE DEBUG — PDF overlap signatures (Bloc 3b v2 COMMIT 1) — v2
-- ============================================================================
-- ⚠️  JAMAIS SUR PROD. DB cibles autorisées :
--        - Supabase preview branch (branch DB isolée)
--        - Local (supabase start / supabase db reset)
--        - Staging dédié
--     Motif : données factices visibles via magic-link suivi_token, à auto-purger.
--
-- Objectif : créer 1 structure test (is_test=true) + 3 inscriptions + 3 dossiers
-- pour tester visuellement l'overlap signature × texte sur bulletin/sanitaire/
-- liaison.
--
-- 3 cas métier (Q1 user 2026-04-22) :
--   A — Pro ASE : parental_consent_at=NULL,    soussigne_nom=NULL
--   B — Famille : parental_consent_at=NOW(),   soussigne_nom='Thanh Nguyen'
--   C — Famille : parental_consent_at=NOW(),   soussigne_nom=NULL  (edge case)
--
-- Signature PNG = 8×1 pixels noir (déterministe) stretché à 120×25 par
-- drawImage → rectangle plein noir, overlap visible sur rendu template.
--
-- Double-guard CNIL (rollback propre) :
--   - gd_structures.is_test = true
--   - gd_structures.domain  = 'pdf-test.fixture.local'
--   - gd_inscriptions.structure_id = <test struct id> (FK NO ACTION → purge ordonnée)
--   - gd_inscriptions.referent_email = 'pdf-test@gd.local'
-- ROLLBACK : supabase/fixtures/ROLLBACK_pdf-test-dossiers.sql
--
-- Sejour cible : 'laventure-verticale' / 2026-07-04 (validé 2026-04-22).
-- ============================================================================

BEGIN;

-- ─── STRUCTURE TEST — marker CNIL pour filtre admin + rollback ────────────────
-- Idempotent : si la fixture a déjà tourné, ON CONFLICT met à jour updated_at
-- sans dupliquer. La colonne domain a un UNIQUE index.
INSERT INTO gd_structures (name, domain, is_test, status)
VALUES ('PDF Test Fixture — auto-delete', 'pdf-test.fixture.local', true, 'active')
ON CONFLICT (domain) DO UPDATE SET updated_at = NOW(), is_test = true;

-- ─── CAS A : Pro ASE (pas de parental_consent, pas de soussigne_nom) ──────────
WITH ins_a AS (
  INSERT INTO gd_inscriptions (
    structure_id,
    jeune_prenom, jeune_nom, jeune_date_naissance, jeune_sexe,
    referent_nom, referent_email, referent_tel, referent_fonction,
    sejour_slug, session_date, city_departure,
    organisation, status, payment_method, payment_status, price_total,
    parental_consent_at, consent_at, suivi_token_expires_at
  ) VALUES (
    (SELECT id FROM gd_structures WHERE domain='pdf-test.fixture.local'),
    'Camille', 'Dubois', '2014-03-15', 'F',
    'Élodie Lambert', 'pdf-test@gd.local', '0600000001', 'Éducatrice spécialisée',
    'laventure-verticale', '2026-07-04', 'Paris',
    'ASE du Rhône', 'en_attente', 'transfer', 'pending_transfer', 450.00,
    NULL, NOW(), NOW() + INTERVAL '30 days'
  )
  RETURNING id, suivi_token
)
INSERT INTO gd_dossier_enfant (inscription_id, bulletin_complement, fiche_sanitaire, fiche_liaison_jeune, bulletin_completed, sanitaire_completed, liaison_completed)
SELECT
  id,
  jsonb_build_object(
    'nom_famille',          'Dubois',
    'adresse_permanente',   '12 rue du Test, Paris',
    'mail',                 'pdf-test@gd.local',
    'contact_urgence_nom',  'Contact A',
    'contact_urgence_tel',  '0611111111',
    'soussigne_nom',        NULL,
    'autorisation_fait_a',  'Paris',
    'date_signature',       '22/04/2026',
    'signature_image_url',  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAABCAAAAADGa7CfAAAAC0lEQVR4nGNggAIAAAkAAftSuKkAAAAASUVORK5CYII='
  ),
  jsonb_build_object(
    'classe',                         'CM1',
    'sexe',                           'fille',
    'resp1_nom',                      'Lambert',
    'resp1_prenom',                   'Élodie',
    'resp1_tel_portable',             '0600000001',
    'resp1_email',                    'pdf-test@gd.local',
    'autorisation_soins_soussigne',   NULL,
    'fait_a',                         'Paris',
    'date_signature',                 '22/04/2026',
    'signature_image_url',            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAABCAAAAADGa7CfAAAAC0lEQVR4nGNggAIAAAkAAftSuKkAAAAASUVORK5CYII='
  ),
  jsonb_build_object(
    'etablissement_nom',     'ASE Rhône - MECS',
    'resp_etablissement_nom','Lambert',
    'signature_fait_a',      'Paris',
    'signature_image_url',   'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAABCAAAAADGa7CfAAAAC0lEQVR4nGNggAIAAAkAAftSuKkAAAAASUVORK5CYII='
  ),
  true, true, true
FROM ins_a;

-- ─── CAS B : Famille consentée + soussigne_nom rempli ─────────────────────────
WITH ins_b AS (
  INSERT INTO gd_inscriptions (
    structure_id,
    jeune_prenom, jeune_nom, jeune_date_naissance, jeune_sexe,
    referent_nom, referent_email, referent_tel, referent_fonction,
    sejour_slug, session_date, city_departure,
    organisation, status, payment_method, payment_status, price_total,
    parental_consent_at, parental_consent_version, consent_at, suivi_token_expires_at
  ) VALUES (
    (SELECT id FROM gd_structures WHERE domain='pdf-test.fixture.local'),
    'Léa', 'Martin', '2012-09-20', 'F',
    'Thanh Nguyen', 'pdf-test@gd.local', '0600000002', 'Parent',
    'laventure-verticale', '2026-07-04', 'Lyon',
    NULL, 'en_attente', 'stripe', 'pending_payment', 450.00,
    NOW(), 'v1.0', NOW(), NOW() + INTERVAL '30 days'
  )
  RETURNING id, suivi_token
)
INSERT INTO gd_dossier_enfant (inscription_id, bulletin_complement, fiche_sanitaire, fiche_liaison_jeune, bulletin_completed, sanitaire_completed, liaison_completed)
SELECT
  id,
  jsonb_build_object(
    'nom_famille',          'Martin',
    'adresse_permanente',   '45 rue des Tests, Lyon',
    'mail',                 'pdf-test@gd.local',
    'contact_urgence_nom',  'Nguyen Thanh',
    'contact_urgence_tel',  '0611111112',
    'soussigne_nom',        'Thanh Nguyen',
    'autorisation_fait_a',  'Lyon',
    'date_signature',       '22/04/2026',
    'signature_image_url',  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAABCAAAAADGa7CfAAAAC0lEQVR4nGNggAIAAAkAAftSuKkAAAAASUVORK5CYII='
  ),
  jsonb_build_object(
    'classe',                         '5e',
    'sexe',                           'fille',
    'resp1_nom',                      'Nguyen',
    'resp1_prenom',                   'Thanh',
    'resp1_tel_portable',             '0600000002',
    'resp1_email',                    'pdf-test@gd.local',
    'autorisation_soins_soussigne',   'Thanh Nguyen',
    'fait_a',                         'Lyon',
    'date_signature',                 '22/04/2026',
    'signature_image_url',            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAABCAAAAADGa7CfAAAAC0lEQVR4nGNggAIAAAkAAftSuKkAAAAASUVORK5CYII='
  ),
  jsonb_build_object(
    'etablissement_nom',     'Collège Victor Hugo',
    'resp_etablissement_nom','Directeur test',
    'signature_fait_a',      'Lyon',
    'signature_image_url',   'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAABCAAAAADGa7CfAAAAC0lEQVR4nGNggAIAAAkAAftSuKkAAAAASUVORK5CYII='
  ),
  true, true, true
FROM ins_b;

-- ─── CAS C : Famille consentée SANS soussigne_nom (edge case RGPD) ────────────
WITH ins_c AS (
  INSERT INTO gd_inscriptions (
    structure_id,
    jeune_prenom, jeune_nom, jeune_date_naissance, jeune_sexe,
    referent_nom, referent_email, referent_tel, referent_fonction,
    sejour_slug, session_date, city_departure,
    organisation, status, payment_method, payment_status, price_total,
    parental_consent_at, parental_consent_version, consent_at, suivi_token_expires_at
  ) VALUES (
    (SELECT id FROM gd_structures WHERE domain='pdf-test.fixture.local'),
    'Noah', 'Petit', '2015-06-10', 'M',
    'Parent fallback', 'pdf-test@gd.local', '0600000003', 'Parent',
    'laventure-verticale', '2026-07-04', 'Marseille',
    NULL, 'en_attente', 'stripe', 'pending_payment', 450.00,
    NOW(), 'v1.0', NOW(), NOW() + INTERVAL '30 days'
  )
  RETURNING id, suivi_token
)
INSERT INTO gd_dossier_enfant (inscription_id, bulletin_complement, fiche_sanitaire, fiche_liaison_jeune, bulletin_completed, sanitaire_completed, liaison_completed)
SELECT
  id,
  jsonb_build_object(
    'nom_famille',          'Petit',
    'adresse_permanente',   '7 cours des Tests, Marseille',
    'mail',                 'pdf-test@gd.local',
    'contact_urgence_nom',  'Contact C',
    'contact_urgence_tel',  '0611111113',
    'soussigne_nom',        NULL,
    'autorisation_fait_a',  'Marseille',
    'date_signature',       '22/04/2026',
    'signature_image_url',  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAABCAAAAADGa7CfAAAAC0lEQVR4nGNggAIAAAkAAftSuKkAAAAASUVORK5CYII='
  ),
  jsonb_build_object(
    'classe',                         'CM2',
    'sexe',                           'garcon',
    'resp1_nom',                      'Petit',
    'resp1_prenom',                   'Parent',
    'resp1_tel_portable',             '0600000003',
    'resp1_email',                    'pdf-test@gd.local',
    'autorisation_soins_soussigne',   NULL,
    'fait_a',                         'Marseille',
    'date_signature',                 '22/04/2026',
    'signature_image_url',            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAABCAAAAADGa7CfAAAAC0lEQVR4nGNggAIAAAkAAftSuKkAAAAASUVORK5CYII='
  ),
  jsonb_build_object(
    'etablissement_nom',     'École primaire test',
    'resp_etablissement_nom','Directeur test',
    'signature_fait_a',      'Marseille',
    'signature_image_url',   'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAABCAAAAADGa7CfAAAAC0lEQVR4nGNggAIAAAkAAftSuKkAAAAASUVORK5CYII='
  ),
  true, true, true
FROM ins_c;

-- ─── SELECT final : récupérer les 3 tokens pour curl ──────────────────────────
SELECT
  CASE
    WHEN i.parental_consent_at IS NULL THEN 'CAS-A-Pro-ASE'
    WHEN (SELECT bulletin_complement->>'soussigne_nom' FROM gd_dossier_enfant WHERE inscription_id = i.id) IS NOT NULL THEN 'CAS-B-Famille-avec-soussigne'
    ELSE 'CAS-C-Famille-sans-soussigne'
  END AS cas,
  i.id::text           AS inscription_id,
  i.suivi_token::text  AS suivi_token,
  i.jeune_prenom       AS prenom,
  i.jeune_nom          AS nom
FROM gd_inscriptions i
INNER JOIN gd_structures s ON s.id = i.structure_id
WHERE s.is_test = true AND s.domain = 'pdf-test.fixture.local'
  AND i.deleted_at IS NULL
ORDER BY i.created_at ASC;

COMMIT;
