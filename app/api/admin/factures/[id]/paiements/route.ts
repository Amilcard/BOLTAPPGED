export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { auditLog, getClientIp } from '@/lib/audit-log';
import { UUID_RE } from '@/lib/validators';
import { runCreatePaiement } from '@/lib/admin-facture-paiement-create';

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

  await auditLog(supabase, {
    action: 'read',
    resourceType: 'paiement',
    resourceId: id,
    actorType: 'admin',
    actorId: auth.email,
    ipAddress: getClientIp(req),
    metadata: { context: 'paiements_list' },
  });

  return NextResponse.json({ paiements: data ?? [] });
}

/**
 * POST /api/admin/factures/[id]/paiements (legacy, conservé)
 * Délègue à runCreatePaiement (lib/admin-facture-paiement-create.ts).
 * Pattern cohérent avec Lots 1-3.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireEditor(req);
    if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

    const { id } = await params;

    let body: Record<string, unknown>;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: 'Corps invalide' }, { status: 400 }); }

    const result = await runCreatePaiement({
      factureId: id,
      date_paiement: String(body.date_paiement ?? ''),
      montant: Number(body.montant ?? 0),
      methode: String(body.methode ?? ''),
      reference: typeof body.reference === 'string' ? body.reference : undefined,
      note: typeof body.note === 'string' ? body.note : undefined,
      actorEmail: auth.email,
      ip: getClientIp(req),
    });

    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('POST /api/admin/factures/[id]/paiements error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
