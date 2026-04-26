-- =============================================================================
-- BACKFILL GED — Script de correction des données (2026-04-26)
-- Audit réalisé via MCP Supabase sur projet iirfvndgzutbxwfdwawu
-- =============================================================================
-- RÉSULTATS AUDIT (SELECT uniquement, aucune modif en session)
--
--   gd_inscriptions total : 42 (dont 4 deleted_at IS NOT NULL)
--   Inscriptions prod actives : 38 (deleted_at IS NULL)
--   jeune_nom vide/null      : 0  ← problème décrit déjà corrigé en prod
--   jeune_prenom vide/null   : 0
--   referent_email vide/null : 0
--   referent_nom vide/null   : 0
--   jeune_date_naissance null: 0
--   session_date null        : 0
--   organisation vide/null   : 0
--   sejour_slug vide/null    : 0
--   email format incorrect   : 0
--   dob valeur incohérente   : 0
--   sessions orphelines      : 0  (tous les sejour_slug pointent vers gd_stays)
--
--   SEUL PROBLÈME RÉEL : jeune_sexe NULL = 10/38 inscriptions prod (26 %)
--     - 2 avec ged_sent_at (dossiers envoyés GED → NE PAS TOUCHER)
--     - 8 sans ged_sent_at (corrigibles via fallback sentinelle)
--
--   gd_dossier_enfant : 42 dossiers
--     bulletin_incomplet   : 22
--     sanitaire_incomplet  : 25
--     ged_sent_at non NULL : 13
--     envoyes MAIS bulletin_incomplet : 0 (cohérence OK)
--
-- NOTE SCHÉMA :
--   - jeune_date_naissance = type DATE (pas text) → comparaison IS NULL uniquement
--   - session_date          = type DATE (pas text)
--   - is_test              = N'EXISTE PAS sur gd_inscriptions
--     (le filtrage test passe par gd_structures.is_test via v_inscriptions_production)
-- =============================================================================
-- INSTRUCTIONS :
--   1. Exécuter d'abord la SECTION 1 (DRY RUN — SELECT uniquement)
--   2. Vérifier les chiffres affichés vs résultats audit ci-dessus
--   3. Si OK, exécuter la SECTION 2 (UPDATE dans transaction)
--   4. En cas de résultat inattendu : exécuter SECTION 3 (ROLLBACK)
-- =============================================================================


-- ─── SECTION 1 : DRY RUN ─────────────────────────────────────────────────────
-- Exécuter ces SELECT pour voir ce qui sera modifié SANS toucher aux données.

-- 1A — Vérification globale avant intervention
SELECT
  COUNT(*)                                                                  AS total_actives,
  COUNT(*) FILTER (WHERE jeune_sexe IS NULL OR jeune_sexe = '')             AS sexe_manquant,
  COUNT(*) FILTER (WHERE (jeune_sexe IS NULL OR jeune_sexe = '')
                    AND d.ged_sent_at IS NOT NULL)                          AS sexe_manquant_ged_envoye,
  COUNT(*) FILTER (WHERE (jeune_sexe IS NULL OR jeune_sexe = '')
                    AND (d.ged_sent_at IS NULL))                            AS sexe_manquant_corrigibles
FROM gd_inscriptions i
LEFT JOIN gd_dossier_enfant d ON d.inscription_id = i.id
WHERE i.deleted_at IS NULL;

-- 1B — Détail des 10 lignes concernées (avant/après simulé)
SELECT
  i.id,
  i.jeune_prenom,
  i.jeune_nom,
  i.jeune_sexe                          AS sexe_avant,
  CASE
    WHEN d.ged_sent_at IS NOT NULL THEN '[SKIP — dossier GED envoyé, NE PAS TOUCHER]'
    ELSE 'À RENSEIGNER'
  END                                    AS sexe_apres_simulation,
  d.ged_sent_at,
  i.status,
  i.created_at
FROM gd_inscriptions i
LEFT JOIN gd_dossier_enfant d ON d.inscription_id = i.id
WHERE (i.jeune_sexe IS NULL OR i.jeune_sexe = '')
  AND i.deleted_at IS NULL
ORDER BY i.created_at;

-- 1C — Vérification champs PDF (état attendu : 0 manquants sauf sexe)
SELECT
  COUNT(*)                                                            AS total_prod,
  COUNT(*) FILTER (WHERE jeune_nom = '' OR jeune_nom IS NULL)         AS pdf_nom_manquant,
  COUNT(*) FILTER (WHERE jeune_prenom = '' OR jeune_prenom IS NULL)   AS pdf_prenom_manquant,
  COUNT(*) FILTER (WHERE jeune_sexe IS NULL OR jeune_sexe = '')       AS pdf_sexe_manquant,
  COUNT(*) FILTER (WHERE organisation = '' OR organisation IS NULL)   AS pdf_organisation_manquant,
  COUNT(*) FILTER (WHERE city_departure = '' OR city_departure IS NULL) AS pdf_city_manquant
FROM gd_inscriptions
WHERE deleted_at IS NULL;


-- ─── SECTION 2 : CORRECTION (dans une transaction) ───────────────────────────
-- Objectif : remplir jeune_sexe = 'À RENSEIGNER' pour les 8 inscriptions
--   - deleted_at IS NULL (actives)
--   - jeune_sexe IS NULL (champ vide)
--   - ged_sent_at IS NULL via gd_dossier_enfant (dossier NON envoyé à GED)
--
-- Les 2 inscriptions avec ged_sent_at IS NOT NULL sont EXCLUES intentionnellement
-- (données archivées figées au moment de l'envoi GED).

BEGIN;

-- Sauvegarder snapshot avant modification (pour rollback ciblé)
CREATE TEMP TABLE _backfill_snapshot_sexe AS
SELECT
  i.id,
  i.jeune_sexe,
  i.updated_at
FROM gd_inscriptions i
LEFT JOIN gd_dossier_enfant d ON d.inscription_id = i.id
WHERE (i.jeune_sexe IS NULL OR i.jeune_sexe = '')
  AND i.deleted_at IS NULL
  AND d.ged_sent_at IS NULL;

-- Correction : jeune_sexe → 'À RENSEIGNER' pour les inscriptions sans dossier GED envoyé
UPDATE gd_inscriptions i
SET
  jeune_sexe = 'À RENSEIGNER',
  updated_at = NOW()
FROM gd_dossier_enfant d
WHERE d.inscription_id = i.id
  AND (i.jeune_sexe IS NULL OR i.jeune_sexe = '')
  AND i.deleted_at IS NULL
  AND d.ged_sent_at IS NULL;

-- Correction pour inscriptions sans dossier du tout (LEFT JOIN = NULL)
-- Note : audit 2B = 0 inscriptions sans dossier, mais garder la clause par sécurité
UPDATE gd_inscriptions i
SET
  jeune_sexe = 'À RENSEIGNER',
  updated_at = NOW()
WHERE (i.jeune_sexe IS NULL OR i.jeune_sexe = '')
  AND i.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM gd_dossier_enfant d WHERE d.inscription_id = i.id
  );

-- Vérification post-update OBLIGATOIRE
-- Attendu :
--   encore_vides     = 2  (les 2 avec ged_sent_at → intentionnellement non touchés)
--   fallback_renseigner >= 8
--   sexe_m_ou_f     = 28 (les 28 déjà renseignés)
SELECT
  'APRÈS CORRECTION' AS phase,
  COUNT(*) FILTER (WHERE jeune_sexe IS NULL OR jeune_sexe = '')      AS encore_vides,
  COUNT(*) FILTER (WHERE jeune_sexe = 'À RENSEIGNER')                AS fallback_renseigner,
  COUNT(*) FILTER (WHERE jeune_sexe IN ('M', 'F'))                   AS sexe_m_ou_f,
  COUNT(*) FILTER (WHERE jeune_sexe NOT IN ('M', 'F', 'À RENSEIGNER')
                    AND jeune_sexe IS NOT NULL
                    AND jeune_sexe != '')                             AS valeur_inattendue
FROM gd_inscriptions
WHERE deleted_at IS NULL;

-- Si les chiffres sont conformes → COMMIT
-- Si résultat inattendu (encore_vides > 2, valeur_inattendue > 0) → ROLLBACK ci-dessous
COMMIT;
-- En cas d'erreur : remplacer COMMIT par ROLLBACK;


-- ─── SECTION 3 : ROLLBACK ─────────────────────────────────────────────────────
-- Exécuter SEULEMENT si la section 2 a produit des résultats incorrects.
-- Restaure les valeurs NULL d'origine depuis le snapshot temporaire.

/*
BEGIN;

UPDATE gd_inscriptions i
SET
  jeune_sexe = s.jeune_sexe,
  updated_at = s.updated_at
FROM _backfill_snapshot_sexe s
WHERE i.id = s.id;

-- Vérification post-rollback
SELECT
  'APRÈS ROLLBACK' AS phase,
  COUNT(*) FILTER (WHERE jeune_sexe IS NULL OR jeune_sexe = '') AS sexe_vide,
  COUNT(*) FILTER (WHERE jeune_sexe = 'À RENSEIGNER')          AS fallback_renseigner
FROM gd_inscriptions
WHERE deleted_at IS NULL;

COMMIT;
*/


-- ─── SECTION 4 : VÉRIFICATION FINALE (lecture seule, post-exécution) ──────────
-- Relancer après COMMIT pour confirmer l'état final en prod.

/*
SELECT
  i.id,
  i.jeune_prenom,
  i.jeune_nom,
  i.jeune_sexe,
  d.ged_sent_at,
  i.status,
  i.updated_at
FROM gd_inscriptions i
LEFT JOIN gd_dossier_enfant d ON d.inscription_id = i.id
WHERE i.deleted_at IS NULL
ORDER BY i.updated_at DESC
LIMIT 20;
*/
