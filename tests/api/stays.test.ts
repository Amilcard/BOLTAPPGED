/**
 * @jest-environment node
 *
 * Tests API — séjours
 *
 * NOTE : La route publique /api/stays n'existe pas encore dans l'application.
 * Les seules routes "stays" présentes sont :
 *   - /api/admin/stays          (admin, auth requise)
 *   - /api/admin/stays/[id]     (admin, auth requise)
 *   - /api/admin/stays/slug/[slug] (admin, auth requise)
 *
 * Ces tests sont mis en skip jusqu'à création d'une route publique /api/stays.
 * Pour réactiver : retirer les .skip et vérifier que la route existe.
 */

import { describe, it } from '@jest/globals';

describe('API /api/stays', () => {
  it.skip('retourne liste séjours avec noms CityCrunch — route /api/stays non implémentée', () => {
    // Route publique /api/stays absente — tests désactivés
  });

  it.skip('tous les séjours ont un slug unique — route /api/stays non implémentée', () => {
    // Route publique /api/stays absente — tests désactivés
  });

  it.skip('tous les séjours ont un marketing_title ou title_kids — route /api/stays non implémentée', () => {
    // Route publique /api/stays absente — tests désactivés
  });

  it.skip('retourne séjour spécifique par slug — route /api/stays/[slug] non implémentée', () => {
    // Route publique /api/stays/[slug] absente — tests désactivés
  });
});
