export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { runNotifyWaitlist } from '@/lib/admin-stays-notify-waitlist';

/**
 * POST /api/admin/stays/notify-waitlist
 * Body-based variant (SSRF préemptif, Lot 2/6).
 * Body : { staySlug: string }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireEditor(req);
    if (!auth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const staySlug = typeof (body as { staySlug?: unknown }).staySlug === 'string'
      ? (body as { staySlug: string }).staySlug
      : '';

    const result = await runNotifyWaitlist(staySlug);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status ?? 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sent: result.sent,
      total: result.total,
      message: result.message,
    });
  } catch (err) {
    console.error('POST /api/admin/stays/notify-waitlist error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
