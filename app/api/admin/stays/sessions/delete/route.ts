export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { runDeleteSession } from '@/lib/admin-session-delete';

/**
 * POST /api/admin/stays/sessions/delete
 * Variante body-based (URL littérale côté client + ids dans body — anti-SSRF préemptif).
 * Lot 6/6 FINAL — Groupe (a) SSRF préemptif.
 *
 * Logique métier partagée avec DELETE /api/admin/stays/[id]/sessions/[sessionId]
 * (legacy conservé) via runDeleteSession (lib/admin-session-delete.ts).
 *
 * staySlug est présent dans le body pour cohérence UI mais IGNORÉ côté helper
 * (legacy ne filtre que par sessionId — comportement préservé strictement).
 *
 * Auth : requireAdmin (DELETE réservé ADMIN). Cohérent avec DELETE legacy.
 * Trigger DB trg_log_session_delete assure la traçabilité automatique.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const sessionId = typeof (body as { sessionId?: unknown }).sessionId === 'string'
      ? (body as { sessionId: string }).sessionId
      : '';
    // staySlug présent dans body pour cohérence UI mais ignoré côté helper
    const result = await runDeleteSession(sessionId);
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (err) {
    console.error('POST /api/admin/stays/sessions/delete error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
