import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { runDeleteSession } from '@/lib/admin-session-delete';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/admin/stays/[id]/sessions/[sessionId] (legacy, conservé)
 * Délègue à runDeleteSession (lib/admin-session-delete.ts).
 * Le segment [id] (staySlug) est ignoré — comportement legacy strict préservé.
 * Trigger DB trg_log_session_delete assure la traçabilité automatique.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Non autorisé' } },
      { status: 401 }
    );
  }

  try {
    const { sessionId } = await params;
    const result = await runDeleteSession(sessionId);
    if ('error' in result) {
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: result.error } },
        { status: result.status }
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('DELETE /api/admin/stays/[id]/sessions/[sessionId] error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
