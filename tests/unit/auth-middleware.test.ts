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

// ─────────────────────────────────────────────────────────────
// verifyProSession — fallback legacy (#6 architect-fixes 2026-04-17)
// ─────────────────────────────────────────────────────────────

jest.mock('@/lib/structure');
jest.mock('@/lib/supabase-server');

describe('verifyProSession - legacy fallback', () => {
  const PRO_SECRET = 'test-secret-min-32-chars-long-xxxxxxxxx';

  beforeAll(() => {
    process.env.NEXTAUTH_SECRET = PRO_SECRET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env.NEXTAUTH_SECRET = PRO_SECRET;
  });

  const makeProRequest = async (payload: Record<string, unknown>) => {
    const { SignJWT } = await import('jose');
    const encodedSecret = new TextEncoder().encode(PRO_SECRET);
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('30m')
      .sign(encodedSecret);
    return new NextRequest('http://localhost/', {
      headers: { cookie: `gd_pro_session=${token}` },
    });
  };

  test('token legacy sans structureRole → résolu via resolveCodeToStructure', async () => {
    const { resolveCodeToStructure } = await import('@/lib/structure');
    const { getSupabaseAdmin } = await import('@/lib/supabase-server');
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's-123', name: 'MECS' },
      role: 'cds',
      roles: ['cds'],
      email: null,
      prenom: null,
      nom: null,
    });
    (getSupabaseAdmin as jest.Mock).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
        }),
      }),
    });

    const { verifyProSession } = await import('@/lib/auth-middleware');
    const req = await makeProRequest({
      role: 'pro',
      type: 'pro_session',
      email: 'x@y.fr',
      structureCode: 'ABC123',
      structureName: 'MECS',
      // pas de structureRole ni structureId
    });
    const result = await verifyProSession(req);
    expect(result).not.toBeNull();
    expect(result?.structureRole).toBe('cds');
    expect(result?.structureId).toBe('s-123');
  });

  test('token legacy avec structureCode invalide → null', async () => {
    const { resolveCodeToStructure } = await import('@/lib/structure');
    const { getSupabaseAdmin } = await import('@/lib/supabase-server');
    (resolveCodeToStructure as jest.Mock).mockResolvedValue(null);
    (getSupabaseAdmin as jest.Mock).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
        }),
      }),
    });

    const { verifyProSession } = await import('@/lib/auth-middleware');
    const req = await makeProRequest({
      role: 'pro',
      type: 'pro_session',
      email: 'x@y.fr',
      structureCode: 'INVALID',
      structureName: 'X',
    });
    const result = await verifyProSession(req);
    expect(result).toBeNull();
  });

  test('token new format avec structureRole présent → pas de fallback', async () => {
    const { resolveCodeToStructure } = await import('@/lib/structure');
    const { getSupabaseAdmin } = await import('@/lib/supabase-server');
    (getSupabaseAdmin as jest.Mock).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
        }),
      }),
    });

    const { verifyProSession } = await import('@/lib/auth-middleware');
    const req = await makeProRequest({
      role: 'pro',
      type: 'pro_session',
      email: 'x@y.fr',
      structureCode: 'ABC123',
      structureName: 'MECS',
      structureRole: 'secretariat',
      structureId: 's-456',
      jti: 'jti-new',
    });
    const result = await verifyProSession(req);
    expect(result?.structureRole).toBe('secretariat');
    expect(result?.structureId).toBe('s-456');
    expect(resolveCodeToStructure).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// buildProSessionToken — factorisation JWT pro_session (#11)
// ─────────────────────────────────────────────────────────────

describe('buildProSessionToken', () => {
  const SECRET = 'test-secret-min-32-chars-long-xxxxxxxxx';
  beforeAll(() => { process.env.NEXTAUTH_SECRET = SECRET; });

  test('retourne un JWT contenant tous les champs ProSessionPayload + jti', async () => {
    const { buildProSessionToken } = await import('@/lib/auth-middleware');
    const result = await buildProSessionToken({
      email: 'x@y.fr',
      structureCode: 'ABCDEF',
      structureName: 'MECS Test',
      structureRole: 'secretariat',
      structureId: 's-123',
      expiresIn: '30m',
    });
    expect(result).not.toBeNull();
    expect(result?.token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(result?.jti).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(result?.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // Décoder le JWT et vérifier les claims
    const { jwtVerify } = await import('jose');
    const encoded = new TextEncoder().encode(SECRET);
    const { payload } = await jwtVerify(result!.token, encoded);
    expect(payload.role).toBe('pro');
    expect(payload.type).toBe('pro_session');
    expect(payload.email).toBe('x@y.fr');
    expect(payload.structureCode).toBe('ABCDEF');
    expect(payload.structureName).toBe('MECS Test');
    expect(payload.structureRole).toBe('secretariat');
    expect(payload.structureId).toBe('s-123');
    expect(payload.jti).toBe(result!.jti);
  });

  test('retourne null si NEXTAUTH_SECRET manquant', async () => {
    const { buildProSessionToken } = await import('@/lib/auth-middleware');
    const oldSecret = process.env.NEXTAUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    const result = await buildProSessionToken({
      email: 'x@y.fr', structureCode: 'ABCDEF', structureName: 'S',
      structureRole: 'cds', structureId: 's-1', expiresIn: '8h',
    });
    expect(result).toBeNull();
    process.env.NEXTAUTH_SECRET = oldSecret;
  });

  test('TTL 8h calcule expiresAt à ~8h dans le futur', async () => {
    const { buildProSessionToken } = await import('@/lib/auth-middleware');
    const result = await buildProSessionToken({
      email: 'x@y.fr', structureCode: 'ABCDEF', structureName: 'S',
      structureRole: 'direction', structureId: 's-1', expiresIn: '8h',
    });
    const delta = new Date(result!.expiresAt).getTime() - Date.now();
    expect(delta).toBeGreaterThan(7.9 * 3600 * 1000);
    expect(delta).toBeLessThan(8.1 * 3600 * 1000);
  });
});
