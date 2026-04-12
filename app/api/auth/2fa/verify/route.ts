export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { verifyToken } from '@/lib/totp';
import { setSessionCookie, clearPendingCookie } from '@/lib/auth-cookies';
import { SignJWT, jwtVerify } from 'jose';

const MAX_2FA_ATTEMPTS = 5;
const WINDOW_MINUTES = 5;

async function is2faRateLimited(ip: string): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_MINUTES * 60 * 1000);
    const key = `2fa:${ip}`;

    const { data: entry } = await supabase
      .from('gd_login_attempts')
      .select('attempt_count, window_start')
      .eq('ip', key)
      .single();

    if (!entry || new Date(entry.window_start) < windowStart) {
      await supabase
        .from('gd_login_attempts')
        .upsert({ ip: key, attempt_count: 1, window_start: now.toISOString() }, { onConflict: 'ip' });
      return false;
    }

    if (entry.attempt_count >= MAX_2FA_ATTEMPTS) return true;

    await supabase
      .from('gd_login_attempts')
      .update({ attempt_count: entry.attempt_count + 1 })
      .eq('ip', key);
    return false;
  } catch {
    return true; // fail-closed — 2FA brute-force doit être bloqué en cas d'erreur DB
  }
}

/**
 * POST /api/auth/2fa/verify
 * Vérifie le code TOTP après email/password.
 * Body: { pendingToken: string, code: string }
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    if (await is2faRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Réessayez dans 5 minutes.' },
        { status: 429 }
      );
    }

    const { code } = await req.json();
    const pendingToken = req.cookies.get('gd_pending_2fa')?.value;
    if (!pendingToken || !code) {
      return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 });
    }

    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return NextResponse.json({ error: 'Erreur configuration serveur' }, { status: 500 });
    const encodedSecret = new TextEncoder().encode(secret);

    let payload: { userId: string; email: string; role: string; pending2fa: boolean };
    try {
      const { payload: p } = await jwtVerify(pendingToken, encodedSecret);
      payload = p as unknown as typeof payload;
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

    const fullToken = await new SignJWT({ userId: payload.userId, email: payload.email, role: payload.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('8h')
      .sign(encodedSecret);

    const response = setSessionCookie(
      NextResponse.json({ ok: true, user: { role: payload.role } }),
      fullToken
    );
    return clearPendingCookie(response);
  } catch (error) {
    console.error('POST /api/auth/2fa/verify error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
