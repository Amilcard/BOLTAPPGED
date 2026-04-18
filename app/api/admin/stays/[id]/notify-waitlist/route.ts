export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { runNotifyWaitlist } from '@/lib/admin-stays-notify-waitlist';

/**
 * POST /api/admin/stays/[id]/notify-waitlist (legacy, conservé)
 * Délègue à runNotifyWaitlist (lib/admin-stays-notify-waitlist.ts).
 * Pattern cohérent avec Lot 1 users (commit 91657eb).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await requireEditor(req)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const { id: staySlug } = await params;
    const result = await runNotifyWaitlist(staySlug);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status ?? 500 }
      );
    }

    // Préserver la forme de réponse legacy (ok + sent + total + message)
    return NextResponse.json({
      ok: true,
      sent: result.sent,
      total: result.total,
      ...(result.message ? { message: result.message } : {}),
    });
  } catch (err) {
    console.error('POST /api/admin/stays/[id]/notify-waitlist error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
