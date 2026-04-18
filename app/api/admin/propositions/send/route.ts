export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { getClientIp } from '@/lib/audit-log';
import { runSendProposition } from '@/lib/admin-proposition-send';

/**
 * POST /api/admin/propositions/send
 * Body-based variant (SSRF préemptif, Lot 3/6).
 * Body : { id: string; demandeurEmail?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireEditor(req);
    if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const id = typeof (body as { id?: unknown }).id === 'string' ? (body as { id: string }).id : '';
    const demandeurEmail = typeof (body as { demandeurEmail?: unknown }).demandeurEmail === 'string'
      ? (body as { demandeurEmail: string }).demandeurEmail
      : undefined;

    const result = await runSendProposition({
      id,
      overrideEmail: demandeurEmail,
      actorEmail: auth.email,
      ip: getClientIp(req),
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/admin/propositions/send error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
