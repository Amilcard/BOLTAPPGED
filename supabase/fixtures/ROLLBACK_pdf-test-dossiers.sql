-- ============================================================================
-- ROLLBACK — fixture PDF test dossiers (Bloc 3b v2 COMMIT 1)
-- ============================================================================
-- ⚠️  JAMAIS SUR PROD. À exécuter sur la même DB que pdf-test-dossiers.sql.
--
-- Double-guard CNIL : TOUTE suppression exige simultanément
--        is_test = true  AND  domain = 'pdf-test.fixture.local'
-- → impossible de supprimer accidentellement une structure prod même si un
--   admin a mis is_test=true par erreur (domain est le 2ᵉ verrou).
--
-- Ordre : FK `gd_inscriptions.structure_id → gd_structures.id` est NO ACTION,
-- donc purge obligatoire :
--        dossier_enfant → inscriptions → structure.
-- ============================================================================

BEGIN;

-- 1. Purger dossiers enfants des inscriptions fixture
DELETE FROM gd_dossier_enfant
 WHERE inscription_id IN (
   SELECT i.id
     FROM gd_inscriptions i
     INNER JOIN gd_structures s ON s.id = i.structure_id
    WHERE s.is_test = true
      AND s.domain  = 'pdf-test.fixture.local'
 );

-- 2. Purger inscriptions fixture
DELETE FROM gd_inscriptions
 WHERE structure_id IN (
   SELECT id FROM gd_structures
    WHERE is_test = true
      AND domain  = 'pdf-test.fixture.local'
 );

-- 3. Purger structure fixture elle-même
DELETE FROM gd_structures
 WHERE is_test = true
   AND domain  = 'pdf-test.fixture.local';

-- ─── Vérification finale : les 3 compteurs doivent renvoyer 0 ─────────────────
SELECT
  (SELECT COUNT(*) FROM gd_structures
     WHERE domain = 'pdf-test.fixture.local')                           AS structures_restantes,
  (SELECT COUNT(*) FROM gd_inscriptions
     WHERE referent_email = 'pdf-test@gd.local' AND deleted_at IS NULL) AS inscriptions_restantes,
  (SELECT COUNT(*) FROM gd_dossier_enfant
     WHERE inscription_id IN (
       SELECT id FROM gd_inscriptions WHERE referent_email = 'pdf-test@gd.local'
     ))                                                                 AS dossiers_restants;

COMMIT;
