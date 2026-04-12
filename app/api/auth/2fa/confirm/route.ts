export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { verifyToken } from '@/lib/totp';

/**
 * POST /api/auth/2fa/confirm
 * Valide le premier code TOTP et active la 2FA.
 * Body: { code: string }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth) return NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 });

    const { code } = await req.json();
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code requis' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: row } = await supabase
      .from('gd_admin_2fa')
      .select('totp_secret')
      .eq('user_id', auth.userId)
      .single();

    if (!row) {
      return NextResponse.json({ error: '2FA non configurée. Lancez /setup d\'abord.' }, { status: 404 });
    }

    if (!verifyToken(code, row.totp_secret)) {
      return NextResponse.json({ error: 'Code invalide' }, { status: 400 });
    }

    await supabase
      .from('gd_admin_2fa')
      .update({ enabled: true, updated_at: new Date().toISOString() })
      .eq('user_id', auth.userId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('POST /api/auth/2fa/confirm error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
