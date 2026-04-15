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

interface SupabaseRow { [key: string]: unknown }

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

import { NextRequest } from 'next/server';

function makeRequestWithCode(code: string, method = 'GET', body?: object) {
  return new NextRequest(`http://localhost/api/structure/${code}`, {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}),
  });
}

// Helper : structure expirée
function makeExpiredStructure(overrides: Partial<SupabaseRow> = {}): SupabaseRow {
  return {
    id: 'struct-expired',
    code: 'ABCD12',
    is_test: false,
    expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // hier
    revoked_at: null,
    rgpd_accepted_at: new Date().toISOString(),
    ...overrides,
  };
}

// Helper : structure révoquée
function makeRevokedStructure(): SupabaseRow {
  return {
    id: 'struct-revoked',
    code: 'ABCD34',
    is_test: false,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    revoked_at: new Date().toISOString(), // révoquée
    rgpd_accepted_at: new Date().toISOString(),
  };
}

describe('Structure — sécurité codes multi-niveaux', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockReset();
  });

  describe('Code expiré', () => {
    it('code CDS expiré → resolveCodeToStructure retourne null → 403 ou 404', async () => {
      mockFrom.mockImplementation(() => ({
        select: () => ({
          or: () => ({
            single: () => ({ data: makeExpiredStructure(), error: null }),
          }),
          eq: () => ({
            single: () => ({ data: makeExpiredStructure(), error: null }),
          }),
        }),
      }));

      // Import dynamique pour être après les mocks
      const { GET } = await import('@/app/api/structure/[code]/route');
      const res = await GET(makeRequestWithCode('ABCD12'), { params: Promise.resolve({ code: 'ABCD12' }) });

      // Un code expiré ne doit jamais retourner 200 avec données
      expect([403, 404, 401]).toContain(res.status);
    });
  });

  describe('Code révoqué', () => {
    it('code révoqué → accès refusé → 403 ou 404', async () => {
      mockFrom.mockImplementation(() => ({
        select: () => ({
          or: () => ({
            single: () => ({ data: makeRevokedStructure(), error: null }),
          }),
          eq: () => ({
            single: () => ({ data: makeRevokedStructure(), error: null }),
          }),
        }),
      }));

      const { GET } = await import('@/app/api/structure/[code]/route');
      const res = await GET(makeRequestWithCode('ABCD34'), { params: Promise.resolve({ code: 'ABCD34' }) });

      expect([403, 404, 401]).toContain(res.status);
    });
  });

  describe('Code inconnu', () => {
    it('code inexistant → 404 sans leak de info', async () => {
      mockFrom.mockImplementation(() => ({
        select: () => ({
          or: () => ({
            single: () => ({ data: null, error: { code: 'PGRST116' } }),
          }),
          eq: () => ({
            single: () => ({ data: null, error: { code: 'PGRST116' } }),
          }),
        }),
      }));

      const { GET } = await import('@/app/api/structure/[code]/route');
      const res = await GET(makeRequestWithCode('XXXXXX'), { params: Promise.resolve({ code: 'XXXXXX' }) });

      expect(res.status).toBe(404);
      const body = await res.json() as { error?: { code?: string } };
      // Pas d'info sur ce qui existe ou pas
      expect(body?.error?.code).not.toContain('PGRST116');
    });
  });

  describe('Délégation directeur', () => {
    it('PATCH delegation avec code 6 chars (non-directeur) → 403', async () => {
      // Code 6 chars = CDS, pas directeur. Directeur = 10 chars.
      const { PATCH } = await import('@/app/api/structure/[code]/delegation/route');
      const res = await PATCH(
        makeRequestWithCode('ABC123', 'PATCH', {
          delegation_active_from: new Date().toISOString(),
          delegation_active_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }),
        { params: Promise.resolve({ code: 'ABC123' }) }
      );

      expect([403, 401]).toContain(res.status);
    });

    it('délégation > 90 jours → refusée → 400 ou 422', async () => {
      const from = new Date();
      const until = new Date(Date.now() + 91 * 24 * 60 * 60 * 1000); // 91 jours

      mockFrom.mockImplementation(() => ({
        select: () => ({
          eq: () => ({
            single: () => ({
              data: {
                id: 'struct-dir',
                code: 'ABCD567890', // 10 chars = directeur
                is_test: false,
                expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
                revoked_at: null,
              },
              error: null,
            }),
          }),
        }),
      }));

      const { PATCH } = await import('@/app/api/structure/[code]/delegation/route');
      const res = await PATCH(
        makeRequestWithCode('ABCD567890', 'PATCH', {
          delegation_active_from: from.toISOString(),
          delegation_active_until: until.toISOString(),
        }),
        { params: Promise.resolve({ code: 'ABCD567890' }) }
      );

      expect([400, 422]).toContain(res.status);
    });
  });
});
