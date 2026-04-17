export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_METHODES = ['virement', 'cb_stripe', 'cheque'] as const;

type SupabaseAdmin = ReturnType<typeof import('@/lib/supabase-server').getSupabaseAdmin>;

async function syncStatutFacture(supabase: SupabaseAdmin, factureId: string): Promise<void> {
  const { data: facture } = await supabase
    .from('gd_factures')
    .select('montant_total, statut')
    .eq('id', factureId)
    .single();

  if (!facture || facture.statut === 'annulee') return;

  const { data: paiements } = await supabase
    .from('gd_facture_paiements')
    .select('montant')
    .eq('facture_id', factureId);

  const totalPaye = (paiements ?? []).reduce((s, p) => s + (Number(p.montant) || 0), 0);
  const montantTotal = Number(facture.montant_total) || 0;

  let newStatut: string;
  if (totalPaye <= 0) {
    newStatut = facture.statut === 'envoyee' ? 'envoyee' : 'brouillon';
  } else if (totalPaye >= montantTotal) {
    newStatut = 'payee';
  } else {
    newStatut = 'payee_partiel';
  }

  if (newStatut !== facture.statut) {
    await supabase.from('gd_factures').update({ statut: newStatut }).eq('id', factureId);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEditor(req);
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'ID invalide' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('gd_facture_paiements')
    .select('*')
    .eq('facture_id', id)
    .order('date_paiement', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ paiements: data ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEditor(req);
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'ID invalide' }, { status: 400 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Corps invalide' }, { status: 400 }); }

  const { date_paiement, montant, methode, reference, note } = body;

  if (!date_paiement || typeof date_paiement !== 'string') {
    return NextResponse.json({ error: 'date_paiement requis (YYYY-MM-DD)' }, { status: 400 });
  }
  if (!montant || Number(montant) <= 0) {
    return NextResponse.json({ error: 'montant doit être > 0' }, { status: 400 });
  }
  if (!VALID_METHODES.includes(methode as typeof VALID_METHODES[number])) {
    return NextResponse.json({ error: `methode invalide. Valeurs : ${VALID_METHODES.join(', ')}` }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: facture } = await supabase
    .from('gd_factures')
    .select('id, statut')
    .eq('id', id)
    .single();

  if (!facture) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 });
  if (facture.statut === 'annulee') {
    return NextResponse.json({ error: 'Impossible d\'ajouter un paiement à une facture annulée' }, { status: 400 });
  }

  const { data: paiement, error } = await supabase
    .from('gd_facture_paiements')
    .insert({
      facture_id:    id,
      date_paiement: String(date_paiement),
      montant:       Number(montant),
      methode:       String(methode),
      reference:     String(reference ?? ''),
      note:          String(note ?? ''),
    })
    .select()
    .single();

  if (error) {
    console.error('[factures paiements POST]', error.message);
    return NextResponse.json({ error: 'Erreur enregistrement paiement' }, { status: 500 });
  }

  await syncStatutFacture(supabase, id);

  return NextResponse.json({ paiement }, { status: 201 });
}
