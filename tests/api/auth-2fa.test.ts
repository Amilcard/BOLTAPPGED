/**
 * @jest-environment node
 *
 * Tests unitaires — 2FA TOTP
 * Routes : POST /api/auth/2fa/setup | confirm | verify | disable
 *
 * Scénarios couverts :
 *  Setup
 *   1. Sans JWT → 401
 *   2. Avec JWT valide → 200 + qrCodeUrl + secret
 *   3. Sauvegarde en base avec enabled: false
 *
 *  Confirm
 *   4. Sans JWT → 401
 *   5. Code TOTP invalide → 400
 *   6. 2FA non configurée (pas de /setup d'abord) → 404
 *   7. Code TOTP valide → 200 + enabled: true en base
 *
 *  Verify (après login email/password)
 *   8. pendingToken manquant → 400
 *   9. pendingToken expiré/invalide → 401
 *  10. pending2fa: false dans le token → 401
 *  11. 2FA non activée pour ce compte → 400
 *  12. Code TOTP invalide → 400
 *  13. Code TOTP valide → 200 + cookie session posé
 */

// ── Env ──────────────────────────────────────────────────────────────────────
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake';
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-here!!';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockFrom = jest.fn();
const mockVerifyToken = jest.fn();
const mockGenerateSecret = jest.fn().mockReturnValue('JBSWY3DPEHPK3PXP');
const mockGenerateOtpAuthUrl = jest.fn().mockReturnValue('otpauth://totp/test');
const mockGetQrCodeUrl = jest.fn().mockReturnValue('https://chart.googleapis.com/qr?...');

jest.mock('@/lib/supabase-server', () => ({
  getSupabase: () => ({ from: mockFrom }),
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));

jest.mock('@/lib/totp', () => ({
  verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
  generateSecret: () => mockGenerateSecret(),
  generateOtpAuthUrl: (...args: unknown[]) => mockGenerateOtpAuthUrl(...args),
  getQrCodeUrl: (...args: unknown[]) => mockGetQrCodeUrl(...args),
}));

// Mock auth-cookies pour éviter les Set-Cookie dans les tests
jest.mock('@/lib/auth-cookies', () => ({
  setSessionCookie: jest.fn((res: unknown) => res),
}));

import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { POST as setupPOST } from '@/app/api/auth/2fa/setup/route';
import { POST as confirmPOST } from '@/app/api/auth/2fa/confirm/route';
import { POST as verifyPOST } from '@/app/api/auth/2fa/verify/route';

// ── Helpers ──────────────────────────────────────────────────────────────────

const SECRET = process.env.NEXTAUTH_SECRET;
if (!SECRET) throw new Error('NEXTAUTH_SECRET must be set for tests');
const USER_ID = 'user_abc123';
const USER_EMAIL = 'admin@ged.fr';
const USER_ROLE = 'ADMIN';

/** JWT admin complet (pas pending2fa) */
function makeAdminToken() {
  return jwt.sign({ userId: USER_ID, email: USER_EMAIL, role: USER_ROLE }, SECRET, { expiresIn: '8h' });
}

/** JWT pending2fa (après email/password, avant TOTP) */
function makePendingToken(overrides: Record<string, unknown> = {}) {
  return jwt.sign(
    { userId: USER_ID, email: USER_EMAIL, role: USER_ROLE, pending2fa: true, ...overrides },
    SECRET,
    { expiresIn: '5m' }
  );
}

function makeRequest(body: Record<string, unknown>, authToken?: string): NextRequest {
  const headers = new Map<string, string>();
  if (authToken) headers.set('authorization', `Bearer ${authToken}`);
  return {
    json: () => Promise.resolve(body),
    cookies: { get: () => undefined },
    headers: { get: (k: string) => headers.get(k) ?? null },
  } as unknown as NextRequest;
}

// ── Tests SETUP ──────────────────────────────────────────────────────────────

describe('POST /api/auth/2fa/setup', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sans JWT → 401', async () => {
    const req = makeRequest({});
    const res = await setupPOST(req);
    expect(res.status).toBe(401);
  });

  it('JWT valide → 200 + qrCodeUrl + secret', async () => {
    const mockUpsert = jest.fn().mockReturnValue({ error: null });
    mockFrom.mockReturnValue({ upsert: mockUpsert });

    const req = makeRequest({}, makeAdminToken());
    const res = await setupPOST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.qrCodeUrl).toBeDefined();
    expect(json.secret).toBe('JBSWY3DPEHPK3PXP');
  });

  it('sauvegarde en base avec enabled: false', async () => {
    const mockUpsert = jest.fn().mockReturnValue({ error: null });
    mockFrom.mockReturnValue({ upsert: mockUpsert });

    const req = makeRequest({}, makeAdminToken());
    await setupPOST(req);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, user_id: USER_ID }),
      expect.any(Object)
    );
  });
});

// ── Tests CONFIRM ─────────────────────────────────────────────────────────────

describe('POST /api/auth/2fa/confirm', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sans JWT → 401', async () => {
    const req = makeRequest({ code: '123456' });
    const res = await confirmPOST(req);
    expect(res.status).toBe(401);
  });

  it('2FA non configurée (pas de setup) → 404', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) }),
    });

    const req = makeRequest({ code: '123456' }, makeAdminToken());
    const res = await confirmPOST(req);
    expect(res.status).toBe(404);
  });

  it('code TOTP invalide → 400', async () => {
    mockVerifyToken.mockReturnValue(false);
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => ({ data: { totp_secret: 'SECRET' }, error: null }) }) }),
    });

    const req = makeRequest({ code: '000000' }, makeAdminToken());
    const res = await confirmPOST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalide/i);
  });

  it('code TOTP valide → 200 + enabled: true en base', async () => {
    mockVerifyToken.mockReturnValue(true);
    const mockUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ error: null }) });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gd_admin_2fa') return {
        select: () => ({ eq: () => ({ single: () => ({ data: { totp_secret: 'SECRET' }, error: null }) }) }),
        update: mockUpdate,
      };
      return { select: () => ({ eq: () => ({ single: () => ({ data: null }) }) }) };
    });

    const req = makeRequest({ code: '123456' }, makeAdminToken());
    const res = await confirmPOST(req);
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true })
    );
  });
});

// ── Tests VERIFY ─────────────────────────────────────────────────────────────

describe('POST /api/auth/2fa/verify', () => {
  beforeEach(() => jest.clearAllMocks());

  it('pendingToken manquant → 400', async () => {
    const req = makeRequest({ code: '123456' });
    const res = await verifyPOST(req);
    expect(res.status).toBe(400);
  });

  it('pendingToken JWT invalide/expiré → 401', async () => {
    const req = makeRequest({ pendingToken: 'token.invalide.xxx', code: '123456' });
    const res = await verifyPOST(req);
    expect(res.status).toBe(401);
  });

  it('token sans pending2fa: true → 401', async () => {
    const tokenSansPending = jwt.sign({ userId: USER_ID, email: USER_EMAIL, role: USER_ROLE }, SECRET, { expiresIn: '5m' });
    const req = makeRequest({ pendingToken: tokenSansPending, code: '123456' });
    const res = await verifyPOST(req);
    expect(res.status).toBe(401);
  });

  it('2FA non activée pour ce compte → 400', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => ({ data: { totp_secret: 'SECRET', enabled: false }, error: null }) }) }),
    });

    const req = makeRequest({ pendingToken: makePendingToken(), code: '123456' });
    const res = await verifyPOST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/non activée/i);
  });

  it('code TOTP invalide → 400', async () => {
    mockVerifyToken.mockReturnValue(false);
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => ({ data: { totp_secret: 'SECRET', enabled: true }, error: null }) }) }),
    });

    const req = makeRequest({ pendingToken: makePendingToken(), code: '000000' });
    const res = await verifyPOST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalide/i);
  });

  it('code TOTP valide → 200 + ok: true', async () => {
    mockVerifyToken.mockReturnValue(true);
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => ({ data: { totp_secret: 'SECRET', enabled: true }, error: null }) }) }),
    });

    const req = makeRequest({ pendingToken: makePendingToken(), code: '123456' });
    const res = await verifyPOST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });
});
