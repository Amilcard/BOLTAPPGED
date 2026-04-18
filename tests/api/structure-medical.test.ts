/**
 * @jest-environment node
 *
 * Tests unitaires — /api/structure/[code]/medical
 * GET : éducateur voit compteur, CDS/direction voient détail
 * POST : CDS/direction/éducateur peuvent créer
 *
 * Scénarios :
 *  1. Éducateur → 200 + { count: N, detail: null }
 *  2. CDS → 200 + { count: N, detail: [...] }
 *  3. Secrétariat → 403
 *  4. POST éducateur → 201 (autorisé par spec)
 *  5. POST secrétariat → 403
 *  6. POST sans event_type → 400
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake';

const mockInsert = jest.fn();
let mockFromCallCount = 0;
let mockFromOverrides: Record<number, unknown> = {};
const mockFromChain = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  single: jest.fn(),
  insert: mockInsert,
};
const mockFrom = jest.fn(() => {
  const idx = mockFromCallCount++;
  if (mockFromOverrides[idx]) return mockFromOverrides[idx];
  return mockFromChain;
});

jest.mock('@/lib/supabase-server', () => ({
  getSupabase: () => ({ from: mockFrom }),
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));

const mockResolve = jest.fn();
jest.mock('@/lib/structure', () => ({
  resolveCodeToStructure: (...args: unknown[]) => mockResolve(...args),
}));

jest.mock('@/lib/audit-log', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
}));

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/structure/[code]/medical/route';

function makeReq(method: string, body?: Record<string, unknown>): NextRequest {
  const opts: { method: string; headers: Record<string, string>; body?: string } = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  return new NextRequest('http://localhost:3000/api/structure/TESTCODE/medical', opts);
}

const params = Promise.resolve({ code: 'TESTCODE' });
const STRUCTURE = { id: 'struct-1', name: 'MECS Test' };

beforeEach(() => {
  jest.clearAllMocks();
  mockFromCallCount = 0;
  mockFromOverrides = {};
  mockFromChain.select.mockReturnThis();
  mockFromChain.eq.mockReturnThis();
  mockFromChain.in.mockReturnThis();
  mockFromChain.order.mockReturnThis();
});

describe('GET /api/structure/[code]/medical', () => {
  it('1 — éducateur voit compteur uniquement', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'educateur', email: 'educ@test.fr' });
    // Call 1: from('gd_inscriptions').select('id').eq('structure_id').eq('referent_email')
    mockFromOverrides[0] = {
      select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [{ id: 'insc-1' }], error: null }) }) }),
    };
    // Call 2: from('gd_medical_events').select('id', {count, head}).eq('structure_id').in('inscription_id', ids)
    mockFromOverrides[1] = {
      select: () => ({ eq: () => ({ in: () => Promise.resolve({ count: 3, error: null }) }) }),
    };
    const res = await GET(makeReq('GET'), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.detail).toBeNull();
    expect(body.count).toBe(3);
  });

  it('2 — CDS voit détail complet', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'cds', email: 'cds@test.fr' });
    mockFromChain.order.mockResolvedValue({ data: [{ id: 'med-1', event_type: 'consultation' }], error: null });
    const res = await GET(makeReq('GET'), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.detail).not.toBeNull();
  });

  it('3 — secrétariat refusé', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'secretariat', email: 'sec@test.fr' });
    const res = await GET(makeReq('GET'), { params });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/structure/[code]/medical', () => {
  it('4 — éducateur peut créer (spec validée)', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'educateur', email: 'educ@test.fr' });
    // Call 1 (requireInscriptionOwnership) :
    //   from('gd_inscriptions').select('id').eq('id').eq('structure_id').is('deleted_at', null).eq('referent_email', …).maybeSingle()
    //   Le .eq('referent_email', …) est ajouté pour role=educateur|secretariat.
    mockFromOverrides[0] = {
      select: () => ({ eq: () => ({ eq: () => ({ is: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'insc-1' }, error: null }) }) }) }) }) }),
    };
    mockFromOverrides[1] = {
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'med-1' }, error: null }) }) }),
    };
    const res = await POST(makeReq('POST', { inscription_id: 'insc-1', event_type: 'consultation', description: 'Visite médecin camp' }), { params });
    expect(res.status).toBe(201);
  });

  it('5 — secrétariat refusé', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'secretariat', email: 'sec@test.fr' });
    const res = await POST(makeReq('POST', { inscription_id: 'insc-1', event_type: 'consultation', description: 'Test' }), { params });
    expect(res.status).toBe(403);
  });

  it('6 — sans event_type → 400', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'cds', email: 'cds@test.fr' });
    const res = await POST(makeReq('POST', { inscription_id: 'insc-1', description: 'Test sans type' }), { params });
    expect(res.status).toBe(400);
  });
});
