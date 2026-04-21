-- ============================================================================
-- Migration 075 — Auto-création gd_dossier_enfant à l'insertion inscription
-- Date : 2026-04-21
-- Origine : audit testeuse humaine Thanh + audit DB supabase-integrity-auditor.
--           4 inscriptions prod sans dossier associé → si l'éducateur clique
--           le lien dossier, 404 "NO_DATA" retourné (UI skeleton).
--           Camille (53e2a67e, 20/04) + 3 historiques 10/04.
--
-- Stratégie :
--   1. Ajouter UNIQUE (inscription_id) sur gd_dossier_enfant (prérequis trigger)
--   2. Backfill les 4 orphelins existants (ON CONFLICT DO NOTHING → idempotent)
--   3. Créer trigger AFTER INSERT ON gd_inscriptions qui crée la ligne dossier
--      vide (tous les JSONs NULL, renseignements_completed = false).
--
-- Sécurité :
--   - SECURITY DEFINER obligatoire (trigger s'exécute avec droits propriétaire
--     pour bypass RLS service_role-only sur gd_dossier_enfant).
--   - search_path = public pour éviter search_path injection.
--   - ON CONFLICT DO NOTHING : idempotent, aucune erreur si dossier existe déjà.
--   - Trigger non-bloquant : une erreur sur INSERT dossier ne doit PAS bloquer
--     l'INSERT inscription (exception catch + RAISE WARNING).
--
-- Rollback :
--   DROP TRIGGER trg_auto_create_dossier_enfant ON gd_inscriptions;
--   DROP FUNCTION fn_auto_create_dossier_enfant();
--   ALTER TABLE gd_dossier_enfant DROP CONSTRAINT uq_dossier_inscription;
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Étape 1 — Contrainte UNIQUE (prérequis trigger ON CONFLICT)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE gd_dossier_enfant
  ADD CONSTRAINT uq_dossier_inscription UNIQUE (inscription_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Étape 2 — Backfill des inscriptions orphelines (4 lignes attendues)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO gd_dossier_enfant (inscription_id, renseignements_completed)
SELECT i.id, FALSE
FROM gd_inscriptions i
LEFT JOIN gd_dossier_enfant d ON d.inscription_id = i.id
WHERE d.id IS NULL
  AND i.deleted_at IS NULL
ON CONFLICT (inscription_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Étape 3 — Fonction trigger idempotente, non-bloquante, SECURITY DEFINER
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_auto_create_dossier_enfant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO gd_dossier_enfant (inscription_id, renseignements_completed)
  VALUES (NEW.id, FALSE)
  ON CONFLICT (inscription_id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Non-bloquant : si création dossier échoue (rare), l'inscription doit passer.
    -- L'erreur est loggée mais n'annule pas la transaction globale.
    RAISE WARNING 'fn_auto_create_dossier_enfant failed for inscription %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Étape 4 — Création trigger AFTER INSERT
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_auto_create_dossier_enfant ON gd_inscriptions;
CREATE TRIGGER trg_auto_create_dossier_enfant
AFTER INSERT ON gd_inscriptions
FOR EACH ROW
EXECUTE FUNCTION fn_auto_create_dossier_enfant();

COMMIT;

-- Vérifications post-migration (à lancer après commit)
-- 1) Plus aucun orphelin :
-- SELECT COUNT(*) AS orphelins_restants
-- FROM gd_inscriptions i
-- LEFT JOIN gd_dossier_enfant d ON d.inscription_id = i.id
-- WHERE d.id IS NULL AND i.deleted_at IS NULL;
-- Attendu : 0
--
-- 2) Trigger actif :
-- SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'trg_auto_create_dossier_enfant';
-- Attendu : O (enabled)
