export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { getClientIp } from '@/lib/audit-log';
import { runSendProposition } from '@/lib/admin-proposition-send';

/**
 * POST /api/admin/propositions/[id]/send (legacy, conservé)
 * Délègue à runSendProposition (lib/admin-proposition-send.ts).
 * Pattern cohérent avec Lot 1 users (91657eb) + Lot 2 stays (fab79a9).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireEditor(req);
    if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

    const { id } = await params;

    const body = await req.json().catch(() => ({})) as { demandeurEmail?: string };
    const overrideEmail = typeof body.demandeurEmail === 'string' && body.demandeurEmail.trim()
      ? body.demandeurEmail.trim()
      : undefined;

    const result = await runSendProposition({
      id,
      overrideEmail,
      actorEmail: auth.email,
      ip: getClientIp(req),
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/admin/propositions/[id]/send error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
