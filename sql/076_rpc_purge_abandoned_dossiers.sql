-- ═══════════════════════════════════════════════════════════════════════
-- Migration 076 — RPC gd_get_dossiers_purge_candidates
-- ═══════════════════════════════════════════════════════════════════════
-- Objectif : retourner les dossiers enfants abandonnés éligibles à la purge RGPD.
-- Utilisée par /api/cron/rgpd-purge (handler purgeAbandonedDossierStorage).
--
-- Policy validée utilisateur (2026-04-21) :
--   - status='refusee'   → updated_at < NOW() - 90j
--   - status='en_attente' → updated_at < NOW() - 180j  (hors paiement en cours)
--   - Inactif (updated_at < NOW() - 180j, status ≠ 'validee' ni 'refusee' ni 'en_attente')
--   - Soft-deleted (deleted_at < NOW() - 90j)
--
-- Garde anti-régression :
--   - payment_status IN ('pending_payment','pending_transfer','pending_check')
--     → EXCLUS (webhook Stripe tardif possible, ne pas casser la facturation).
--   - status='validee' → JAMAIS purgé (séjour effectué, historique préservé).
--
-- Pagination obligatoire (LIMIT) pour éviter timeout Vercel 300s.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION gd_get_dossiers_purge_candidates(
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  dossier_id UUID,
  inscription_id UUID,
  purge_policy TEXT,
  documents_joints JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id AS dossier_id,
    d.inscription_id,
    CASE
      WHEN i.deleted_at IS NOT NULL AND i.deleted_at < NOW() - INTERVAL '90 days'
        THEN 'soft_deleted_90j'
      WHEN i.status = 'refusee'
        AND COALESCE(i.updated_at, i.created_at) < NOW() - INTERVAL '90 days'
        THEN 'refusee_90j'
      WHEN i.status = 'en_attente'
        AND COALESCE(i.updated_at, i.created_at) < NOW() - INTERVAL '180 days'
        AND (i.payment_status IS NULL
             OR i.payment_status NOT IN ('pending_payment','pending_transfer','pending_check'))
        THEN 'en_attente_180j'
      WHEN i.status NOT IN ('validee','refusee','en_attente')
        AND COALESCE(i.updated_at, i.created_at) < NOW() - INTERVAL '180 days'
        THEN 'inactif_180j'
      ELSE NULL
    END AS purge_policy,
    d.documents_joints
  FROM gd_dossier_enfant d
  INNER JOIN gd_inscriptions i ON i.id = d.inscription_id
  WHERE (
    -- Soft-delete >90j
    (i.deleted_at IS NOT NULL AND i.deleted_at < NOW() - INTERVAL '90 days')
    -- Refusée >90j
    OR (
      i.deleted_at IS NULL
      AND i.status = 'refusee'
      AND COALESCE(i.updated_at, i.created_at) < NOW() - INTERVAL '90 days'
    )
    -- En attente >180j (hors paiement en cours)
    OR (
      i.deleted_at IS NULL
      AND i.status = 'en_attente'
      AND COALESCE(i.updated_at, i.created_at) < NOW() - INTERVAL '180 days'
      AND (i.payment_status IS NULL
           OR i.payment_status NOT IN ('pending_payment','pending_transfer','pending_check'))
    )
    -- Inactif >180j (statuts hors liste connue)
    OR (
      i.deleted_at IS NULL
      AND i.status NOT IN ('validee','refusee','en_attente')
      AND COALESCE(i.updated_at, i.created_at) < NOW() - INTERVAL '180 days'
    )
  )
  ORDER BY COALESCE(i.deleted_at, i.updated_at, i.created_at) ASC
  LIMIT GREATEST(1, LEAST(p_limit, 500));
$$;

COMMENT ON FUNCTION gd_get_dossiers_purge_candidates(INTEGER) IS
  'RGPD O2 — Retourne les dossiers enfants éligibles à la purge (refusee 90j, en_attente 180j, inactif 180j, soft-deleted 90j). Exclut les inscriptions avec paiement Stripe en cours.';

NOTIFY pgrst, 'reload schema';
