export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireEditor, errorResponse } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { auditLog, getClientIp } from '@/lib/audit-log';
import { UUID_RE } from '@/lib/validators';

/**
 * GET /api/admin/demandes-tarifs/[id]
 *
 * Détail d'un lead price-inquiry. Lecture tracée (PII : contact_email).
 * CLAUDE.md §15 — auditLog obligatoire sur lecture PII.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEditor(req);
  if (!auth) {
    return errorResponse('UNAUTHORIZED', 'Accès réservé aux éditeurs et administrateurs.', 401);
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return errorResponse('INVALID_ID', 'Identifiant invalide.', 400);
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('smart_form_submissions')
    .select(
      'id, contact_email, contact_phone, referent_organization, inclusion_level, child_age, interests, urgence_48h, handicap, qf, qpv, suggested_stays, alert_priority, submitted_at, crm_synced_at, crm_lead_id, consent_at, user_agent'
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[admin/demandes-tarifs/:id] fetch error:', error.code, error.message);
    return errorResponse('INTERNAL_ERROR', 'Erreur serveur.', 500);
  }
  if (!data) {
    return errorResponse('NOT_FOUND', 'Demande introuvable.', 404);
  }

  // §15 — auditLog sur lecture PII (contact_email). Pas d'email dans metadata.
  await auditLog(supabase, {
    action: 'read',
    resourceType: 'smart_form_submission',
    resourceId: id,
    actorType: 'admin',
    actorId: auth.email,
    ipAddress: getClientIp(req),
    metadata: {
      source: 'admin_demandes_tarifs_detail',
      role: auth.role,
    },
  });

  return NextResponse.json(data);
}

/**
 * PATCH /api/admin/demandes-tarifs/[id]
 *
 * Toggle du statut de traitement. treated=true → crm_synced_at=now() (+ crm_lead_id optionnel).
 * treated=false → remet crm_synced_at=null et crm_lead_id=null.
 * EDITOR+ (pas destructif).
 */
const PatchSchema = z.object({
  treated: z.boolean(),
  crm_lead_id: z.string().trim().max(100).optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEditor(req);
  if (!auth) {
    return errorResponse('UNAUTHORIZED', 'Accès réservé aux éditeurs et administrateurs.', 401);
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return errorResponse('INVALID_ID', 'Identifiant invalide.', 400);
  }

  const body = await req.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Corps invalide.', 400);
  }
  const { treated, crm_lead_id } = parsed.data;

  const supabase = getSupabaseAdmin();

  const update = treated
    ? {
        crm_synced_at: new Date().toISOString(),
        crm_lead_id: crm_lead_id ?? null,
      }
    : {
        crm_synced_at: null,
        crm_lead_id: null,
      };

  const { data, error } = await supabase
    .from('smart_form_submissions')
    .update(update)
    .eq('id', id)
    .select('id, crm_synced_at, crm_lead_id')
    .maybeSingle();

  if (error) {
    console.error('[admin/demandes-tarifs/:id] patch error:', error.code, error.message);
    return errorResponse('INTERNAL_ERROR', 'Erreur serveur.', 500);
  }
  if (!data) {
    return errorResponse('NOT_FOUND', 'Demande introuvable.', 404);
  }

  await auditLog(supabase, {
    action: 'update',
    resourceType: 'smart_form_submission',
    resourceId: id,
    actorType: 'admin',
    actorId: auth.email,
    ipAddress: getClientIp(req),
    metadata: {
      source: 'admin_demandes_tarifs_detail',
      treated,
      crm_lead_id_set: Boolean(crm_lead_id),
    },
  });

  return NextResponse.json({ success: true, data });
}
