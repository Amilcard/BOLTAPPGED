export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/auth-middleware';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PUT /api/admin/users/[id] — modifier email, rôle ou mot de passe
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  }

  try {
    const { email, role, password } = await request.json();

    if (role && !['ADMIN', 'EDITOR', 'VIEWER'].includes(role)) {
      return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const updates: Record<string, unknown> = {};
    if (email) updates.email = email;
    if (password) updates.password = password;
    if (role) updates.app_metadata = { role };

    const { data, error } = await supabase.auth.admin.updateUserById(id, updates);
    if (error) throw error;

    return NextResponse.json({
      id: data.user.id,
      email: data.user.email,
      role: (data.user.app_metadata?.role as string) || 'VIEWER',
      createdAt: data.user.created_at,
    });
  } catch (err) {
    console.error('[admin/users/[id]] PUT error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id] — supprimer un utilisateur
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  }

  // Anti self-delete : un admin ne peut pas supprimer son propre compte
  if (id === auth.userId) {
    return NextResponse.json(
      { error: 'Impossible de supprimer votre propre compte.' },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/users/[id]] DELETE error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
