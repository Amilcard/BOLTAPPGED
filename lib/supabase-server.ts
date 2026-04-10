import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase côté serveur (Service Role Key).
 * Remplace les ~25 fonctions getSupabase() / getSupabaseAdmin() dupliquées
 * dans chaque route API.
 *
 * Usage :
 *   import { getSupabaseAdmin } from '@/lib/supabase-server';
 *   const supabase = getSupabaseAdmin();
 */

let _client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      '❌ NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante.\n' +
      'Vérifiez vos variables d\'environnement (.env.local ou Vercel).'
    );
  }

  _client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _client;
}

// Alias pour compatibilité avec les routes qui utilisaient getSupabase()
export const getSupabase = getSupabaseAdmin;

/**
 * Client Supabase côté serveur avec clé ANON (RLS actif).
 * Utiliser pour les requêtes qui ne nécessitent pas de bypass RLS :
 * - SELECT sur données publiques (gd_stays, gd_session_prices, gd_stay_sessions)
 * - SELECT/PATCH scopés par ownership (gd_dossier_enfant, gd_inscriptions via token)
 *
 * ⚠️ NE PAS utiliser pour : INSERT cross-user, Storage, opérations admin
 */
export function getSupabaseUser(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      '❌ NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY manquante.\n' +
      'Vérifiez vos variables d\'environnement (.env.local ou Vercel).'
    );
  }

  // Pas de singleton — instancié par requête (serverless safe, RLS par requête)
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
