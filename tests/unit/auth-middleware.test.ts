/**
 * @jest-environment node
 *
 * Tests unitaires — lib/auth-middleware.ts
 *
 * Couvre verifyAuth / requireAdmin / requireEditor sans I/O réseau.
 * Le JWT est signé avec jsonwebtoken directement dans les tests.
 *
 * Scénarios :
 *  1. Token absent → null
 *  2. Token malformé → null
 *  3. Token expiré → null
 *  4. Secret manquant (NEXTAUTH_SECRET absent) → null (fail-safe)
 *  5. Token valide Bearer header → payload
 *  6. Token valide cookie gd_session → payload
 *  7. Role VIEWER → requireAdmin → null
 *  8. Role EDITOR → requireAdmin → null
 *  9. Role ADMIN → requireAdmin → payload
 * 10. Role VIEWER → requireEditor → null
 * 11. Role EDITOR → requireEditor → payload
 * 12. Role ADMIN → requireEditor → payload
 * 13. Token signé avec mauvais secret → null
 */

import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const SECRET = 'test-secret-32-chars-minimum-ok!';
const OTHER_SECRET = 'completely-different-secret-here!';

const PAYLOAD = { userId: 'user-1', email: 'admin@ged.fr', role: 'ADMIN' as const };

function makeToken(payload: object, secret = SECRET, opts: jwt.SignOptions = {}) {
  return jwt.sign(payload, secret, { expiresIn: '1h', ...opts });
}

function makeRequest(token?: string, via: 'header' | 'cookie' = 'header'): NextRequest {
  const headers = new Headers();
  if (token && via === 'header') {
    headers.set('authorization', `Bearer ${token}`);
  }
  const req = new NextRequest('http://localhost/api/test', { headers });
  if (token && via === 'cookie') {
    // NextRequest cookies are read-only; inject via Cookie header
    const h = new Headers();
    h.set('Cookie', `gd_session=${token}`);
    return new NextRequest('http://localhost/api/test', { headers: h });
  }
  return req;
}

describe('verifyAuth', () => {
  const originalSecret = process.env.NEXTAUTH_SECRET;

  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = SECRET;
  });

  afterEach(() => {
    process.env.NEXTAUTH_SECRET = originalSecret;
  });

  it('retourne null si aucun token (pas de header ni cookie)', async () => {
    const { verifyAuth } = await import('@/lib/auth-middleware');
    const req = makeRequest();
    await expect(verifyAuth(req)).resolves.toBeNull();
  });

  it('retourne null si token malformé', async () => {
    const { verifyAuth } = await import('@/lib/auth-middleware');
    const req = makeRequest('not.a.valid.jwt');
    await expect(verifyAuth(req)).resolves.toBeNull();
  });

  it('retourne null si token expiré', async () => {
    const { verifyAuth } = await import('@/lib/auth-middleware');
    const token = makeToken(PAYLOAD, SECRET, { expiresIn: -1 });
    const req = makeRequest(token);
    await expect(verifyAuth(req)).resolves.toBeNull();
  });

  it('retourne null si NEXTAUTH_SECRET absent (fail-safe)', async () => {
    delete process.env.NEXTAUTH_SECRET;
    const { verifyAuth } = await import('@/lib/auth-middleware');
    const token = makeToken(PAYLOAD);
    const req = makeRequest(token);
    await expect(verifyAuth(req)).resolves.toBeNull();
  });

  it('retourne payload si Bearer header valide', async () => {
    const { verifyAuth } = await import('@/lib/auth-middleware');
    const token = makeToken(PAYLOAD);
    const req = makeRequest(token, 'header');
    const result = await verifyAuth(req);
    expect(result).not.toBeNull();
    expect(result?.userId).toBe('user-1');
    expect(result?.role).toBe('ADMIN');
  });

  it('retourne payload si cookie gd_session valide', async () => {
    const { verifyAuth } = await import('@/lib/auth-middleware');
    const token = makeToken(PAYLOAD);
    const req = makeRequest(token, 'cookie');
    const result = await verifyAuth(req);
    expect(result).not.toBeNull();
    expect(result?.email).toBe('admin@ged.fr');
  });

  it('retourne null si token signé avec un autre secret', async () => {
    const { verifyAuth } = await import('@/lib/auth-middleware');
    const token = makeToken(PAYLOAD, OTHER_SECRET);
    const req = makeRequest(token);
    await expect(verifyAuth(req)).resolves.toBeNull();
  });
});

describe('requireAdmin', () => {
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = SECRET;
  });

  it('retourne null si role VIEWER', async () => {
    const { requireAdmin } = await import('@/lib/auth-middleware');
    const token = makeToken({ ...PAYLOAD, role: 'VIEWER' });
    await expect(requireAdmin(makeRequest(token))).resolves.toBeNull();
  });

  it('retourne null si role EDITOR', async () => {
    const { requireAdmin } = await import('@/lib/auth-middleware');
    const token = makeToken({ ...PAYLOAD, role: 'EDITOR' });
    await expect(requireAdmin(makeRequest(token))).resolves.toBeNull();
  });

  it('retourne payload si role ADMIN', async () => {
    const { requireAdmin } = await import('@/lib/auth-middleware');
    const token = makeToken({ ...PAYLOAD, role: 'ADMIN' });
    const result = await requireAdmin(makeRequest(token));
    expect(result?.role).toBe('ADMIN');
  });
});

describe('requireEditor', () => {
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = SECRET;
  });

  it('retourne null si role VIEWER', async () => {
    const { requireEditor } = await import('@/lib/auth-middleware');
    const token = makeToken({ ...PAYLOAD, role: 'VIEWER' });
    await expect(requireEditor(makeRequest(token))).resolves.toBeNull();
  });

  it('retourne payload si role EDITOR', async () => {
    const { requireEditor } = await import('@/lib/auth-middleware');
    const token = makeToken({ ...PAYLOAD, role: 'EDITOR' });
    const result = await requireEditor(makeRequest(token));
    expect(result?.role).toBe('EDITOR');
  });

  it('retourne payload si role ADMIN (accès éditeur inclus)', async () => {
    const { requireEditor } = await import('@/lib/auth-middleware');
    const token = makeToken({ ...PAYLOAD, role: 'ADMIN' });
    const result = await requireEditor(makeRequest(token));
    expect(result?.role).toBe('ADMIN');
  });
});
