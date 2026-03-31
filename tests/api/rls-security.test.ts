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
 *  3. UPDATE dans gd_stays via clé anon → doit être refusé (RLS)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Charger le vrai .env (jest.setup.js injecte des valeurs fictives)
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const isRealSupabase =
  supabaseUrl && !supabaseUrl.includes('test.supabase.co');

// Client anon — simule un attaquant avec la clé publique
const anonClient = isRealSupabase
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const describeIfReal = isRealSupabase ? describe : describe.skip;

describeIfReal('RLS — Accès direct Supabase avec clé anon', () => {
  test('gd_souhaits : lecture anon refusée', async () => {
    const { data, error } = await anonClient!
      .from('gd_souhaits')
      .select('id')
      .limit(1);

    // RLS sans policy anon → résultat vide (pas d'erreur Supabase, juste 0 lignes)
    // Supabase retourne [] et non une erreur quand la policy bloque en SELECT
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  test('gd_stays : INSERT anon refusé', async () => {
    const { error } = await anonClient!
      .from('gd_stays')
      .insert({ slug: 'rls-test-anon', title: 'test', status: 'draft' });

    // PGRST204 = PostgREST bloque via RLS (aucune ligne retournée)
    // 42501 = insufficient_privilege (connexion directe PostgreSQL)
    expect(error).not.toBeNull();
    expect(error!.code).toMatch(/42501|insufficient_privilege|rls|PGRST204/i);
  });

  test('gd_stays : UPDATE anon refusé', async () => {
    // Récupérer un séjour existant avec son titre actuel
    const { data: before } = await anonClient!
      .from('gd_stays')
      .select('slug, title')
      .limit(1)
      .single();

    if (!before?.slug) {
      console.warn('UPDATE RLS test skipped: no stays found in DB');
      return;
    }

    // Tenter de modifier le titre
    await anonClient!
      .from('gd_stays')
      .update({ title: 'HACKED' })
      .eq('slug', before.slug);

    // Vérifier que le titre n'a pas changé (RLS bloque silencieusement l'UPDATE)
    const { data: after } = await anonClient!
      .from('gd_stays')
      .select('title')
      .eq('slug', before.slug)
      .single();

    expect(after?.title).toBe(before.title);
  });
});
