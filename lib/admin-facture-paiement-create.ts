import { getSupabaseAdmin } from '@/lib/supabase-server';
import { auditLog } from '@/lib/audit-log';
import { UUID_RE } from '@/lib/validators';

/**
 * Shared helper pour l'enregistrement d'un paiement sur une facture admin.
 * Partagé entre :
 *   - POST /api/admin/factures/[id]/paiements (legacy, conservé)
 *   - POST /api/admin/factures/paiements (body-based, anti-SSRF préemptif)
 *
 * Pattern cohérent avec Lots 1-3 (users, stays, propositions).
 *
 * Aucun NextRequest/NextResponse ici — la logique HTTP + auth reste dans les routes.
 * Validation UUID + whitelist methodes + guard statut='annulee' + INSERT
 * + syncStatutFacture + auditLog reproduits EXACTEMENT depuis la route legacy.
 */

const VALID_METHODES = ['virement', 'cb_stripe', 'cheque'] as const;

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

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

export async function runCreatePaiement(params: {
  factureId: string;
  date_paiement: string;
  montant: number;
  methode: string;
  reference?: string;
  note?: string;
  actorEmail: string;
  ip?: string;
}): Promise<{ paiement: unknown } | { error: string; status: number }> {
  const { factureId, date_paiement, montant, methode, reference, note, actorEmail, ip } = params;

  if (!UUID_RE.test(factureId)) {
    return { error: 'ID invalide', status: 400 };
  }

  if (!date_paiement || typeof date_paiement !== 'string') {
    return { error: 'date_paiement requis (YYYY-MM-DD)', status: 400 };
  }
  if (!montant || Number(montant) <= 0) {
    return { error: 'montant doit être > 0', status: 400 };
  }
  if (!VALID_METHODES.includes(methode as typeof VALID_METHODES[number])) {
    return { error: `methode invalide. Valeurs : ${VALID_METHODES.join(', ')}`, status: 400 };
  }

  const supabase = getSupabaseAdmin();

  const { data: facture } = await supabase
    .from('gd_factures')
    .select('id, statut')
    .eq('id', factureId)
    .single();

  if (!facture) return { error: 'Facture introuvable', status: 404 };
  if (facture.statut === 'annulee') {
    return { error: 'Impossible d\'ajouter un paiement à une facture annulée', status: 400 };
  }

  const { data: paiement, error } = await supabase
    .from('gd_facture_paiements')
    .insert({
      facture_id:    factureId,
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
    return { error: 'Erreur enregistrement paiement', status: 500 };
  }

  await syncStatutFacture(supabase, factureId);

  await auditLog(supabase, {
    action: 'create',
    resourceType: 'paiement',
    resourceId: factureId,
    actorType: 'admin',
    actorId: actorEmail,
    ipAddress: ip,
    metadata: { paiement_id: (paiement as { id: string }).id, montant: Number(montant), methode: String(methode) },
  });

  return { paiement };
}
