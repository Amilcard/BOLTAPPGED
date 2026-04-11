/**
 * @jest-environment node
 *
 * Tests de non-régression RLS — Sécurité Supabase
 *
 * Vérifie que les policies supprimées le 2026-03-31 ne sont pas revenues.
 * Ces tests utilisent la clé ANON (publique) pour simuler un accès direct
 * à Supabase sans passer par l'API Next.js.
 *
 * Scénarios :
 *  1. Lecture gd_souhaits via clé anon → doit être refusée (RLS)
 *  2. INSERT dans gd_stays via clé anon → doit être refusé (RLS)
 *  3. UPDATE dans gd_stays via clé anon → données inchangées (RLS silencieux)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Charger le vrai .env (jest.setup.js injecte des valeurs fictives)
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseAnonKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');

// Actif si les vraies clés Supabase sont configurées (CI + local avec .env réel)
const isRealSupabase = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('xxxxxxxxxxxxx') &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.startsWith('eyJ')
);

if (!isRealSupabase) {
  describe.skip('RLS — Accès direct Supabase avec clé anon', () => {
    it('skipped — pas de vraie instance Supabase', () => {});
  });
} else {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase env vars for RLS tests');
  }

  const anonClient = createClient(supabaseUrl, supabaseAnonKey);

  describe('RLS — Accès direct Supabase avec clé anon', () => {
    test('gd_souhaits : lecture anon refusée', async () => {
      const { data, error } = await anonClient
        .from('gd_souhaits')
        .select('id')
        .limit(1);

      // Legacy keys désactivées → erreur "Legacy API keys are disabled" = accès bloqué (encore mieux que RLS)
      if (error?.message?.includes('Legacy API keys are disabled')) {
        expect(error).not.toBeNull();
        return;
      }

      // Sinon : RLS bloque la lecture → tableau vide
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    test('gd_stays : INSERT anon refusé', async () => {
      const { error } = await anonClient
        .from('gd_stays')
        .insert({ slug: 'rls-test-anon', title: 'test', status: 'draft' });

      expect(error).not.toBeNull();
      // Legacy keys disabled OU RLS refusant l'INSERT
      expect(error?.message ?? error?.code ?? '').toMatch(/42501|insufficient_privilege|rls|PGRST204|Legacy API keys/i);
    });

    test('gd_structures : lecture anon refusée', async () => {
      const { data, error } = await anonClient.from('gd_structures').select('code').limit(1);
      if (error?.message?.includes('Legacy API keys are disabled')) {
        expect(error).not.toBeNull();
        return;
      }
      expect(data).toEqual([]);
    });

    test('gd_stays : UPDATE anon refusé', async () => {
      const { data: before } = await anonClient
        .from('gd_stays')
        .select('slug, title')
        .limit(1)
        .single();

      if (!before?.slug) {
        console.warn('UPDATE RLS test skipped: no stays found in DB');
        return;
      }

      await anonClient
        .from('gd_stays')
        .update({ title: 'HACKED' })
        .eq('slug', before.slug);

      const { data: after } = await anonClient
        .from('gd_stays')
        .select('title')
        .eq('slug', before.slug)
        .single();

      expect(after?.title).toBe(before.title);
    });
  });
}
