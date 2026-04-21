/**
 * email-logger — journalisation centralisée des échecs d'envoi email.
 *
 * Introduction lot L1/6 du refactor EmailResult. Utilisé dans les lots
 * L2-L5 par les 24 fonctions d'envoi refactorées. Ne casse rien en L1
 * (pas encore appelé par les callsites).
 *
 * Règles :
 * - JAMAIS de PII dans reason (enum fermé uniquement)
 * - JAMAIS throw (catch interne, log console si auditLog échoue)
 * - actorType='system' — c'est l'infra email, pas un acteur humain
 */

import { auditLog } from '@/lib/audit-log';
import type { EmailResult } from '@/lib/email';
import { getSupabaseAdmin } from '@/lib/supabase-server';

/**
 * Log centralisé pour échec email.
 * Reason = enum fermé uniquement, JAMAIS de PII (email, nom, etc.).
 *
 * @param context — identifiant du callsite (ex. 'sendInscriptionConfirmation')
 * @param result — résultat EmailResult avec sent=false (type-safe via Extract)
 * @param resourceType — optionnel, ressource liée (défaut 'email')
 * @param resourceId — optionnel, id ressource liée (défaut 'system')
 */
export async function logEmailFailure(
  context: string,
  result: Extract<EmailResult, { sent: false }>,
  resourceType?: string,
  resourceId?: string
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    await auditLog(supabase, {
      // auditLog accepte 'update' — on journalise un événement d'échec email.
      // resourceType/resourceId typés 'any' côté auditLog pour compat backward,
      // on passe via cast local pour garder le contrat EmailResult strict ici.
      action: 'update',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resourceType: (resourceType || 'email') as any,
      resourceId: resourceId || 'system',
      actorType: 'system',
      metadata: { event: 'email_failed', context, reason: result.reason },
    });
  } catch (err) {
    console.error(`[email-logger] auditLog failed for ${context}:`, err);
  }
}
