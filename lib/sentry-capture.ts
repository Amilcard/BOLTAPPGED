/**
 * Sentry capture helpers — server-only.
 *
 * Centralise les appels Sentry.captureException / captureMessage avec un
 * contrat typé sur les tags (domain + operation). Non-bloquant : tout échec
 * Sentry est silencieux (Sentry SDK gère déjà son propre try/catch interne).
 *
 * Règles PII (en plus du beforeSend dans instrumentation.ts) :
 *   - `extra` accepte uniquement des primitives (string | number | boolean | null)
 *   - ne JAMAIS passer un objet complet contenant email / nom / téléphone
 *   - IDs UUID OK, montants OK, codes d'erreur OK
 *
 * Usage :
 *   captureServerException(err, { domain: 'payment', operation: 'stripe_webhook' }, { eventId });
 *   captureServerMessage('AMOUNT_MISMATCH', { domain: 'payment', operation: 'stripe_amount_check' },
 *                        'error', { inscriptionId, stripeAmount, dbAmount });
 */

// server-only — importé uniquement depuis lib/ et app/api/*, garde via règle
// depcruise `supabase-server-isolation` (même périmètre que les helpers server).
import * as Sentry from '@sentry/nextjs';

export type CaptureDomain =
  | 'payment'
  | 'rgpd'
  | 'auth'
  | 'audit'
  | 'cron'
  | 'upload';

export interface CaptureTags {
  domain: CaptureDomain;
  operation: string;
}

type ExtraValue = string | number | boolean | null;
export type CaptureExtra = Record<string, ExtraValue>;

type CaptureLevel = 'warning' | 'error' | 'fatal';

export function captureServerException(
  error: unknown,
  tags: CaptureTags,
  extra?: CaptureExtra,
  level: CaptureLevel = 'error',
): void {
  Sentry.captureException(error, {
    tags: { ...tags, surface: 'server' },
    extra: extra as Record<string, unknown> | undefined,
    level,
  });
}

export function captureServerMessage(
  message: string,
  tags: CaptureTags,
  level: CaptureLevel = 'error',
  extra?: CaptureExtra,
): void {
  Sentry.captureMessage(message, {
    tags: { ...tags, surface: 'server' },
    extra: extra as Record<string, unknown> | undefined,
    level,
  });
}
