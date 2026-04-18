-- Migration 073 — Ajouter 'refunded' et 'partially_refunded' aux payment_status
-- Requis pour le case charge.refunded du webhook Stripe (backlog #14).
--
-- Avant : pending_payment, pending_transfer, pending_check, paid, failed, amount_mismatch
-- Après : + refunded, partially_refunded

ALTER TABLE gd_inscriptions
  DROP CONSTRAINT IF EXISTS gd_inscriptions_payment_status_check;

ALTER TABLE gd_inscriptions
  ADD CONSTRAINT gd_inscriptions_payment_status_check
  CHECK (payment_status = ANY (ARRAY[
    'pending_payment',
    'pending_transfer',
    'pending_check',
    'paid',
    'failed',
    'amount_mismatch',
    'refunded',
    'partially_refunded'
  ]));

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
