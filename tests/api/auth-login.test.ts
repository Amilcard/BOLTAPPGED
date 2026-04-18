/**
 * @jest-environment node
 *
 * Tests API — POST /api/auth/login
 *
 * Vérifie : validation entrées, rate limiting, réponse générique (anti-énumération),
 * cookie httpOnly (token PAS dans le body), JWT valide en cookie.
 *
 * Scénarios :
 *  1. Email manquant → 400
 *  2. Password manquant → 400
 *  3. Rate limit dépassé → 429
 *  4. Identifiants invalides → 401 (message générique, pas d'info compte)
 *  5. Connexion réussie → 200 + { ok: true } (PAS de token dans le body)
 *  6. Connexion réussie → cookie gd_session httpOnly posé
 *  7. Connexion réussie → cookie contient un JWT valide avec role
 *  8. NEXTAUTH_SECRET manquant → 500
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon-key-test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service-role-test';
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-ok!';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock supabase-server (rate limiting)
const mockSupabaseAdminFrom = jest.fn();
jest.mock('@/lib/supabase-server', () => ({
  getSupabaseAdmin: () => ({ from: mockSupabaseAdminFrom }),
}));

// Mock @supabase/supabase-js (auth signInWithPassword)
const mockSignInWithPassword = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
    },
  }),
}));

import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { POST } from '@/app/api/auth/login/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLoginRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockRateLimit(limited: boolean) {
  // isRateLimited uses: .from().select().eq().single() and .from().upsert() / .from().update()
  mockSupabaseAdminFrom.mockImplementation(() => ({
    select: () => ({
      eq: () => ({
        single: () =>
          limited
            ? { data: { attempt_count: 10, window_start: new Date().toISOString() }, error: null }
            : { data: null, error: null },
      }),
    }),
    upsert: () => ({ error: null }),
    update: () => ({ eq: () => ({ error: null }) }),
    delete: () => ({
      eq: () => ({ error: null }),
      in: () => ({ error: null }),
    }),
  }));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimit(false); // not rate-limited by default
    process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-ok!';
  });

  it('retourne 400 si email manquant', async () => {
    const res = await POST(makeLoginRequest({ password: 'secret' }));
    expect(res.status).toBe(400);
  });

  it('retourne 400 si password manquant', async () => {
    const res = await POST(makeLoginRequest({ email: 'user@ged.fr' }));
    expect(res.status).toBe(400);
  });

  it('retourne 429 si rate limit dépassé', async () => {
    // Override le mock global de @/lib/rate-limit pour ce test
    const rateLimit = jest.requireMock<{ isRateLimited: jest.Mock }>('@/lib/rate-limit');
    rateLimit.isRateLimited.mockResolvedValueOnce(true);
    const res = await POST(makeLoginRequest({ email: 'user@ged.fr', password: 'pass' }));
    expect(res.status).toBe(429);
  });

  it('retourne 401 si identifiants invalides (message générique — anti-énumération)', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid credentials' } });
    const res = await POST(makeLoginRequest({ email: 'wrong@ged.fr', password: 'badpass' }));
    const body = await res.json();
    expect(res.status).toBe(401);
    // Le message doit être générique — ne PAS révéler si l'email existe
    expect(body.error).toBe('Identifiants invalides.');
    expect(body.error).not.toMatch(/email/i);
    expect(body.error).not.toMatch(/password|mot de passe/i);
  });

  it('connexion réussie → 200 + { ok: true, user } (cookie-only)', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: 'user-uuid-1',
          email: 'admin@ged.fr',
          app_metadata: { role: 'ADMIN' },
        },
      },
      error: null,
    });
    const res = await POST(makeLoginRequest({ email: 'admin@ged.fr', password: 'correct' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.user).toHaveProperty('email', 'admin@ged.fr');
    expect(body.user).toHaveProperty('role', 'ADMIN');
    // Token en cookie httpOnly — absent du body depuis migration 28 mars
    expect(body.token).toBeUndefined();
    expect(body.access_token).toBeUndefined();
    expect(body.gd_session).toBeUndefined();
  });

  it('connexion réussie → cookie gd_session posé', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: 'user-uuid-1',
          email: 'admin@ged.fr',
          app_metadata: { role: 'ADMIN' },
        },
      },
      error: null,
    });
    const res = await POST(makeLoginRequest({ email: 'admin@ged.fr', password: 'correct' }));
    const cookieHeader = res.headers.get('set-cookie') ?? '';
    expect(cookieHeader).toMatch(/gd_session=/);
    expect(cookieHeader).toMatch(/HttpOnly/i);
  });

  it('connexion réussie → cookie contient JWT avec role correct', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: 'user-uuid-editor',
          email: 'editor@ged.fr',
          app_metadata: { role: 'EDITOR' },
        },
      },
      error: null,
    });
    const res = await POST(makeLoginRequest({ email: 'editor@ged.fr', password: 'correct' }));
    const cookieHeader = res.headers.get('set-cookie') ?? '';
    const match = cookieHeader.match(/gd_session=([^;]+)/);
    expect(match).not.toBeNull();
    const token = match?.[1];
    expect(token).toBeDefined();
    const secret = process.env.NEXTAUTH_SECRET;
    expect(secret).toBeDefined();
    const decoded = jwt.verify(token as string, secret as string) as { role: string; email: string };
    expect(decoded.role).toBe('EDITOR');
    expect(decoded.email).toBe('editor@ged.fr');
  });

  it('retourne 500 si NEXTAUTH_SECRET absent', async () => {
    delete process.env.NEXTAUTH_SECRET;
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: 'user-uuid-1',
          email: 'admin@ged.fr',
          app_metadata: { role: 'ADMIN' },
        },
      },
      error: null,
    });
    const res = await POST(makeLoginRequest({ email: 'admin@ged.fr', password: 'correct' }));
    expect(res.status).toBe(500);
  });
});
