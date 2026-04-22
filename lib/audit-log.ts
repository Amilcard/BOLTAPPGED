/**
 * RGPD/CNIL — Journal d'audit tamper-proof des accès aux données sensibles de mineurs.
 * Traçabilité obligatoire pour les données Art. 9 (santé, handicap).
 *
 * Sécurité :
 * - Table gd_audit_log protégée par RLS append-only (no SELECT/UPDATE/DELETE pour les clients)
 * - Chaque entrée inclut un integrity_hash SHA-256 pour détecter toute modification
 * - service_role bypass RLS pour l'insertion
 *
 * Usage :
 *   await auditLog(supabase, { action: 'read', resourceType: 'dossier_enfant', ... });
 */

import type { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { getClientIpFromHeaders } from '@/lib/rate-limit';
import { captureServerException, captureServerMessage } from '@/lib/sentry-capture';

interface AuditLogEntry {
  action: 'read' | 'create' | 'update' | 'delete' | 'upload' | 'download' | 'submit';
  resourceType: 'dossier_enfant' | 'inscription' | 'document' | 'structure' | 'facture' | 'team_member' | 'proposition' | 'paiement' | 'delegation' | 'session' | 'smart_form_submission';
  resourceId: string;
  inscriptionId?: string;
  actorType: 'referent' | 'admin' | 'system' | 'staff';
  actorId?: string;       // email ou userId
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Génère un hash SHA-256 d'intégrité pour une entrée d'audit.
 * Permet de vérifier qu'une entrée n'a pas été modifiée après insertion.
 */
function computeIntegrityHash(entry: {
  action: string;
  resource_id: string;
  inscription_id: string | null;
  actor_type: string;
  actor_id: string | null;
  timestamp: string;
}): string {
  const data = [
    entry.action,
    entry.resource_id,
    entry.inscription_id || '',
    entry.actor_type,
    entry.actor_id || '',
    entry.timestamp,
  ].join('|');
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Extraire l'IP du client depuis les headers Next.js / Vercel.
 * Délègue à `getClientIpFromHeaders` (lib/rate-limit) pour une source unique.
 * Préserve la sémantique audit-log : retour `undefined` si IP absente
 * (ne pas stocker 'unknown' dans gd_audit_log.ip_address).
 */
export function getClientIp(req: NextRequest): string | undefined {
  const ip = getClientIpFromHeaders(req.headers);
  return ip === 'unknown' ? undefined : ip;
}

/**
 * Enregistrer une entrée dans le journal d'audit (tamper-proof).
 * Non-bloquant par défaut (fire-and-forget avec catch), mais peut être awaité.
 */
export async function auditLog(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  entry: AuditLogEntry
): Promise<void> {
  try {
    const now = new Date().toISOString();

    const row = {
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId,
      inscription_id: entry.inscriptionId || null,
      actor_type: entry.actorType,
      actor_id: entry.actorId || null,
      ip_address: entry.ipAddress || null,
      metadata: entry.metadata || {},
      integrity_hash: computeIntegrityHash({
        action: entry.action,
        resource_id: entry.resourceId,
        inscription_id: entry.inscriptionId || null,
        actor_type: entry.actorType,
        actor_id: entry.actorId || null,
        timestamp: now,
      }),
    };

    const { error } = await supabase
      .from('gd_audit_log')
      .insert(row);

    if (error) {
      // CRITIQUE : un échec d'audit est un incident RGPD — ne pas ignorer
      console.error('[AUDIT-LOG CRITIQUE] Insertion échouée — données potentiellement non tracées:', {
        error: error.message,
        code: error.code,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        actorId: entry.actorId,
      });
      captureServerMessage(
        '[AUDIT-LOG] DB insert failed — legal trace lost',
        { domain: 'audit', operation: 'audit_log_insert' },
        'fatal',
        {
          error_code: error.code ?? null,
          error_message: error.message ?? null,
          action: entry.action,
          resource_type: entry.resourceType,
          actor_type: entry.actorType,
        },
      );
    }
  } catch (err) {
    console.error('[AUDIT-LOG CRITIQUE] Erreur inattendue:', err);
    captureServerException(
      err,
      { domain: 'audit', operation: 'audit_log_unexpected' },
      {
        action: entry.action,
        resource_type: entry.resourceType,
        actor_type: entry.actorType,
      },
      'fatal',
    );
  }
}
