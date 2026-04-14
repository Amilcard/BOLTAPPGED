export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor, requireAdmin } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendStatusChangeEmail } from '@/lib/email';
import { auditLog } from '@/lib/audit-log';
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
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const body = await req.json();
    const { status, payment_status, documents_status, besoins_pris_en_compte, equipe_informee, note_pro } = body;

    // Validation des statuts
    const validStatuses = ['en_attente', 'validee', 'refusee', 'annulee'];
    const validPaymentStatuses = ['pending_payment', 'paid', 'failed', 'pending_transfer', 'pending_check', 'amount_mismatch'];
    const validDocStatuses = ['en_attente', 'partiellement_recus', 'complets'];

    const updateData: Record<string, unknown> = {};

    if (status) {
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: { code: 'validation_error', message: `Statut invalide. Valeurs : ${validStatuses.join(', ')}` } },
          { status: 400 }
        );
      }
      updateData.status = status;
    }

    if (payment_status) {
      if (!validPaymentStatuses.includes(payment_status)) {
        return NextResponse.json(
          { error: { code: 'validation_error', message: `Statut paiement invalide. Valeurs : ${validPaymentStatuses.join(', ')}` } },
          { status: 400 }
        );
      }
      updateData.payment_status = payment_status;
    }

    // Phase 2 — champs suivi séjour
    if (documents_status !== undefined) {
      if (!validDocStatuses.includes(documents_status)) {
        return NextResponse.json(
          { error: { code: 'validation_error', message: `Statut documents invalide. Valeurs : ${validDocStatuses.join(', ')}` } },
          { status: 400 }
        );
      }
      updateData.documents_status = documents_status;
    }
    if (besoins_pris_en_compte !== undefined) {
      updateData.besoins_pris_en_compte = Boolean(besoins_pris_en_compte);
    }
    if (equipe_informee !== undefined) {
      updateData.equipe_informee = Boolean(equipe_informee);
    }
    if (note_pro !== undefined) {
      updateData.note_pro = typeof note_pro === 'string' ? note_pro : null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'Aucun champ à mettre à jour' } },
        { status: 400 }
      );
    }

    // Lire le statut actuel pour l'audit log (uniquement si status change)
    let oldStatus: string | null = null;
    if (status) {
      const { data: current } = await supabase
        .from('gd_inscriptions')
        .select('status')
        .eq('id', id)
        .single();
      oldStatus = current?.status ?? null;
    }

    const { data, error } = await supabase
      .from('gd_inscriptions')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
      .select('id, status, payment_status, documents_status, besoins_pris_en_compte, equipe_informee, note_pro, updated_at, referent_email, referent_nom, jeune_prenom, jeune_nom, dossier_ref, sejour_slug, suivi_token')
      .single();

    if (error) {
      console.error('PUT /api/admin/inscriptions/[id] Supabase error:', error);
      throw error;
    }

    // RGPD — tracer modification inscription par admin
    await auditLog(supabase, {
      action: 'update',
      resourceType: 'inscription',
      resourceId: id,
      actorType: 'admin',
      actorId: auth.email,
      metadata: { fields: Object.keys(updateData) },
    });

    // Audit log non-bloquant si le statut a changé
    if (status && oldStatus !== status) {
      supabase.from('gd_inscription_status_logs').insert({
        inscription_id: id,
        old_status: oldStatus,
        new_status: status,
        changed_by_email: auth.email,
      }).then(({ error: logError }) => {
        if (logError) console.error('Audit log error:', logError);
      });
    }

    // Email non-bloquant si le statut a changé
    if (status && data.referent_email) {
      sendStatusChangeEmail(
        data.referent_email,
        data.referent_nom,
        data.jeune_prenom,
        data.jeune_nom,
        status
      ).catch((err) => { console.error('[admin/inscriptions] sendStatusChangeEmail failed', err); });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('PUT /api/admin/inscriptions/[id] error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
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
