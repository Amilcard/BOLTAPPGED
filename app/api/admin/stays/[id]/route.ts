import { NextRequest, NextResponse } from 'next/server';
import { requireEditor, requireAdmin } from '@/lib/auth-middleware';
import { runUpdateStay, runDeleteStay } from '@/lib/admin-stays-mutate';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/admin/stays/[id] — modifier un séjour (legacy conservée).
 * Délègue au helper partagé runUpdateStay.
 * Nouvelle route body-based : PATCH /api/admin/stays/update.
 *
 * id = slug Supabase (pas UUID).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEditor(request);
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Non autorisé' } },
      { status: 401 }
    );
  }

  try {
    const { id: slug } = await params;
    const body = await request.json().catch(() => ({}));
    const result = await runUpdateStay(slug, body as Record<string, unknown>);
    if ('error' in result && result.error) {
      return NextResponse.json(
        { error: { code: result.code ?? 'INTERNAL_ERROR', message: result.error } },
        { status: result.status }
      );
    }
    return NextResponse.json(result.data);
  } catch (error) {
    console.error('PUT /api/admin/stays/[id] error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/stays/[id] — supprimer un séjour (legacy conservée).
 * Délègue au helper partagé runDeleteStay (FK 23503 gérée dans le helper).
 * Nouvelle route body-based : POST /api/admin/stays/delete.
 *
 * id = slug Supabase (pas UUID).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Non autorisé — ADMIN requis pour suppression' } },
      { status: 401 }
    );
  }

  try {
    const { id: slug } = await params;
    const result = await runDeleteStay(slug);
    if ('error' in result && result.error) {
      const code = result.code === '23503' ? 'FK_VIOLATION' : (result.code ?? 'INTERNAL_ERROR');
      return NextResponse.json(
        { error: { code, message: result.error } },
        { status: result.status }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/admin/stays/[id] error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
