export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { runUpdateUser, runDeleteUser } from '@/lib/admin-users-mutate';

/**
 * PUT /api/admin/users/[id] — modifier email, rôle ou mot de passe (legacy).
 * Délègue au helper partagé runUpdateUser.
 * Nouvelle route body-based : POST /api/admin/users/update.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const result = await runUpdateUser(id, body as never);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 500 });
    }
    return NextResponse.json(result.data);
  } catch (err) {
    console.error('[admin/users/[id]] PUT error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/users/[id] — supprimer un utilisateur (legacy).
 * Délègue au helper partagé runDeleteUser (anti self-delete conservé).
 * Nouvelle route body-based : POST /api/admin/users/delete.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const result = await runDeleteUser(id, auth.userId);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/users/[id]] DELETE error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
