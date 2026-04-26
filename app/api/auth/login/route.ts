import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { setSessionCookie } from '@/lib/auth-cookies';
import { SignJWT } from 'jose';
import { isRateLimited, getClientIpFromHeaders } from '@/lib/rate-limit';
import { EMAIL_REGEX } from '@/lib/validators';
import { captureServerException } from '@/lib/sentry-capture';

export async function POST(req: NextRequest) {
  try {
    // 1. Parser le body et valider les entrées AVANT rate-limit pour extraire l'email
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: 'Email et mot de passe requis.' },
        { status: 400 }
      );
    }

    const { email, password } = body as { email?: string; password?: string };
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return NextResponse.json(
        { error: 'Email et mot de passe requis.' },
        { status: 400 }
      );
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Email et mot de passe requis.' },
        { status: 400 }
      );
    }

    const emailNorm = email.trim().toLowerCase();
    const ip = getClientIpFromHeaders(req.headers);

    // 2. Dual-key rate limit : IP tolérante (NAT partagé) + email strict (credential stuffing cible)
    const [ipBlocked, emailBlocked] = await Promise.all([
      isRateLimited('login-ip', ip, 10, 15),
      isRateLimited('login-email', emailNorm, 5, 15),
    ]);
    if (ipBlocked || emailBlocked) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
        { status: 429, headers: { 'Retry-After': '900' } }
      );
    }

    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error('[auth/login] NEXTAUTH_SECRET manquant');
      return NextResponse.json({ error: 'Erreur de configuration serveur.' }, { status: 500 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[auth/login] Variables Supabase manquantes');
      return NextResponse.json({ error: 'Erreur de configuration serveur.' }, { status: 500 });
    }

    // Authentification via Supabase Auth
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailNorm,
      password,
    });

    // Réponse générique pour éviter l'énumération des comptes
    if (error || !data.user) {
      console.error('[auth/login] echec:', error?.message);
      return NextResponse.json({ error: 'Identifiants invalides.' }, { status: 401 });
    }

    // Rôle depuis app_metadata (défini via SQL : raw_app_meta_data)
    const role = data.user.app_metadata?.role || 'VIEWER';

    // Reset rate limit après connexion réussie (IP + email)
    getSupabaseAdmin()
      .from('gd_login_attempts')
      .delete()
      .in('ip', [`login-ip:${ip}`, `login-email:${emailNorm}`]);

    // Vérifier si la 2FA est activée pour cet utilisateur
    const { data: twoFaRow } = await getSupabaseAdmin()
      .from('gd_admin_2fa')
      .select('enabled')
      .eq('user_id', data.user.id)
      .single();

    const encodedSecret = new TextEncoder().encode(secret);

    if (twoFaRow?.enabled) {
      // Émettre un token temporaire (5 min) pour la vérification 2FA
      const pendingToken = await new SignJWT({ userId: data.user.id, email: data.user.email, role, pending2fa: true })
        .setProtectedHeader({ alg: 'HS256' })
        .setJti(crypto.randomUUID())
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(encodedSecret);
      // pendingToken en httpOnly cookie (jamais dans le body — RGPD)
      const { setPendingCookie } = await import('@/lib/auth-cookies');
      return setPendingCookie(
        NextResponse.json({ requires2fa: true }),
        pendingToken
      );
    }

    // Pas de 2FA — session normale 8h
    const token = await new SignJWT({ userId: data.user.id, email: data.user.email, role })
      .setProtectedHeader({ alg: 'HS256' })
      .setJti(crypto.randomUUID())
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(encodedSecret);

    // RGPD : ne plus renvoyer le JWT dans le body — cookie httpOnly uniquement
    return setSessionCookie(
      NextResponse.json({ ok: true, user: { email: data.user.email, role } }),
      token
    );
  } catch (error) {
    captureServerException(error, { domain: 'auth', operation: 'login' });
    console.error('[auth/login] Erreur:', error);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
