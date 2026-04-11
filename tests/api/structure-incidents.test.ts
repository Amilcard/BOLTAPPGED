/**
 * @jest-environment node
 *
 * Tests unitaires — /api/structure/[code]/incidents
 * GET : liste incidents (tous rôles sauf secrétariat)
 * POST : créer incident (direction/cds/cds_delegated)
 * PATCH : changer statut (direction/cds/cds_delegated)
 *
 * Scénarios :
 *  1. GET sans code valide → 403
 *  2. GET éducateur → 200 (lecture autorisée)
 *  3. GET secrétariat → 403
 *  4. POST éducateur → 403 (pas d'écriture)
 *  5. POST direction → 201
 *  6. POST sans inscription_id → 400
 *  7. POST catégorie invalide → 400
 *  8. POST description trop courte → 400
 *  9. PATCH statut resolu → 200
 * 10. PATCH statut invalide → 400
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake';

const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockFromChain = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  single: jest.fn(),
  is: jest.fn().mockReturnThis(),
  insert: mockInsert,
  update: mockUpdate,
};
const mockFrom = jest.fn(() => mockFromChain);

jest.mock('@/lib/supabase-server', () => ({
  getSupabase: () => ({ from: mockFrom }),
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));

const mockResolve = jest.fn();
jest.mock('@/lib/structure', () => ({
  resolveCodeToStructure: (...args: unknown[]) => mockResolve(...args),
}));

const mockAuditLog = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/audit-log', () => ({
  auditLog: (...args: unknown[]) => mockAuditLog(...args),
}));

jest.mock('@/lib/email', () => ({
  sendIncidentNotification: jest.fn().mockResolvedValue(undefined),
}));

import { NextRequest } from 'next/server';
import { GET, POST, PATCH } from '@/app/api/structure/[code]/incidents/route';

function makeReq(method: string, body?: Record<string, unknown>): NextRequest {
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  return new NextRequest('http://localhost:3000/api/structure/TESTCODE/incidents', opts);
}

const params = Promise.resolve({ code: 'TESTCODE' });

const STRUCTURE = { id: 'struct-1', name: 'MECS Test' };

beforeEach(() => {
  jest.clearAllMocks();
  mockFromChain.select.mockReturnThis();
  mockFromChain.eq.mockReturnThis();
  mockFromChain.order.mockReturnThis();
  mockFromChain.is.mockReturnThis();
});

describe('GET /api/structure/[code]/incidents', () => {
  it('1 — retourne 403 si code invalide', async () => {
    mockResolve.mockResolvedValue(null);
    const res = await GET(makeReq('GET'), { params });
    expect(res.status).toBe(403);
  });

  it('2 — éducateur peut lire', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'educateur', email: 'educ@test.fr' });
    mockFromChain.order.mockResolvedValue({ data: [], error: null });
    const res = await GET(makeReq('GET'), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.incidents).toEqual([]);
  });

  it('3 — secrétariat refusé', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'secretariat', email: 'sec@test.fr' });
    const res = await GET(makeReq('GET'), { params });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/structure/[code]/incidents', () => {
  it('4 — éducateur ne peut pas créer', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'educateur', email: 'educ@test.fr' });
    const res = await POST(makeReq('POST', { inscription_id: 'insc-1', category: 'accident', severity: 'info', description: 'Test incident' }), { params });
    expect(res.status).toBe(403);
  });

  it('5 — direction peut créer', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'direction', email: 'dir@test.fr' });
    mockFromChain.single.mockResolvedValueOnce({ data: { id: 'insc-1' }, error: null }); // ownership check
    mockInsert.mockReturnValue({ select: () => ({ single: () => Promise.resolve({ data: { id: 'inc-1' }, error: null }) }) });
    // Mock for email notification query
    mockFromChain.single.mockResolvedValueOnce({ data: { jeune_prenom: 'Mehdi' }, error: null });
    const res = await POST(makeReq('POST', { inscription_id: 'insc-1', category: 'accident', severity: 'info', description: 'Chute dans la cour' }), { params });
    expect(res.status).toBe(201);
  });

  it('6 — sans inscription_id → 400', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'cds', email: 'cds@test.fr' });
    const res = await POST(makeReq('POST', { category: 'accident', severity: 'info', description: 'Test' }), { params });
    expect(res.status).toBe(400);
  });

  it('7 — catégorie invalide → 400', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'cds', email: 'cds@test.fr' });
    const res = await POST(makeReq('POST', { inscription_id: 'insc-1', category: 'invalid', severity: 'info', description: 'Test incident' }), { params });
    expect(res.status).toBe(400);
  });

  it('8 — description trop courte → 400', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'cds', email: 'cds@test.fr' });
    const res = await POST(makeReq('POST', { inscription_id: 'insc-1', category: 'accident', severity: 'info', description: 'ab' }), { params });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/structure/[code]/incidents', () => {
  it('9 — changer statut resolu → 200', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'direction', email: 'dir@test.fr' });
    mockUpdate.mockReturnValue({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) });
    const res = await PATCH(makeReq('PATCH', { incident_id: 'inc-1', status: 'resolu' }), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('resolu');
  });

  it('10 — statut invalide → 400', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'cds', email: 'cds@test.fr' });
    const res = await PATCH(makeReq('PATCH', { incident_id: 'inc-1', status: 'invalid' }), { params });
    expect(res.status).toBe(400);
  });
});
