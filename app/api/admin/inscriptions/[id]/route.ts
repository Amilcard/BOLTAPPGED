export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor, requireAdmin } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { auditLog } from '@/lib/audit-log';
import { performInscriptionUpdate } from '@/lib/admin-inscriptions-update';
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
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: inscriptionId } = await params;
    if (!UUID_REGEX.test(inscriptionId)) {
      return NextResponse.json({ error: { code: 'INVALID_ID', message: 'ID invalide.' } }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const auth = await requireAdmin(req);
    if (!auth) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Seul un administrateur peut supprimer.' } },
        { status: 403 }
      );
    }

    // RGPD — tracer suppression inscription par admin (avant l'opération)
    await auditLog(supabase, {
      action: 'delete',
      resourceType: 'inscription',
      resourceId: inscriptionId,
      actorType: 'admin',
      actorId: auth.email,
    });

    // Soft delete : marquer deleted_at plutôt que supprimer physiquement
    const { error } = await supabase
      .from('gd_inscriptions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', inscriptionId)
      .is('deleted_at', null);

    if (error) {
      console.error('DELETE /api/admin/inscriptions/[id] error:', error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/admin/inscriptions/[id] error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
