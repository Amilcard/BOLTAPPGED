export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/auth-middleware';

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
export async function POST(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  try {
    const { email, password, role } = await request.json();

    if (!email || !password || !role) {
      return NextResponse.json({ error: 'email, password et role requis' }, { status: 400 });
    }
    if (!['ADMIN', 'EDITOR', 'VIEWER'].includes(role)) {
      return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      app_metadata: { role },
      email_confirm: true,
    });

    if (error) throw error;

    return NextResponse.json({
      id: data.user.id,
      email: data.user.email,
      role,
      createdAt: data.user.created_at,
    }, { status: 201 });
  } catch (err) {
    console.error('[admin/users] POST error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
