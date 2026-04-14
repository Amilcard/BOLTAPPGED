export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { requireEditor } from '@/lib/auth-middleware';
import { auditLog } from '@/lib/audit-log';

const VALID_METHODES = ['virement', 'cb_stripe', 'cheque'] as const;

/**
 * GET /api/admin/factures/[id]/paiements — Liste les paiements d'une facture
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireEditor(request);
    if (!auth) {
      return NextResponse.json({ error: 'Accès réservé aux éditeurs et administrateurs.' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('gd_facture_paiements')
      .select('*')
      .eq('facture_id', id)
      .order('date_paiement', { ascending: true });

    if (error) {
      console.error('Supabase error (GET paiements):', error);
      throw error;
    }

    return NextResponse.json({ paiements: data || [] });
  } catch (err: unknown) {
    console.error('Error in GET paiements:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/factures/[id]/paiements — Ajouter un paiement
 * Body: { date_paiement, montant, methode, reference? }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireEditor(req);
    if (!auth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id: factureId } = await params;
    const supabase = getSupabase();
    const body = await req.json();

    const { date_paiement, montant, methode, reference } = body;

    // Validation
    if (!date_paiement) {
      return NextResponse.json({ error: 'date_paiement requis.' }, { status: 400 });
    }
    if (!montant || typeof montant !== 'number' || montant <= 0) {
      return NextResponse.json({ error: 'montant doit être un nombre > 0.' }, { status: 400 });
    }
    if (!methode || !VALID_METHODES.includes(methode as typeof VALID_METHODES[number])) {
      return NextResponse.json(
        { error: `methode invalide. Valeurs : ${VALID_METHODES.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify facture exists
    const { data: facture, error: fetchErr } = await supabase
      .from('gd_factures')
      .select('id, montant_total, statut')
      .eq('id', factureId)
      .single();

    if (fetchErr || !facture) {
      return NextResponse.json({ error: 'Facture introuvable.' }, { status: 404 });
    }

    // Guard : pas de paiement sur facture annulée
    if ((facture as Record<string, unknown>).statut === 'annulee') {
      return NextResponse.json({ error: 'Impossible d\'enregistrer un paiement sur une facture annulée.' }, { status: 400 });
    }

    // Insert paiement
    const { data: paiement, error: insertErr } = await supabase
      .from('gd_facture_paiements')
      .insert({
        facture_id: factureId,
        date_paiement,
        montant,
        methode,
        reference: reference || null,
        created_by: auth.email,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Recalculate: sum all paiements for this facture
    const { data: allPaiements } = await supabase
      .from('gd_facture_paiements')
      .select('montant')
      .eq('facture_id', factureId);

    const totalPaye = (allPaiements || []).reduce(
      (sum: number, p: Record<string, unknown>) => sum + Number(p.montant),
      0
    );

    const montantTotal = Number(facture.montant_total);
    let newStatut: string | null = null;

    if (totalPaye >= montantTotal && montantTotal > 0) {
      newStatut = 'payee';
    } else if (totalPaye > 0 && totalPaye < montantTotal) {
      newStatut = 'payee_partiel';
    }

    if (newStatut && newStatut !== facture.statut) {
      await supabase
        .from('gd_factures')
        .update({ statut: newStatut })
        .eq('id', factureId);
    }

    await auditLog(supabase, {
      action: 'create',
      resourceType: 'facture',
      resourceId: paiement.id,
      actorType: 'admin',
      actorId: auth.email,
      metadata: {
        type: 'paiement_added',
        facture_id: factureId,
        montant,
        methode,
        total_paye: totalPaye,
        new_statut: newStatut || facture.statut,
      },
    });

    return NextResponse.json({ paiement, total_paye: totalPaye, statut: newStatut || facture.statut }, { status: 201 });
  } catch (err: unknown) {
    console.error('Error creating paiement:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
