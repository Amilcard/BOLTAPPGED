export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { SignJWT } from 'jose';

const MAX_ATTEMPTS = 10;
const WINDOW_MINUTES = 5;

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Rate limiting persistant via Supabase (même pattern que /api/auth/login).
 * Préfixe 'pro:' pour séparer les compteurs du login admin.
 */
async function isRateLimited(ip: string): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_MINUTES * 60 * 1000);
    const key = `pro:${ip}`;

    const { data: entry } = await supabase
      .from('gd_login_attempts')
      .select('attempt_count, window_start')
      .eq('ip', key)
      .single();

    if (!entry || new Date(entry.window_start) < windowStart) {
      await supabase
        .from('gd_login_attempts')
        .upsert(
          { ip: key, attempt_count: 1, window_start: now.toISOString() },
          { onConflict: 'ip' }
        );
      return false;
    }

    if (entry.attempt_count >= MAX_ATTEMPTS) {
      return true;
    }

    await supabase
      .from('gd_login_attempts')
      .update({ attempt_count: entry.attempt_count + 1 })
      .eq('ip', key);

    return false;
  } catch (err) {
    // Fail-closed : données enfants ASE — bloquer en cas d'erreur
    console.error('[pro-session rate-limit] Erreur DB, fail-closed:', err);
    return true;
  }
}

/**
 * POST /api/auth/pro-session
 *
 * Authentification pro légère : email + code structure → cookie pro 30 min.
 * Permet aux éducateurs d'accéder à /reserver et de voir les prix
 * SANS avoir de compte admin GED.
 *
 * Body : { email: string, structureCode: string }
 * Réponse : 200 + cookie httpOnly gd_pro_session (JWT 30 min)
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: 'Trop de tentatives. Réessayez dans 5 minutes.' } },
      { status: 429, headers: { 'Retry-After': '300' } }
    );
  }

  try {
    const body = await req.json();
    const { email, structureCode } = body;

    // 1. Validation email
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Email professionnel valide requis.' } },
        { status: 400 }
      );
    }

    // 2. Validation structureCode (6 chars alphanum)
    if (!structureCode || typeof structureCode !== 'string' || !/^[A-Z0-9]{6}$/i.test(structureCode.trim())) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Code structure requis (6 caractères).' } },
        { status: 400 }
      );
    }

    const codeNorm = structureCode.trim().toUpperCase();

    // 3. Vérifier dans gd_structures
    const supabase = getSupabaseAdmin();
    const { data: structure } = await supabase
      .from('gd_structures')
      .select('id, name')
      .eq('code', codeNorm)
      .eq('status', 'active')
      .single();

    if (!structure) {
      return NextResponse.json(
        { error: { code: 'CODE_INVALIDE', message: 'Code structure invalide ou structure inactive.' } },
        { status: 401 }
      );
    }

    // 4. Générer JWT pro (30 min)
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error('[pro-session] NEXTAUTH_SECRET manquant');
      return NextResponse.json(
        { error: { code: 'CONFIG_ERROR', message: 'Erreur de configuration serveur.' } },
        { status: 500 }
      );
    }

    const encodedSecret = new TextEncoder().encode(secret);
    const token = await new SignJWT({
      role: 'pro',
      structureCode: codeNorm,
      structureName: structure.name,
      email: email.toLowerCase().trim(),
      type: 'pro_session',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('30m')
      .sign(encodedSecret);

    // 5. Poser cookie httpOnly gd_pro_session
    const response = NextResponse.json({
      ok: true,
      structureName: structure.name,
    });

    response.cookies.set('gd_pro_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 1800, // 30 min
    });

    // 6. Reset rate limit après succès
    supabase.from('gd_login_attempts').delete().eq('ip', `pro:${ip}`);

    return response;
  } catch (error) {
    console.error('[pro-session] error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur.' } },
      { status: 500 }
    );
  }
}
