/**
 * @jest-environment node
 *
 * Tests unitaires — PATCH /api/suivi/[token]/structure
 *
 * Rattachement a posteriori d'une inscription à une structure via code.
 *
 * Scénarios couverts :
 *  1. Token invalide (pas UUID) → 400
 *  2. Body manquant (pas d'inscriptionId ou structureCode) → 400
 *  3. Code structure format invalide (3 chars) → 400
 *  4. Token inexistant en BDD → 404
 *  5. Inscription n'appartient pas au même référent → 403
 *  6. Inscription déjà rattachée → 409
 *  7. Code structure inexistant → 404
 *  8. Rattachement OK → 200 + infos structure
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

import { PATCH } from '@/app/api/suivi/[token]/structure/route';
import { NextRequest } from 'next/server';

// ── Helpers ──────────────────────────────────────────────────────────────────

const VALID_TOKEN = '11111111-2222-3333-4444-555555555555';
const VALID_INSCRIPTION_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const VALID_CODE = 'ABC123';

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost:3000/api/suivi/${VALID_TOKEN}/structure`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Helper to mock chained .select().eq().single() responses
function mockSelectChain(...responses: Array<{ data: unknown; error: unknown }>) {
  // Each call to mockFrom().select() returns a chain
  // We need to handle multiple sequential calls
  let callIndex = 0;
  mockSelect.mockImplementation(() => ({
    eq: jest.fn().mockImplementation(() => ({
      eq: jest.fn().mockImplementation(() => ({
        single: jest.fn().mockImplementation(() => {
          const resp = responses[callIndex] || responses[responses.length - 1];
          callIndex++;
          return Promise.resolve(resp);
        }),
      })),
      single: jest.fn().mockImplementation(() => {
        const resp = responses[callIndex] || responses[responses.length - 1];
        callIndex++;
        return Promise.resolve(resp);
      }),
    })),
  }));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PATCH /api/suivi/[token]/structure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renvoie 400 si token invalide', async () => {
    const req = new NextRequest('http://localhost:3000/api/suivi/bad-token/structure', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inscriptionId: VALID_INSCRIPTION_ID, structureCode: VALID_CODE }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ token: 'bad-token' }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('INVALID_TOKEN');
  });

  it('renvoie 400 si body incomplet', async () => {
    const req = makeRequest({ inscriptionId: VALID_INSCRIPTION_ID });
    const res = await PATCH(req, { params: Promise.resolve({ token: VALID_TOKEN }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('MISSING_PARAMS');
  });

  it('renvoie 400 si code structure trop court', async () => {
    const req = makeRequest({ inscriptionId: VALID_INSCRIPTION_ID, structureCode: 'AB' });
    const res = await PATCH(req, { params: Promise.resolve({ token: VALID_TOKEN }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('INVALID_CODE');
  });

  it('renvoie 404 si token inexistant en BDD', async () => {
    mockSelectChain({ data: null, error: { message: 'not found' } });
    const req = makeRequest({ inscriptionId: VALID_INSCRIPTION_ID, structureCode: VALID_CODE });
    const res = await PATCH(req, { params: Promise.resolve({ token: VALID_TOKEN }) });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe('NOT_FOUND');
  });

  it('renvoie 403 si inscription appartient à un autre référent', async () => {
    mockSelectChain(
      { data: { referent_email: 'marie@structure.fr' }, error: null },
      { data: { referent_email: 'autre@structure.fr', structure_id: null }, error: null }
    );
    const req = makeRequest({ inscriptionId: VALID_INSCRIPTION_ID, structureCode: VALID_CODE });
    const res = await PATCH(req, { params: Promise.resolve({ token: VALID_TOKEN }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe('FORBIDDEN');
  });

  it('renvoie 409 si inscription déjà rattachée', async () => {
    mockSelectChain(
      { data: { referent_email: 'marie@structure.fr' }, error: null },
      { data: { referent_email: 'marie@structure.fr', structure_id: 'existing-struct' }, error: null }
    );
    const req = makeRequest({ inscriptionId: VALID_INSCRIPTION_ID, structureCode: VALID_CODE });
    const res = await PATCH(req, { params: Promise.resolve({ token: VALID_TOKEN }) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe('ALREADY_LINKED');
  });

  it('renvoie 404 si code structure inexistant', async () => {
    mockSelectChain(
      { data: { referent_email: 'marie@structure.fr' }, error: null },
      { data: { referent_email: 'marie@structure.fr', structure_id: null }, error: null },
      { data: null, error: { message: 'not found' } }
    );
    const req = makeRequest({ inscriptionId: VALID_INSCRIPTION_ID, structureCode: 'ZZZ999' });
    const res = await PATCH(req, { params: Promise.resolve({ token: VALID_TOKEN }) });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe('STRUCTURE_NOT_FOUND');
  });

  it('renvoie 200 + infos structure si rattachement OK', async () => {
    mockSelectChain(
      { data: { referent_email: 'marie@structure.fr' }, error: null },
      { data: { referent_email: 'marie@structure.fr', structure_id: null }, error: null },
      { data: { id: 'struct-uuid', name: 'Croix-Rouge', city: 'Le Havre', postal_code: '76600', type: 'association' }, error: null }
    );
    mockUpdate.mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    const req = makeRequest({ inscriptionId: VALID_INSCRIPTION_ID, structureCode: VALID_CODE });
    const res = await PATCH(req, { params: Promise.resolve({ token: VALID_TOKEN }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.structure.id).toBe('struct-uuid');
    expect(json.structure.name).toBe('Croix-Rouge');
    expect(json.structure.city).toBe('Le Havre');
    expect(json.structure.type).toBe('association');
  });
});
