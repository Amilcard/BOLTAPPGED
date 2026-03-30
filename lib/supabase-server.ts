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
