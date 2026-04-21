export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireEditor, errorResponse } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';

/**
 * GET /api/admin/demandes-tarifs
 *
 * Liste paginée des leads price-inquiry (smart_form_submissions).
 * Sécurité :
 *  - EDITOR+ uniquement (requireEditor).
 *  - smart_form_submissions a RLS deny_all → passe obligatoirement par service_role.
 *  - Pas d'auditLog sur la liste (métadonnées agrégées, pas de lecture PII ciblée).
 *    L'auditLog `read` se fait sur la route détail /[id].
 *  - Pagination cappée à 100/page (anti-DoS).
 */

const LIST_WINDOW = new Set(['30d', '90d', 'all']);

const ListQuerySchema = z.object({
  email: z.string().trim().toLowerCase().max(120).optional(),
  organization: z.string().trim().max(200).optional(),
  window: z.enum(['30d', '90d', 'all']).optional(),
  treated: z.enum(['all', 'pending', 'done']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

function windowCutoff(window: string | undefined): string | null {
  if (!window || window === 'all') return null;
  const days = window === '90d' ? 90 : 30;
  const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000);
  return cutoff.toISOString();
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireEditor(req);
    if (!auth) {
      return errorResponse('UNAUTHORIZED', 'Accès réservé aux éditeurs et administrateurs.', 401);
    }

    const { searchParams } = new URL(req.url);
    const parsed = ListQuerySchema.safeParse({
      email: searchParams.get('email') ?? undefined,
      organization: searchParams.get('organization') ?? undefined,
      window: searchParams.get('window') ?? undefined,
      treated: searchParams.get('treated') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });
    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Paramètres invalides.', 400);
    }
    // Garde-fou runtime en plus de Zod (defense-in-depth si params forgés)
    if (parsed.data.window && !LIST_WINDOW.has(parsed.data.window)) {
      return errorResponse('VALIDATION_ERROR', 'Fenêtre invalide.', 400);
    }

    const { email, organization, window, treated, page, limit } = parsed.data;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('smart_form_submissions')
      .select(
        'id, contact_email, referent_organization, child_age, urgence_48h, handicap, qf, qpv, suggested_stays, alert_priority, submitted_at, crm_synced_at, crm_lead_id, consent_at',
        { count: 'exact' }
      )
      .order('submitted_at', { ascending: false })
      .range(from, to);

    if (email) query = query.ilike('contact_email', `%${email}%`);
    if (organization) query = query.ilike('referent_organization', `%${organization}%`);

    const cutoff = windowCutoff(window);
    if (cutoff) query = query.gte('submitted_at', cutoff);

    if (treated === 'done') query = query.not('crm_synced_at', 'is', null);
    if (treated === 'pending') query = query.is('crm_synced_at', null);

    const { data, count, error } = await query;
    if (error) {
      console.error('[admin/demandes-tarifs] list error:', error.code, error.message);
      return errorResponse('INTERNAL_ERROR', 'Erreur serveur.', 500);
    }

    return NextResponse.json({
      data: data ?? [],
      total: count ?? 0,
      page,
      limit,
    });
  } catch (err) {
    console.error('[admin/demandes-tarifs] unexpected error:', err instanceof Error ? err.message : 'unknown');
    return errorResponse('INTERNAL_ERROR', 'Erreur serveur.', 500);
  }
}
