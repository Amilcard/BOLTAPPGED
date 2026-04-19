export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { clearSessionCookie, clearProSessionCookie } from '@/lib/auth-cookies';

/**
 * POST /api/auth/logout
 * Révoque le(s) token(s) JWT actif(s) — admin (gd_session) et/ou pro (gd_pro_session) —
 * en blacklistant leur jti dans gd_revoked_tokens. Supprime les cookies côté serveur.
 *
 * CSRF-safe : POST + cookies SameSite=strict + HttpOnly. Pas de token CSRF additionnel.
 */
async function revokeJti(token: string | undefined, label: string): Promise<void> {
  if (!token) return;
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return;

  const encodedSecret = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, encodedSecret).catch(() => ({ payload: null }));

  if (payload?.jti && payload?.exp) {
    const expiresAt = new Date(payload.exp * 1000).toISOString();
    const { error: dbErr } = await getSupabaseAdmin()
      .from('gd_revoked_tokens')
      .insert({ jti: payload.jti as string, expires_at: expiresAt });
    if (dbErr && dbErr.code !== '23505') {
      // 23505 = unique violation — jti déjà révoqué, pas d'erreur réelle
      console.error(`[auth/logout] ${label} jti blacklist failed:`, { error: dbErr.message });
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminToken = req.cookies.get('gd_session')?.value;
    const proToken = req.cookies.get('gd_pro_session')?.value;

    let response: NextResponse = NextResponse.json({ ok: true });
    response = clearSessionCookie(response);
    response = clearProSessionCookie(response);

    // Révocation parallèle des JTI (admin + pro) — fail-safe, le logout
    // côté client reste effectif même si la DB est indisponible.
    await Promise.allSettled([
      revokeJti(adminToken, 'admin'),
      revokeJti(proToken, 'pro'),
    ]);

    return response;
  } catch (err) {
    console.error('[auth/logout] unexpected error:', err);
    // Logout toujours réussi côté client — on efface les cookies même en cas d'erreur DB
    let response: NextResponse = NextResponse.json({ ok: true });
    response = clearSessionCookie(response);
    response = clearProSessionCookie(response);
    return response;
  }
}
