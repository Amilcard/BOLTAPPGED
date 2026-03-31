export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { verifyToken } from '@/lib/totp';

/**
 * POST /api/auth/2fa/disable
 * Désactive la 2FA. Requiert un code TOTP valide pour confirmer.
 * Body: { code: string }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = verifyAuth(req);
    if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const { code } = await req.json();
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code TOTP requis pour désactiver la 2FA' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: row } = await supabase
      .from('gd_admin_2fa')
      .select('totp_secret, enabled')
      .eq('user_id', auth.userId)
      .single();

    if (!row?.enabled) {
      return NextResponse.json({ error: '2FA non activée' }, { status: 400 });
    }

    if (!verifyToken(code, row.totp_secret)) {
      return NextResponse.json({ error: 'Code invalide' }, { status: 400 });
    }

    await supabase.from('gd_admin_2fa').delete().eq('user_id', auth.userId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('POST /api/auth/2fa/disable error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
