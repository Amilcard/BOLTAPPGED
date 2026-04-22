export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/auth-middleware';
import { runCreateUser } from '@/lib/admin-users-mutate';

// GET /api/admin/users — liste tous les utilisateurs admin
export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50')));

    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: limit });
    if (error) throw error;

    const users = data.users.map((u) => ({
      id: u.id,
      email: u.email,
      role: (u.app_metadata?.role as string) || 'VIEWER',
      createdAt: u.created_at,
    }));

    return NextResponse.json({ data: users, total: data.total ?? users.length, page, limit });
  } catch (err) {
    console.error('[admin/users] GET error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/admin/users — créer un utilisateur admin
// Délègue à runCreateUser (lib/admin-users-mutate.ts) pour cohérence
// avec update/delete (pattern entonnoir unique + auditLog RGPD).
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
      role?: string;
    };
    const result = await runCreateUser(body, auth.email);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.data, { status: result.status });
  } catch (err) {
    console.error('[admin/users] POST error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
