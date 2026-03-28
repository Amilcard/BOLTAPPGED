import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

// Rate limiting en mémoire — suffisant pour un back-office admin faible trafic
// Pour Vercel multi-instance, remplacer par Upstash Redis
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  if (entry.count >= MAX_ATTEMPTS) return true;
  entry.count++;
  return false;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
      { status: 429 }
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
      return NextResponse.json({ error: 'Identifiants invalides.' }, { status: 401 });
    }

    // Rôle depuis app_metadata (défini via SQL : raw_app_meta_data)
    const role = data.user.app_metadata?.role || 'VIEWER';

    // Génération du JWT applicatif (compatible auth-middleware.ts)
    const token = jwt.sign(
      { userId: data.user.id, email: data.user.email, role },
      secret,
      { expiresIn: '8h' }
    );

    const response = NextResponse.json({ ok: true });
    response.cookies.set('gd_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 8,
    });
    return response;
  } catch (error) {
    console.error('[auth/login] Erreur:', error);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
