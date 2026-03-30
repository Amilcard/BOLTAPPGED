/**
 * @jest-environment node
 *
 * Tests unitaires — Routes structure
 *
 * GET /api/structures/search?cp=XXXXX
 *   1. CP manquant → 400
 *   2. CP invalide (3 chiffres) → 400
 *   3. CP valide, aucune structure → []
 *   4. CP valide, structures trouvées → nom + city + type + email masqué
 *
 * GET /api/structures/verify/[code]
 *   5. Code trop court → { valid: false }
 *   6. Code valide, structure trouvée → { valid: true, ... }
 *   7. Code valide, structure inexistante → { valid: false }
 */

// ── Env ──────────────────────────────────────────────────────────────────────
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-key';
process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockFrom = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  getSupabase: () => ({ from: mockFrom }),
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));

import { GET as searchGET } from '@/app/api/structures/search/route';
import { GET as verifyGET } from '@/app/api/structures/verify/[code]/route';
import { NextRequest } from 'next/server';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSearchRequest(cp?: string): NextRequest {
  const url = cp
    ? `http://localhost:3000/api/structures/search?cp=${cp}`
    : 'http://localhost:3000/api/structures/search';
  return new NextRequest(url);
}

function makeVerifyRequest(code: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/structures/verify/${code}`);
}

function buildChain(result: { data?: unknown; error?: unknown }) {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue(result),
          single: jest.fn().mockResolvedValue(result),
        }),
      }),
    }),
  };
}

// ── Tests search ─────────────────────────────────────────────────────────────

describe('GET /api/structures/search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renvoie 400 si CP manquant', async () => {
    const res = await searchGET(makeSearchRequest());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Code postal invalide/);
  });

  it('renvoie 400 si CP invalide (3 chiffres)', async () => {
    const res = await searchGET(makeSearchRequest('123'));
    expect(res.status).toBe(400);
  });

  it('renvoie tableau vide si aucune structure', async () => {
    mockFrom.mockReturnValue(buildChain({ data: [], error: null }));
    const res = await searchGET(makeSearchRequest('76600'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.structures).toEqual([]);
  });

  it('renvoie structures avec email masqué', async () => {
    mockFrom.mockReturnValue(
      buildChain({
        data: [
          { name: 'Croix-Rouge Le Havre', city: 'Le Havre', type: 'association', email: 'marie@croix-rouge.fr' },
          { name: 'CCAS Le Havre', city: 'Le Havre', type: 'ccas', email: 'contact@lehavre.fr' },
        ],
        error: null,
      })
    );

    const res = await searchGET(makeSearchRequest('76600'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.structures).toHaveLength(2);
    expect(json.structures[0].name).toBe('Croix-Rouge Le Havre');
    expect(json.structures[0].contactHint).toBe('m****@croix-rouge.fr');
    // Pas de code ni d'id exposé
    expect(json.structures[0].code).toBeUndefined();
    expect(json.structures[0].id).toBeUndefined();
  });
});

// ── Tests verify ─────────────────────────────────────────────────────────────

describe('GET /api/structures/verify/[code]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renvoie valid:false si code trop court', async () => {
    const res = await verifyGET(makeVerifyRequest('AB'), {
      params: Promise.resolve({ code: 'AB' }),
    });
    const json = await res.json();
    expect(json.valid).toBe(false);
    expect(json.error).toMatch(/Format invalide/);
  });

  it('renvoie valid:true + infos si code valide', async () => {
    mockFrom.mockReturnValue(
      buildChain({
        data: {
          id: 'struct-uuid-1',
          name: 'Croix-Rouge Le Havre',
          city: 'Le Havre',
          postal_code: '76600',
          type: 'association',
          address: '12 rue Gambetta',
        },
        error: null,
      })
    );

    const res = await verifyGET(makeVerifyRequest('ABC123'), {
      params: Promise.resolve({ code: 'ABC123' }),
    });
    const json = await res.json();
    expect(json.valid).toBe(true);
    expect(json.structureId).toBe('struct-uuid-1');
    expect(json.name).toBe('Croix-Rouge Le Havre');
    expect(json.city).toBe('Le Havre');
    expect(json.postalCode).toBe('76600');
    expect(json.type).toBe('association');
    expect(json.address).toBe('12 rue Gambetta');
  });

  it('renvoie valid:false si code inexistant', async () => {
    mockFrom.mockReturnValue(
      buildChain({ data: null, error: { message: 'not found' } })
    );

    const res = await verifyGET(makeVerifyRequest('ZZZ999'), {
      params: Promise.resolve({ code: 'ZZZ999' }),
    });
    const json = await res.json();
    expect(json.valid).toBe(false);
  });
});
