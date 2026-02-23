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
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
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
      .eq('id', params.id)
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
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = getSupabase();
    const auth = await verifyAuth(req);
    if (!auth || !['ADMIN', 'EDITOR'].includes(auth.role)) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Non autorisé' } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { status, payment_status } = body;

    // Validation des statuts
    const validStatuses = ['en_attente', 'validee', 'refusee', 'annulee'];
    const validPaymentStatuses = ['pending_payment', 'paid', 'failed'];

    const updateData: Record<string, string> = {};

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

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'Aucun champ à mettre à jour' } },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('gd_inscriptions')
      .update(updateData)
      .eq('id', params.id)
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
