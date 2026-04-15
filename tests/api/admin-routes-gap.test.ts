/**
 * @jest-environment node
 *
 * Lot 1 — Routes admin à 0% coverage
 *
 * Couvre les 5 endpoints non testés identifiés à l'audit :
 *   GET  /api/admin/stats
 *   GET  /api/admin/stays/[id]/sessions
 *   GET  /api/admin/session-prices
 *   POST /api/admin/stays/[id]/notify-waitlist
 *   GET  /api/admin/dossier-enfant/[inscriptionId]
 *
 * Chaque endpoint : 401/403 sans auth ou mauvais rôle + cas heureux minimal.
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake';
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-key!';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockFrom = jest.fn();
jest.mock('@/lib/audit-log', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
  getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
}));

jest.mock('@/lib/supabase-server', () => ({
  getSupabase: () => ({ from: mockFrom }),
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));
jest.mock('@/lib/email', () => ({
  sendWaitlistNotification: jest.fn().mockResolvedValue(undefined),
}));

import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const S = process.env.NEXTAUTH_SECRET;
if (!S) throw new Error('NEXTAUTH_SECRET must be set for tests');
const EDITOR = jwt.sign({ userId: 'e1', email: 'ed@ged.fr', role: 'EDITOR' }, S, { expiresIn: '1h' });
const ADMIN  = jwt.sign({ userId: 'a1', email: 'ad@ged.fr', role: 'ADMIN'  }, S, { expiresIn: '1h' });
const VIEWER = jwt.sign({ userId: 'v1', email: 'vw@ged.fr', role: 'VIEWER' }, S, { expiresIn: '1h' });

const STAY_ID   = 'sejour-alpes';
const INSC_ID   = 'aaa00000-0000-0000-0000-000000000001';

function r(url: string, opts: { method?: string; token?: string; body?: object } = {}): NextRequest {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) h['Authorization'] = `Bearer ${opts.token}`;
  return new NextRequest(`http://localhost${url}`, {
    method: opts.method ?? 'GET', headers: h,
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  });
}

// ── Imports (après les mocks) ─────────────────────────────────────────────────

import { GET as statsGet }         from '@/app/api/admin/stats/route';
import { GET as sessionsGet }      from '@/app/api/admin/stays/[id]/sessions/route';
import { GET as sessionPricesGet } from '@/app/api/admin/session-prices/route';
import { POST as notifyPost }      from '@/app/api/admin/stays/[id]/notify-waitlist/route';
import { GET as adminDossierGet }  from '@/app/api/admin/dossier-enfant/[inscriptionId]/route';

// ── 1. GET /api/admin/stats ───────────────────────────────────────────────────

describe('GET /api/admin/stats', () => {
  beforeEach(() => {
    const mockResolvedEmpty = { count: 0, data: [], error: null };
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockResolvedValue(mockResolvedEmpty),
        }),
        is: jest.fn().mockResolvedValue(mockResolvedEmpty),
        gte: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
        ...mockResolvedEmpty,
      }),
    });
  });

  it('sans auth → 401', async () => {
    const res = await statsGet(r('/api/admin/stats'));
    expect(res.status).toBe(401);
  });

  it('EDITOR → 200 + structure clés attendues', async () => {
    // 9 requêtes parallèles + 1 post (top séjours titles) — mock universel récursif
    const empty = { count: 0, data: [], error: null };

    // Proxy récursif : chaque méthode chaînée retourne le même proxy,
    // et résout en empty quand attendu comme Promise (pour .then/.await)
    function makeChainProxy(): Record<string, unknown> {
      const handler: ProxyHandler<Record<string, unknown>> = {
        get(_target, prop) {
          if (prop === 'then') {
            // Rend le proxy thenable → résout en empty
            return (resolve: (v: unknown) => void) => resolve(empty);
          }
          if (prop === 'count') return 0;
          if (prop === 'data') return [];
          if (prop === 'error') return null;
          // Toute méthode chaînée retourne un nouveau proxy
          return jest.fn().mockReturnValue(new Proxy({}, handler));
        },
      };
      return new Proxy({}, handler);
    }

    mockFrom.mockReturnValue(makeChainProxy());

    const res = await statsGet(r('/api/admin/stats', { token: EDITOR }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('stays');
    expect(body).toHaveProperty('bookings');
    expect(body).toHaveProperty('byStatus');
    expect(body).toHaveProperty('recentDays');
    expect(body).toHaveProperty('topSejours');
  });
});

// ── 2. GET /api/admin/stays/[id]/sessions ─────────────────────────────────────

describe('GET /api/admin/stays/[id]/sessions', () => {
  it('sans auth → 403', async () => {
    const res = await sessionsGet(r(`/api/admin/stays/${STAY_ID}/sessions`), {
      params: Promise.resolve({ id: STAY_ID }),
    });
    expect(res.status).toBe(403);
  });

  it('EDITOR → 200 + mapping camelCase (startDate, seatsLeft)', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [{ id: 's1', stay_slug: STAY_ID, start_date: '2026-07-08', end_date: '2026-07-14', seats_total: 20, seats_left: 5 }],
            error: null,
          }),
        }),
      }),
    });
    const res = await sessionsGet(r(`/api/admin/stays/${STAY_ID}/sessions`, { token: EDITOR }), {
      params: Promise.resolve({ id: STAY_ID }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0]).toHaveProperty('startDate');   // camelCase correct
    expect(body[0]).toHaveProperty('seatsLeft');
    expect(body[0]).not.toHaveProperty('start_date'); // snake_case absent
  });
});

// ── 3. GET /api/admin/session-prices ─────────────────────────────────────────

describe('GET /api/admin/session-prices', () => {
  it('sans auth → 401', async () => {
    const res = await sessionPricesGet(r('/api/admin/session-prices'));
    expect(res.status).toBe(401);
  });

  it('stay_slug absent → 400', async () => {
    const res = await sessionPricesGet(r('/api/admin/session-prices', { token: EDITOR }));
    expect(res.status).toBe(400);
  });

  it('stay_slug fourni + EDITOR → 200 + { sessions: [] }', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });
    const res = await sessionPricesGet(
      r(`/api/admin/session-prices?stay_slug=${STAY_ID}`, { token: ADMIN })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('sessions');
    expect(Array.isArray(body.sessions)).toBe(true);
  });
});

// ── 4. POST /api/admin/stays/[id]/notify-waitlist ────────────────────────────

describe('POST /api/admin/stays/[id]/notify-waitlist', () => {
  it('sans auth → 403', async () => {
    const res = await notifyPost(r(`/api/admin/stays/${STAY_ID}/notify-waitlist`, { method: 'POST' }), {
      params: Promise.resolve({ id: STAY_ID }),
    });
    expect(res.status).toBe(403);
  });

  it('VIEWER → 403 (EDITOR requis)', async () => {
    const res = await notifyPost(r(`/api/admin/stays/${STAY_ID}/notify-waitlist`, { method: 'POST', token: VIEWER }), {
      params: Promise.resolve({ id: STAY_ID }),
    });
    expect(res.status).toBe(403);
  });
});

// ── 5. GET /api/admin/dossier-enfant/[inscriptionId] ─────────────────────────

describe('GET /api/admin/dossier-enfant/[inscriptionId]', () => {
  it('sans auth → 401', async () => {
    const res = await adminDossierGet(r(`/api/admin/dossier-enfant/${INSC_ID}`), {
      params: Promise.resolve({ inscriptionId: INSC_ID }),
    });
    expect(res.status).toBe(401);
  });

  it('EDITOR → 200 + exists:false si dossier absent', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
    const res = await adminDossierGet(r(`/api/admin/dossier-enfant/${INSC_ID}`, { token: EDITOR }), {
      params: Promise.resolve({ inscriptionId: INSC_ID }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.exists).toBe(false);
  });
});
