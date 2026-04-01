/**
 * @jest-environment node
 *
 * Tests configuration — middleware.ts (protection routes /admin)
 *
 * jose est ESM-only → mocké localement pour éviter le conflit transform Jest.
 * On teste le comportement (redirect/next) sans dépendre du vrai crypto jose.
 *
 * Scénarios :
 *  1. Cookie gd_session absent → redirect /login
 *  2. Cookie JWT malformé → redirect /login (pas de 500)
 *  3. JWT valide (jwtVerify réussit) → accès accordé
 *  4. NEXTAUTH_SECRET absent → redirect /login (fail-safe, pas de crash)
 *  5. JWT invalide (jwtVerify throw) → redirect /login
 */

// ── Mock jose avant tout import ───────────────────────────────────────────────
// jose est ESM-only : l'importer directement ferait crasher Jest.
// On contrôle jwtVerify via ce mock.

const mockJwtVerify = jest.fn();
jest.mock('jose', () => ({ jwtVerify: mockJwtVerify }));

import { NextRequest } from 'next/server';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAdminRequest(cookieValue?: string): NextRequest {
  const headers = new Headers();
  if (cookieValue) headers.set('Cookie', `gd_session=${cookieValue}`);
  return new NextRequest('http://localhost/admin/demandes', { headers });
}

function isRedirectToLogin(res: Response): boolean {
  const location = res.headers.get('location') ?? '';
  return res.status === 307 && location.includes('/login');
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('middleware — protection /admin', () => {
  const SAVED_SECRET = process.env.NEXTAUTH_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-ok!';
  });

  afterEach(() => {
    process.env.NEXTAUTH_SECRET = SAVED_SECRET;
    jest.resetModules();
  });

  it('1. cookie absent → redirect /login', async () => {
    // jwtVerify ne sera pas appelé — on teste en amont
    const { middleware } = await import('@/middleware');
    const res = await middleware(makeAdminRequest());
    expect(isRedirectToLogin(res)).toBe(true);
  });

  it('2. cookie malformé → redirect /login (pas de 500)', async () => {
    mockJwtVerify.mockRejectedValue(new Error('JWTMalformed'));
    const { middleware } = await import('@/middleware');
    const res = await middleware(makeAdminRequest('not.a.valid.jwt'));
    expect(isRedirectToLogin(res)).toBe(true);
    expect(res.status).not.toBe(500);
  });

  it('3. JWT valide → accès accordé (pas de redirect /login)', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { userId: 'u1', role: 'ADMIN' } });
    const { middleware } = await import('@/middleware');
    const res = await middleware(makeAdminRequest('valid.jwt.token'));
    expect(isRedirectToLogin(res)).toBe(false);
  });

  it('4. NEXTAUTH_SECRET absent → redirect /login (fail-safe, pas de crash)', async () => {
    delete process.env.NEXTAUTH_SECRET;
    // jwtVerify reçoit un secret vide → throw inévitable
    mockJwtVerify.mockRejectedValue(new Error('secret is empty'));
    jest.resetModules();
    const { middleware } = await import('@/middleware');
    const res = await middleware(makeAdminRequest('some.jwt.token'));
    expect(isRedirectToLogin(res)).toBe(true);
    expect(res.status).not.toBe(500);
  });

  it('5. JWT expiré (jwtVerify throw JWTExpired) → redirect /login', async () => {
    mockJwtVerify.mockRejectedValue(new Error('JWTExpired'));
    const { middleware } = await import('@/middleware');
    const res = await middleware(makeAdminRequest('expired.jwt.token'));
    expect(isRedirectToLogin(res)).toBe(true);
  });
});
