-- Migration 085 — gd_outbound_emails
-- Date : 2026-04-22
-- Ref : docs/audits/2026-04-22-topo-review.md §9 (M1) + CLAUDE.md §"T2 State Desync"
--
-- Objectif :
--   1. Registre anti double-envoi email (idempotence)
--   2. Piste de réconciliation multi-système (payment/DB/email desync — T2)
--   3. Preuve RGPD d'envoi (traçabilité 12 mois)
--
-- Pattern RLS : RLS ON + zéro policy = service_role only (deny-all anon/auth)
-- conforme CLAUDE.md §11. Tables PII adjacentes (gd_inscriptions, gd_dossier_enfant)
-- suivent le même pattern.
--
-- Rollback : voir supabase/migrations/ROLLBACK_085.sql

CREATE TABLE IF NOT EXISTS public.gd_outbound_emails (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient         TEXT NOT NULL,
  template_id       TEXT NOT NULL,
  idempotency_key   TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'sent'
                      CHECK (status IN ('sent', 'failed', 'skipped')),
  resend_message_id TEXT,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error_text        TEXT,
  metadata          JSONB,
  -- Marqueur étape amont (payment OK, DB update OK) pour réconciliation cron.
  -- NULL = email loggé mais amont pas encore confirmé → cron alert après 5 min.
  upstream_ok_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_outbound_idempotency UNIQUE (idempotency_key)
);

-- RLS ON + zéro policy = service_role bypass, anon/authenticated bloqués
ALTER TABLE public.gd_outbound_emails ENABLE ROW LEVEL SECURITY;

-- Index pour requêtes courantes :
-- 1. Lister les emails récents d'un destinataire (debug support client)
CREATE INDEX IF NOT EXISTS idx_outbound_recipient_sent
  ON public.gd_outbound_emails(recipient, sent_at DESC);

-- 2. Lister les emails récents d'un template (dashboard admin)
CREATE INDEX IF NOT EXISTS idx_outbound_template_sent
  ON public.gd_outbound_emails(template_id, sent_at DESC);

-- 3. Cron de réconciliation (lignes suspectes)
CREATE INDEX IF NOT EXISTS idx_outbound_reconciliation
  ON public.gd_outbound_emails(status, upstream_ok_at, created_at)
  WHERE status = 'failed' OR upstream_ok_at IS NULL;

COMMENT ON TABLE public.gd_outbound_emails IS
  'Registre email Resend — idempotence + réconciliation state-desync (T2). RGPD rétention 12 mois.';
COMMENT ON COLUMN public.gd_outbound_emails.idempotency_key IS
  'Clé unique fournie par l''appelant (ex: payment_confirm_${inscriptionId}_${eventId}). Voir lib/email.ts.';
COMMENT ON COLUMN public.gd_outbound_emails.upstream_ok_at IS
  'Timestamp quand l''étape amont (payment/DB) est confirmée. NULL = suspect pour cron réconciliation.';
