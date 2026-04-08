/**
 * RGPD/CNIL — Journal d'audit des accès aux données sensibles de mineurs.
 * Traçabilité obligatoire pour les données Art. 9 (santé, handicap).
 *
 * Usage :
 *   await auditLog(supabase, { action: 'read', resourceType: 'dossier_enfant', ... });
 */

import type { NextRequest } from 'next/server';

interface AuditLogEntry {
  action: 'read' | 'create' | 'update' | 'delete' | 'upload' | 'download' | 'submit';
  resourceType: 'dossier_enfant' | 'inscription' | 'document';
  resourceId: string;
  inscriptionId?: string;
  actorType: 'referent' | 'admin' | 'system';
  actorId?: string;       // email ou userId
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Extraire l'IP du client depuis les headers Next.js / Vercel.
 */
export function getClientIp(req: NextRequest): string | undefined {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    undefined
  );
}

/**
 * Enregistrer une entrée dans le journal d'audit.
 * Non-bloquant par défaut (fire-and-forget avec catch), mais peut être awaité.
 */
export async function auditLog(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  entry: AuditLogEntry
): Promise<void> {
  try {
    const { error } = await supabase
      .from('gd_audit_log')
      .insert({
        action: entry.action,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId,
        inscription_id: entry.inscriptionId || null,
        actor_type: entry.actorType,
        actor_id: entry.actorId || null,
        ip_address: entry.ipAddress || null,
        metadata: entry.metadata || {},
      });

    if (error) {
      // Ne jamais bloquer le flux principal pour un échec d'audit
      console.error('[audit-log] insert failed:', error.message);
    }
  } catch (err) {
    console.error('[audit-log] unexpected error:', err);
  }
}
