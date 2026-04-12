export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { clearSessionCookie } from '@/lib/auth-cookies';

/**
 * POST /api/auth/logout
 * Révoque le token JWT actif en blacklistant son jti dans gd_revoked_tokens.
 * Supprime le cookie de session.
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('gd_session')?.value;
    const response = clearSessionCookie(NextResponse.json({ ok: true }));

    if (!token) return response;

    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return response;

    const encodedSecret = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, encodedSecret).catch(() => ({ payload: null }));

    if (payload?.jti && payload?.exp) {
      const expiresAt = new Date(payload.exp * 1000).toISOString();
      const { error: dbErr } = await getSupabaseAdmin()
        .from('gd_revoked_tokens')
        .insert({ jti: payload.jti, expires_at: expiresAt });
      if (dbErr) {
        console.error('[auth/logout] jti blacklist failed:', { jti: payload.jti, error: dbErr.message });
      }
    }

    return response;
  } catch (err) {
    console.error('[auth/logout] unexpected error:', err);
    // Logout toujours réussi côté client — on efface le cookie même en cas d'erreur DB
    return clearSessionCookie(NextResponse.json({ ok: true }));
  }
}
