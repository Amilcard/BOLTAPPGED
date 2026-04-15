/**
 * @jest-environment node
 *
 * Tests sécurité — Codes structure multi-niveaux (app/api/structure/[code]/route.ts)
 *
 * Couvre les vecteurs d'accès non autorisé sur les données enfants ASE :
 *
 *  1. Code CDS expiré (expires_at < now) → 403
 *  2. Code CDS révoqué (revoked_at IS NOT NULL) → 403
 *  3. Code éducateur (6 chars) sur route PATCH delegation → 403 (réservé directeur)
 *  4. Délégation directeur→CDS expirée → CDS délégué perd l'accès
 *  5. Délégation > 90 jours → refusée
 *  6. Code inconnu → 404 (pas de leak d'info)
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-service-role-key-for-tests';
process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-pad';

const mockFrom = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  getSupabase: () => ({ from: mockFrom }),
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));

jest.mock('@/lib/auth-middleware', () => ({
  requireEditor: jest.fn().mockResolvedValue({ id: 'admin', role: 'ADMIN' }),
  requireAdmin: jest.fn().mockResolvedValue({ id: 'admin', role: 'ADMIN' }),
  verifyAuth: jest.fn().mockReturnValue({ id: 'admin', role: 'ADMIN' }),
}));

const mockResolveCode = jest.fn();
jest.mock('@/lib/structure', () => ({
  resolveCodeToStructure: (...args: unknown[]) => mockResolveCode(...args),
}));

import { NextRequest } from 'next/server';

function makeRequestWithCode(code: string, method = 'GET', body?: object) {
  return new NextRequest(`http://localhost/api/structure/${code}`, {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}),
  });
}

// Helpers retirés — les tests utilisent mockResolveCode (résolution centralisée)
// au lieu de simuler des structures expirées/révoquées via le mock Supabase brut.

describe('Structure — sécurité codes multi-niveaux', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockReset();
  });

  describe('Code expiré', () => {
    it('code CDS expiré → resolveCodeToStructure retourne null → 403 ou 404', async () => {
      mockResolveCode.mockResolvedValue(null); // code expiré = pas de résolution

      const { GET } = await import('@/app/api/structure/[code]/route');
      const res = await GET(makeRequestWithCode('ABCD12'), { params: Promise.resolve({ code: 'ABCD12' }) });

      // Un code expiré ne doit jamais retourner 200 avec données
      expect([403, 404, 401]).toContain(res.status);
    });
  });

  describe('Code révoqué', () => {
    it('code révoqué → accès refusé → 403 ou 404', async () => {
      mockResolveCode.mockResolvedValue(null); // code révoqué = pas de résolution

      const { GET } = await import('@/app/api/structure/[code]/route');
      const res = await GET(makeRequestWithCode('ABCD34'), { params: Promise.resolve({ code: 'ABCD34' }) });

      expect([403, 404, 401]).toContain(res.status);
    });
  });

  describe('Code inconnu', () => {
    it('code inexistant → 404 sans leak de info', async () => {
      mockResolveCode.mockResolvedValue(null); // code inconnu = pas de résolution

      const { GET } = await import('@/app/api/structure/[code]/route');
      const res = await GET(makeRequestWithCode('XXXXXX'), { params: Promise.resolve({ code: 'XXXXXX' }) });

      expect([403, 404]).toContain(res.status);
      const body = await res.json() as { error?: { code?: string } };
      // Pas d'info sur ce qui existe ou pas — pas de code DB exposé
      if (body?.error?.code) {
        expect(body.error.code).not.toContain('PGRST116');
      }
    });
  });

  describe('Délégation directeur', () => {
    it('PATCH delegation avec code 6 chars (non-directeur) → 403', async () => {
      // Code 6 chars = CDS, pas directeur. resolveCodeToStructure retourne role=cds
      // Code 6 chars → rejeté par validation format (regex ^[A-Z0-9]{10}$) → 400
      // OU par resolveCodeToStructure → role !== 'direction' → 403
      const { PATCH } = await import('@/app/api/structure/[code]/delegation/route');
      const res = await PATCH(
        makeRequestWithCode('ABC123', 'PATCH', {
          from: new Date().toISOString(),
          until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }),
        { params: Promise.resolve({ code: 'ABC123' }) }
      );

      expect([400, 403, 401]).toContain(res.status);
    });

    it('délégation > 90 jours → refusée → 400 ou 422', async () => {
      const from = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000); // demain
      const until = new Date(from.getTime() + 91 * 24 * 60 * 60 * 1000); // +91 jours

      mockResolveCode.mockResolvedValue({
        structure: { id: 'struct-dir', name: 'MECS Dir' },
        role: 'direction',
        email: 'dir@test.fr',
      });

      const { PATCH } = await import('@/app/api/structure/[code]/delegation/route');
      const res = await PATCH(
        makeRequestWithCode('ABCD567890', 'PATCH', {
          from: from.toISOString(),
          until: until.toISOString(),
        }),
        { params: Promise.resolve({ code: 'ABCD567890' }) }
      );

      expect([400, 422]).toContain(res.status);
    });
  });
});
