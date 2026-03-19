export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { createClient } from '@supabase/supabase-js';
import { sendStatusChangeEmail } from '@/lib/email';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET /api/admin/inscriptions/[id]
 * Détail d'une inscription depuis Supabase gd_inscriptions.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getSupabase();
    const auth = await verifyAuth(req);
    if (!auth) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Non autorisé' } },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from('gd_inscriptions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Inscription non trouvée' } },
        { status: 404 }
      );
    }

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
    const supabase = getSupabase();
    const auth = await verifyAuth(req);
    if (!auth || !['ADMIN', 'EDITOR'].includes(auth.role)) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Non autorisé' } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { status, payment_status, documents_status, besoins_pris_en_compte, equipe_informee, note_pro } = body;

    // Validation des statuts
    const validStatuses = ['en_attente', 'validee', 'refusee', 'annulee'];
    const validPaymentStatuses = ['pending_payment', 'paid', 'failed'];
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

    const { data, error } = await supabase
      .from('gd_inscriptions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('PUT /api/admin/inscriptions/[id] Supabase error:', error);
      throw error;
    }

    // Email non-bloquant si le statut a changé
    if (status && data.referent_email) {
      sendStatusChangeEmail(
        data.referent_email,
        data.referent_nom,
        data.jeune_prenom,
        data.jeune_nom,
        status
      ).catch(() => {});
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
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: inscriptionId } = await params;
    const supabase = getSupabase();
    const auth = await verifyAuth(req);
    if (!auth || auth.role !== 'ADMIN') {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Seul un admin peut supprimer.' } },
        { status: 401 }
      );
    }

    // Supprimer le dossier enfant lie
    await supabase.from('gd_dossier_enfant').delete().eq('inscription_id', inscriptionId);

    // Supprimer les propositions tarifaires liees
    await supabase.from('gd_propositions_tarifaires').delete().eq('inscription_id', inscriptionId);

    // Supprimer l'inscription
    const { error } = await supabase.from('gd_inscriptions').delete().eq('id', inscriptionId);

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
