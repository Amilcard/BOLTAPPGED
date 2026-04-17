export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { resolveCodeToStructure } from '@/lib/structure';
import { buildProSessionToken, type ProStructureRole } from '@/lib/auth-middleware';

const MAX_ATTEMPTS = 10;
const WINDOW_MINUTES = 5;

// M6 fix : centraliser sur isRateLimited() RPC atomique (lib/rate-limit.ts)
import { isRateLimited, getClientIpFromHeaders } from '@/lib/rate-limit';
function getClientIp(req: NextRequest): string {
  return getClientIpFromHeaders(req.headers);
}

async function isProRateLimited(ip: string): Promise<boolean> {
  return isRateLimited('pro', ip, MAX_ATTEMPTS, WINDOW_MINUTES);
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
  if (await isProRateLimited(ip)) {
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

    // 2. Validation structureCode (6-10 chars alphanum)
    if (!structureCode || typeof structureCode !== 'string' || !/^[A-Z0-9]{6,10}$/i.test(structureCode.trim())) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Code structure requis (6 à 10 caractères).' } },
        { status: 400 }
      );
    }

    const codeNorm = structureCode.trim().toUpperCase();

    // 3. Vérifier via resolveCodeToStructure (vérifie expiration + révocation)
    const resolved = await resolveCodeToStructure(codeNorm);
    if (!resolved) {
      return NextResponse.json(
        { error: { code: 'CODE_INVALIDE', message: 'Code structure invalide, expiré ou révoqué.' } },
        { status: 401 }
      );
    }

    const structure = resolved.structure as { id: string; name: string };

    // 4. Générer JWT pro (30 min) via helper factorisé
    const jwtResult = await buildProSessionToken({
      email: email.toLowerCase().trim(),
      structureCode: codeNorm,
      structureName: structure.name,
      structureRole: resolved.role as ProStructureRole,
      structureId: resolved.structure.id as string,
      expiresIn: '30m',
    });
    if (!jwtResult) {
      return NextResponse.json(
        { error: { code: 'CONFIG_ERROR', message: 'Erreur de configuration serveur.' } },
        { status: 500 }
      );
    }
    const { token } = jwtResult;

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
    const supabase = getSupabaseAdmin();
    await supabase.from('gd_login_attempts').delete().eq('ip', `pro:${ip}`);

    return response;
  } catch (error) {
    console.error('[pro-session] error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur.' } },
      { status: 500 }
    );
  }
}
