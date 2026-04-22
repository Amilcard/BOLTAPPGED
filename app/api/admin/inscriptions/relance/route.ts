export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { runRelanceInscription } from '@/lib/admin-inscriptions-relance';
import { UUID_RE } from '@/lib/validators';

/**
 * POST /api/admin/inscriptions/relance
 * Variante body-based (URL littérale côté client + id dans body — anti-SSRF préemptif).
 * Cohérent avec PUT/DELETE body-based (commits bf4e8f4, 07261f2).
 *
 * La logique métier est partagée avec la route legacy /[id]/relance
 * via le helper runRelanceInscription (lib/admin-inscriptions-relance.ts).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireEditor(req);
    if (!auth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const id = typeof (body as { id?: unknown }).id === 'string' ? (body as { id: string }).id : '';
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'id requis (UUID)' }, { status: 400 });
    }

    const result = await runRelanceInscription(id, auth.email);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, relance_at: result.relance_at });
  } catch (err) {
    console.error('POST /api/admin/inscriptions/relance error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
