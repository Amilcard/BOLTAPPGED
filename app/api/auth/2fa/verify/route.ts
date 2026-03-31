export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { verifyToken } from '@/lib/totp';
import { setSessionCookie } from '@/lib/auth-cookies';
import jwt from 'jsonwebtoken';

/**
 * POST /api/auth/2fa/verify
 * Vérifie le code TOTP après email/password.
 * Body: { pendingToken: string, code: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { pendingToken, code } = await req.json();
    if (!pendingToken || !code) {
      return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 });
    }

    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return NextResponse.json({ error: 'Erreur configuration serveur' }, { status: 500 });

    let payload: { userId: string; email: string; role: string; pending2fa: boolean };
    try {
      payload = jwt.verify(pendingToken, secret) as typeof payload;
    } catch {
      return NextResponse.json({ error: 'Token invalide ou expiré' }, { status: 401 });
    }

    if (!payload.pending2fa) {
      return NextResponse.json({ error: 'Token invalide' }, { status: 401 });
    }

    const { data: row } = await getSupabaseAdmin()
      .from('gd_admin_2fa')
      .select('totp_secret, enabled')
      .eq('user_id', payload.userId)
      .single();

    if (!row?.enabled) {
      return NextResponse.json({ error: '2FA non activée pour ce compte' }, { status: 400 });
    }

    if (!verifyToken(code, row.totp_secret)) {
      return NextResponse.json({ error: 'Code invalide' }, { status: 400 });
    }

    const fullToken = jwt.sign(
      { userId: payload.userId, email: payload.email, role: payload.role },
      secret,
      { expiresIn: '8h' }
    );

    return setSessionCookie(NextResponse.json({ ok: true }), fullToken);
  } catch (error) {
    console.error('POST /api/auth/2fa/verify error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
