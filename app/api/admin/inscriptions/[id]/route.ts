export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor, requireAdmin } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { auditLog } from '@/lib/audit-log';
import { performInscriptionUpdate } from '@/lib/admin-inscriptions-update';
import { performInscriptionDelete } from '@/lib/admin-inscriptions-delete';
/**
 * GET /api/admin/inscriptions/[id]
 * Détail d'une inscription depuis Supabase gd_inscriptions.
 * Requiert rôle EDITOR minimum (pas VIEWER — données enfants ASE).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const auth = await requireEditor(req);
    if (!auth) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Accès réservé aux éditeurs et administrateurs.' } },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from('gd_inscriptions')
      .select('id, dossier_ref, jeune_prenom, jeune_nom, referent_nom, referent_email, organisation, sejour_titre, sejour_slug, status, payment_status, payment_method, price_total, structure_id, created_at, updated_at, suivi_token, documents_status')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Inscription non trouvée' } },
        { status: 404 }
      );
    }

    // RGPD Art. 9 — tracer lecture données enfant par admin
    await auditLog(supabase, {
      action: 'read',
      resourceType: 'inscription',
      resourceId: id,
      actorType: 'admin',
      actorId: auth.email,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/admin/inscriptions/[id] error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/inscriptions/[id]
 * Met à jour le statut d'une inscription dans Supabase.
 * Statuts possibles : en_attente, validee, refusee, annulee
 *
 * Legacy : route conservée pour compat. Logique métier déléguée à
 * lib/admin-inscriptions-update.ts (partagée avec PUT /api/admin/inscriptions).
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const auth = await requireEditor(req);
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Accès réservé aux éditeurs et administrateurs.' } },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  return performInscriptionUpdate(supabase, id, body as Record<string, unknown>, auth.email);
}

/**
 * DELETE /api/admin/inscriptions/[id]
 * Supprime une inscription et ses donnees liees (dossier enfant, propositions).
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: inscriptionId } = await params;
  const auth = await requireAdmin(req);
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Seul un administrateur peut supprimer.' } },
      { status: 403 }
    );
  }
  return performInscriptionDelete(getSupabaseAdmin(), inscriptionId, auth.email);
}
