import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

export async function POST(req: NextRequest) {
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

    return NextResponse.json({ token });
  } catch (error) {
    console.error('[auth/login] Erreur:', error);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
