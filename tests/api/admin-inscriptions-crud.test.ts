/**
 * @jest-environment node
 *
 * Tests intégration API — Admin inscriptions CRUD
 *
 * GET  /api/admin/inscriptions          — liste (EDITOR+)
 * GET  /api/admin/inscriptions/[id]     — détail (toute auth)
 * PUT  /api/admin/inscriptions/[id]     — mise à jour statut (EDITOR+)
 * DELETE /api/admin/inscriptions/[id]  — suppression (ADMIN only)
 *
 * Scénarios :
 *  1. GET liste sans auth → 401
 *  2. GET liste VIEWER → 401
 *  3. GET liste EDITOR → 200 + tableau
 *  4. GET liste ADMIN avec filtre ?status=validee → filtre appliqué
 *  5. GET [id] sans auth → 401
 *  6. GET [id] inexistant → 404
 *  7. GET [id] avec auth → 200 + inscription
 *  8. PUT statut invalide → 400
 *  9. PUT body vide (aucun champ) → 400
 * 10. PUT EDITOR → 200 (statut mis à jour)
 * 11. DELETE EDITOR (pas ADMIN) → 401
 * 12. DELETE ADMIN → 200
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-key';
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-key!';

// ── Mocks ────────────────────────────────────────────────────────────────────

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
  sendStatusChangeEmail: jest.fn().mockResolvedValue({ sent: true, messageId: 'mock-id' }),
}));

jest.mock('@/lib/email-logger', () => ({
  logEmailFailure: jest.fn().mockResolvedValue(undefined),
}));

import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const SECRET = process.env.NEXTAUTH_SECRET;
if (!SECRET) throw new Error('NEXTAUTH_SECRET must be set for tests');

const ADMIN_TOKEN = jwt.sign({ userId: 'admin-1', email: 'admin@ged.fr', role: 'ADMIN' }, SECRET, { expiresIn: '1h' });
const EDITOR_TOKEN = jwt.sign({ userId: 'editor-1', email: 'editor@ged.fr', role: 'EDITOR' }, SECRET, { expiresIn: '1h' });
const VIEWER_TOKEN = jwt.sign({ userId: 'viewer-1', email: 'viewer@ged.fr', role: 'VIEWER' }, SECRET, { expiresIn: '1h' });

const INSCRIPTION_ID = 'aaa00000-0000-0000-0000-000000000001';

const SAMPLE_INSCRIPTION = {
  id: INSCRIPTION_ID,
  jeune_prenom: 'Léo',
  jeune_nom: 'Martin',
  referent_email: 'ref@structure.fr',
  referent_nom: 'Alice',
  sejour_slug: 'sejour-alpes',
  status: 'en_attente',
  payment_status: 'pending_payment',
  price_total: 350,
  created_at: '2026-03-01T10:00:00Z',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function req(url: string, opts: { method?: string; token?: string; body?: object } = {}): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
  return new NextRequest(`http://localhost:3000${url}`, {
    method: opts.method ?? 'GET',
    headers,
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  });
}

// ── Tests — GET /api/admin/inscriptions ──────────────────────────────────────

import { GET as listInscriptions } from '@/app/api/admin/inscriptions/route';
import { GET as getInscription, PUT as putInscription, DELETE as deleteInscription } from '@/app/api/admin/inscriptions/[id]/route';

describe('GET /api/admin/inscriptions', () => {
  beforeEach(() => {
    // Chaîne : .select().eq('gd_structures.is_test', false).is().order().range()
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              range: jest.fn().mockResolvedValue({ data: [SAMPLE_INSCRIPTION], count: 1, error: null }),
            }),
          }),
        }),
      }),
    });
  });

  it('retourne 401 sans auth', async () => {
    const res = await listInscriptions(req('/api/admin/inscriptions'));
    expect(res.status).toBe(401);
  });

  it('retourne 401 si rôle VIEWER', async () => {
    const res = await listInscriptions(req('/api/admin/inscriptions', { token: VIEWER_TOKEN }));
    expect(res.status).toBe(401);
  });

  it('retourne 200 avec liste si EDITOR', async () => {
    const res = await listInscriptions(req('/api/admin/inscriptions', { token: EDITOR_TOKEN }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.total).toBe('number');
  });

  it('filtre ?status appliqué (ADMIN)', async () => {
    // Chaîne réelle : select().eq('gd_structures.is_test', false).is().order().range().eq('status', 'validee')
    const statusEqMock = jest.fn().mockResolvedValue({ data: [], count: 0, error: null });
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              range: jest.fn().mockReturnValue({
                eq: statusEqMock,
              }),
            }),
          }),
        }),
      }),
    });
    await listInscriptions(req('/api/admin/inscriptions?status=validee', { token: ADMIN_TOKEN }));
    expect(statusEqMock).toHaveBeenCalledWith('status', 'validee');
  });
});

// ── Tests — GET /api/admin/inscriptions/[id] ─────────────────────────────────

describe('GET /api/admin/inscriptions/[id]', () => {
  it('retourne 403 sans auth', async () => {
    const res = await getInscription(req(`/api/admin/inscriptions/${INSCRIPTION_ID}`), {
      params: Promise.resolve({ id: INSCRIPTION_ID }),
    });
    expect(res.status).toBe(403);
  });

  it('retourne 404 si inscription inexistante', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
          }),
        }),
      }),
    });
    const res = await getInscription(req(`/api/admin/inscriptions/${INSCRIPTION_ID}`, { token: EDITOR_TOKEN }), {
      params: Promise.resolve({ id: INSCRIPTION_ID }),
    });
    expect(res.status).toBe(404);
  });

  it('retourne 200 avec données inscription (ADMIN)', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: SAMPLE_INSCRIPTION, error: null }),
          }),
        }),
      }),
    });
    const res = await getInscription(req(`/api/admin/inscriptions/${INSCRIPTION_ID}`, { token: ADMIN_TOKEN }), {
      params: Promise.resolve({ id: INSCRIPTION_ID }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(INSCRIPTION_ID);
    expect(body.jeune_prenom).toBe('Léo');
  });
});

// ── Tests — PUT /api/admin/inscriptions/[id] ─────────────────────────────────

describe('PUT /api/admin/inscriptions/[id]', () => {
  const mockUpdateChain = (returnData: object) => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: SAMPLE_INSCRIPTION, error: null }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { ...SAMPLE_INSCRIPTION, ...returnData }, error: null }),
            }),
          }),
        }),
      }),
      insert: jest.fn().mockReturnValue({
        then: jest.fn(),
      }),
    });
  };

  it('retourne 400 si statut invalide', async () => {
    const res = await putInscription(
      req(`/api/admin/inscriptions/${INSCRIPTION_ID}`, {
        method: 'PUT', token: ADMIN_TOKEN, body: { status: 'zombie' },
      }),
      { params: Promise.resolve({ id: INSCRIPTION_ID }) }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('validation_error');
  });

  it('retourne 400 si body vide (aucun champ à mettre à jour)', async () => {
    const res = await putInscription(
      req(`/api/admin/inscriptions/${INSCRIPTION_ID}`, {
        method: 'PUT', token: ADMIN_TOKEN, body: {},
      }),
      { params: Promise.resolve({ id: INSCRIPTION_ID }) }
    );
    expect(res.status).toBe(400);
  });

  it('retourne 200 si EDITOR met à jour le statut en validee', async () => {
    mockUpdateChain({ status: 'validee' });
    const res = await putInscription(
      req(`/api/admin/inscriptions/${INSCRIPTION_ID}`, {
        method: 'PUT', token: EDITOR_TOKEN, body: { status: 'validee' },
      }),
      { params: Promise.resolve({ id: INSCRIPTION_ID }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('validee');
  });
});

// ── Tests — DELETE /api/admin/inscriptions/[id] ──────────────────────────────

describe('DELETE /api/admin/inscriptions/[id]', () => {
  const mockDeleteChain = () => {
    // Soft delete: .update().eq().is()
    mockFrom.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });
  };

  it('retourne 403 si EDITOR (DELETE réservé ADMIN)', async () => {
    const res = await deleteInscription(
      req(`/api/admin/inscriptions/${INSCRIPTION_ID}`, { method: 'DELETE', token: EDITOR_TOKEN }),
      { params: Promise.resolve({ id: INSCRIPTION_ID }) }
    );
    expect(res.status).toBe(403);
  });

  it('retourne 200 si ADMIN supprime', async () => {
    mockDeleteChain();
    const res = await deleteInscription(
      req(`/api/admin/inscriptions/${INSCRIPTION_ID}`, { method: 'DELETE', token: ADMIN_TOKEN }),
      { params: Promise.resolve({ id: INSCRIPTION_ID }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
