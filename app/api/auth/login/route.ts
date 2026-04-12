import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { setSessionCookie } from '@/lib/auth-cookies';
import { SignJWT } from 'jose';
import { randomUUID } from 'crypto';

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Rate limiting persistant via Supabase (table gd_login_attempts).
 * Résiste au multi-instance Vercel contrairement au Map en mémoire.
 *
 * La table est créée par la migration sql/025_login_rate_limiting.sql :
 *   gd_login_attempts(ip TEXT PK, attempt_count INT, window_start TIMESTAMPTZ)
 */
async function isRateLimited(ip: string): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_MINUTES * 60 * 1000);

    // Lire l'entrée existante
    const { data: entry } = await supabase
      .from('gd_login_attempts')
      .select('attempt_count, window_start')
      .eq('ip', ip)
      .single();

    // Pas d'entrée ou fenêtre expirée → reset
    if (!entry || new Date(entry.window_start) < windowStart) {
      await supabase
        .from('gd_login_attempts')
        .upsert(
          { ip, attempt_count: 1, window_start: now.toISOString() },
          { onConflict: 'ip' }
        );
      return false;
    }

    // Trop de tentatives dans la fenêtre
    if (entry.attempt_count >= MAX_ATTEMPTS) {
      return true;
    }

    // Incrémenter le compteur
    await supabase
      .from('gd_login_attempts')
      .update({ attempt_count: entry.attempt_count + 1 })
      .eq('ip', ip);

    return false;
  } catch (err) {
    // Fail-closed : si on ne peut pas vérifier, on bloque par précaution
    // (données enfants ASE — mieux bloquer que laisser passer)
    console.error('[rate-limit] Erreur DB, fail-closed:', err);
    return true;
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
      { status: 429, headers: { 'Retry-After': '900' } }
    );
  }

  try {
    const body = await req.json();
    const { email, password } = body;

    // Validation basique des entrées
    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Email et mot de passe requis.' },
        { status: 400 }
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
      email: email.toLowerCase().trim(),
      password,
    });

    // Réponse générique pour éviter l'énumération des comptes
    if (error || !data.user) {
      console.error('[auth/login] echec:', error?.message);
      return NextResponse.json({ error: 'Identifiants invalides.' }, { status: 401 });
    }

    // Rôle depuis app_metadata (défini via SQL : raw_app_meta_data)
    const role = data.user.app_metadata?.role || 'VIEWER';

    // Reset rate limit après connexion réussie
    getSupabaseAdmin().from('gd_login_attempts').delete().eq('ip', ip);

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
    console.error('[auth/login] Erreur:', error);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
