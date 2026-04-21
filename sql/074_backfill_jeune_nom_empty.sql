-- ============================================================================
-- Migration 074 — Backfill jeune_nom / jeune_prenom vides
-- Date : 2026-04-21
-- Origine : audit testeuse humaine Thanh (19-21/04/2026)
--           3 inscriptions créées avec jeune_nom = '' — form /reserver
--           ne collecte pas le nom de famille (décision RGPD février 2026).
--
-- Contexte Option C (décision produit 2026-04-21) :
--   Le nom de famille est désormais collecté au niveau du dossier enfant
--   (étape ultérieure, proportionnée RGPD), pas à l'inscription.
--   Le champ gd_inscriptions.jeune_nom reste NOT NULL mais peut contenir
--   'À RENSEIGNER' en attendant le remplissage du dossier.
--   Pas de CHECK contrainte `<> ''` : casserait le flow Option C.
--
-- Effets :
--   - 3 lignes Thanh (18-21/04, jeune_nom = '') → 'À RENSEIGNER'
--   - 0 ligne NULL (colonne NOT NULL active)
--   - Aucune contrainte ajoutée/modifiée
--
-- Rollback : UPDATE gd_inscriptions SET jeune_nom = ''
--              WHERE jeune_nom = 'À RENSEIGNER' AND updated_at > '2026-04-21';
-- ============================================================================

BEGIN;

-- Backfill jeune_nom vides (3 lignes Thanh attendues)
UPDATE gd_inscriptions
SET jeune_nom = 'À RENSEIGNER',
    updated_at = NOW()
WHERE jeune_nom = ''
  AND deleted_at IS NULL;

-- Backfill jeune_prenom vides par précaution (0 ligne attendue)
UPDATE gd_inscriptions
SET jeune_prenom = 'À RENSEIGNER',
    updated_at = NOW()
WHERE jeune_prenom = ''
  AND deleted_at IS NULL;

COMMIT;

-- Vérification post-migration (à lancer après commit)
-- SELECT COUNT(*) AS vides_restants
-- FROM gd_inscriptions
-- WHERE (jeune_nom = '' OR jeune_prenom = '')
--   AND deleted_at IS NULL;
-- Attendu : 0
