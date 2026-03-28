export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth-middleware';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Variables Supabase manquantes');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// GET /api/admin/users — liste tous les utilisateurs admin
export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;

    const users = data.users.map((u) => ({
      id: u.id,
      email: u.email,
      role: (u.app_metadata?.role as string) || 'VIEWER',
      createdAt: u.created_at,
    }));

    return NextResponse.json(users);
  } catch (err) {
    console.error('[admin/users] GET error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/admin/users — créer un utilisateur admin
export async function POST(request: NextRequest) {
  if (!requireAdmin(request)) {
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
