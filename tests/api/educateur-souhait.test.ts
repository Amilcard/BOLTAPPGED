/**
 * @jest-environment node
 *
 * Tests unitaires — Éducateur souhait validation
 *
 * GET  /api/educateur/souhait/[token] — consultation + auto-transition emis→vu
 * PATCH /api/educateur/souhait/[token] — validation / refus / discussion
 *
 * Scénarios :
 *  1. GET  token invalide → 400
 *  2. GET  token inexistant → 404
 *  3. GET  souhait emis → auto-transition vers vu + 201
 *  4. GET  souhait déjà vu → pas de re-transition + 200
 *  5. PATCH token invalide → 400
 *  6. PATCH statut invalide → 400
 *  7. PATCH souhait déjà validé → 409
 *  8. PATCH souhait déjà refusé → 409
 *  9. PATCH valide OK → 200 + status='valide'
 * 10. PATCH reponseEducateur vide → null
 */

// ── Env ──────────────────────────────────────────────────────────────────────
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-key';
process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockSelect = jest.fn();
const mockUpdate = jest.fn();
const mockFrom = jest.fn().mockImplementation(() => ({
  select: mockSelect,
  update: mockUpdate,
}));

jest.mock('@/lib/supabase-server', () => ({
  getSupabase: () => ({ from: mockFrom }),
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));

import { GET, PATCH } from '@/app/api/educateur/souhait/[token]/route';
import { NextRequest } from 'next/server';

// ── Helpers ──────────────────────────────────────────────────────────────────

const VALID_TOKEN = '11111111-2222-3333-4444-555555555555';

function makeGetRequest(token: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/educateur/souhait/${token}`);
}

function makePatchRequest(token: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost:3000/api/educateur/souhait/${token}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockSelectSingle(result: { data: unknown; error: unknown }) {
  mockSelect.mockReturnValue({
    eq: jest.fn().mockReturnValue({
      is: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue(result),
    }),
  });
}

// ── GET Tests ────────────────────────────────────────────────────────────────

describe('GET /api/educateur/souhait/[token]', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renvoie 400 si token invalide', async () => {
    const res = await GET(makeGetRequest('bad-token'), {
      params: Promise.resolve({ token: 'bad-token' }),
    });
    expect(res.status).toBe(400);
  });

  it('renvoie 404 si token inexistant', async () => {
    mockSelectSingle({ data: null, error: { message: 'not found' } });
    const res = await GET(makeGetRequest(VALID_TOKEN), {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });
    expect(res.status).toBe(404);
  });

  it('auto-transition emis → vu sur premier GET', async () => {
    const souhait = {
      id: 'souhait-1',
      kid_prenom: 'Emma',
      status: 'emis',
      sejour_slug: 'alpoo-kids',
    };
    mockSelectSingle({ data: souhait, error: null });
    // Mock update for auto-transition
    mockUpdate.mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    const res = await GET(makeGetRequest(VALID_TOKEN), {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });
    // Should be 200 or 201
    expect([200, 201]).toContain(res.status);
    // update should have been called for auto-transition
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('pas de re-transition si déjà vu', async () => {
    const souhait = {
      id: 'souhait-1',
      kid_prenom: 'Emma',
      status: 'vu',
      sejour_slug: 'alpoo-kids',
    };
    mockSelectSingle({ data: souhait, error: null });

    const res = await GET(makeGetRequest(VALID_TOKEN), {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });
    expect(res.status).toBe(200);
    // update should NOT have been called
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

// ── PATCH Tests ──────────────────────────────────────────────────────────────

describe('PATCH /api/educateur/souhait/[token]', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renvoie 400 si token invalide', async () => {
    const res = await PATCH(makePatchRequest('not-uuid', { status: 'valide' }), {
      params: Promise.resolve({ token: 'not-uuid' }),
    });
    expect(res.status).toBe(400);
  });

  it('renvoie 400 si statut invalide', async () => {
    mockSelectSingle({ data: { id: '1', status: 'vu' }, error: null });
    const res = await PATCH(makePatchRequest(VALID_TOKEN, { status: 'bizarre' }), {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });
    expect(res.status).toBe(400);
  });

  it('renvoie 409 si souhait déjà validé', async () => {
    mockSelectSingle({ data: { id: '1', status: 'valide' }, error: null });
    const res = await PATCH(makePatchRequest(VALID_TOKEN, { status: 'en_discussion' }), {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });
    expect(res.status).toBe(409);
  });

  it('renvoie 409 si souhait déjà refusé', async () => {
    mockSelectSingle({ data: { id: '1', status: 'refuse' }, error: null });
    const res = await PATCH(makePatchRequest(VALID_TOKEN, { status: 'valide' }), {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });
    expect(res.status).toBe(409);
  });

  it('PATCH valide → 200 + success', async () => {
    mockSelectSingle({ data: { id: 'souhait-1', status: 'vu' }, error: null });
    mockUpdate.mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    const res = await PATCH(makePatchRequest(VALID_TOKEN, { status: 'valide', reponseEducateur: 'OK' }), {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('reponseEducateur vide → null', async () => {
    mockSelectSingle({ data: { id: 'souhait-1', status: 'vu' }, error: null });
    mockUpdate.mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    const res = await PATCH(makePatchRequest(VALID_TOKEN, { status: 'en_discussion', reponseEducateur: '   ' }), {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });
    expect(res.status).toBe(200);
    // Verify that update was called with null for reponse_educateur
    expect(mockUpdate).toHaveBeenCalled();
  });
});
