export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { getClientIp } from '@/lib/audit-log';
import { runCreatePaiement } from '@/lib/admin-facture-paiement-create';

/**
 * POST /api/admin/factures/paiements
 * Body-based variant (SSRF préemptif, Lot 4/6).
 * Body : { factureId: string; date_paiement: string; montant: number; methode: string; reference?: string; note?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireEditor(req);
    if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const factureId = typeof (body as { factureId?: unknown }).factureId === 'string'
      ? (body as { factureId: string }).factureId
      : '';

    const result = await runCreatePaiement({
      factureId,
      date_paiement: String((body as { date_paiement?: unknown }).date_paiement ?? ''),
      montant: Number((body as { montant?: unknown }).montant ?? 0),
      methode: String((body as { methode?: unknown }).methode ?? ''),
      reference: typeof (body as { reference?: unknown }).reference === 'string' ? (body as { reference: string }).reference : undefined,
      note: typeof (body as { note?: unknown }).note === 'string' ? (body as { note: string }).note : undefined,
      actorEmail: auth.email,
      ip: getClientIp(req),
    });

    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (err) {
    console.error('POST /api/admin/factures/paiements error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
