/**
 * @jest-environment node
 *
 * Tests unitaires — /api/structure/[code]/calls + /api/structure/[code]/notes
 *
 * Calls :
 *  1. GET éducateur → 200 (lecture)
 *  2. POST éducateur → 403 (pas d'écriture)
 *  3. POST CDS → 201
 *  4. POST type parents sans accord → 400
 *  5. POST type invalide → 400
 *
 * Notes :
 *  6. GET éducateur → 200 (lecture)
 *  7. POST éducateur → 403
 *  8. POST direction → 201
 *  9. POST sans inscription_id → 400
 * 10. POST contenu trop court → 400
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake';

const mockInsert = jest.fn();
const mockFromChain = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  single: jest.fn(),
  insert: mockInsert,
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

jest.mock('@/lib/audit-log', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
}));

import { NextRequest } from 'next/server';
import { GET as getCalls, POST as postCalls } from '@/app/api/structure/[code]/calls/route';
import { GET as getNotes, POST as postNotes } from '@/app/api/structure/[code]/notes/route';

function makeReq(url: string, method: string, body?: Record<string, unknown>): NextRequest {
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  return new NextRequest(url, opts);
}

const callsParams = Promise.resolve({ code: 'TESTCODE' });
const notesParams = Promise.resolve({ code: 'TESTCODE' });
const STRUCTURE = { id: 'struct-1', name: 'MECS Test' };

beforeEach(() => {
  jest.clearAllMocks();
  mockFromChain.select.mockReturnThis();
  mockFromChain.eq.mockReturnThis();
  mockFromChain.order.mockReturnThis();
});

// ── CALLS ──

describe('GET /api/structure/[code]/calls', () => {
  it('1 — éducateur peut lire', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'educateur', email: 'educ@test.fr' });
    mockFromChain.order.mockResolvedValue({ data: [], error: null });
    const res = await getCalls(makeReq('http://localhost:3000/api/structure/TESTCODE/calls', 'GET'), { params: callsParams });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/structure/[code]/calls', () => {
  it('2 — éducateur ne peut pas créer', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'educateur', email: 'educ@test.fr' });
    const res = await postCalls(makeReq('http://localhost:3000/api/structure/TESTCODE/calls', 'POST', {
      call_type: 'ged_colo', direction: 'sortant', interlocuteur: 'M. Martin', resume: 'Appel de suivi quotidien',
    }), { params: callsParams });
    expect(res.status).toBe(403);
  });

  it('3 — CDS peut créer', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'cds', email: 'cds@test.fr' });
    mockInsert.mockReturnValue({ select: () => ({ single: () => Promise.resolve({ data: { id: 'call-1' }, error: null }) }) });
    const res = await postCalls(makeReq('http://localhost:3000/api/structure/TESTCODE/calls', 'POST', {
      call_type: 'ged_colo', direction: 'sortant', interlocuteur: 'M. Martin', resume: 'Appel de suivi quotidien',
    }), { params: callsParams });
    expect(res.status).toBe(201);
  });

  it('4 — type parents sans accord → 400', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'direction', email: 'dir@test.fr' });
    const res = await postCalls(makeReq('http://localhost:3000/api/structure/TESTCODE/calls', 'POST', {
      call_type: 'parents', direction: 'sortant', interlocuteur: 'Mme Dupont', resume: 'Nouvelles de Kevin',
    }), { params: callsParams });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/accord/i);
  });

  it('5 — type invalide → 400', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'cds', email: 'cds@test.fr' });
    const res = await postCalls(makeReq('http://localhost:3000/api/structure/TESTCODE/calls', 'POST', {
      call_type: 'invalid_type', direction: 'sortant', interlocuteur: 'Test', resume: 'Test appel',
    }), { params: callsParams });
    expect(res.status).toBe(400);
  });
});

// ── NOTES ──

describe('GET /api/structure/[code]/notes', () => {
  it('6 — éducateur peut lire', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'educateur', email: 'educ@test.fr' });
    mockFromChain.order.mockResolvedValue({ data: [], error: null });
    const res = await getNotes(makeReq('http://localhost:3000/api/structure/TESTCODE/notes', 'GET'), { params: notesParams });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/structure/[code]/notes', () => {
  it('7 — éducateur ne peut pas créer', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'educateur', email: 'educ@test.fr' });
    const res = await postNotes(makeReq('http://localhost:3000/api/structure/TESTCODE/notes', 'POST', {
      inscription_id: 'insc-1', content: 'Note de test éducateur',
    }), { params: notesParams });
    expect(res.status).toBe(403);
  });

  it('8 — direction peut créer', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'direction', email: 'dir@test.fr' });
    mockFromChain.single.mockResolvedValueOnce({ data: { id: 'insc-1' }, error: null });
    mockInsert.mockReturnValue({ select: () => ({ single: () => Promise.resolve({ data: { id: 'note-1' }, error: null }) }) });
    const res = await postNotes(makeReq('http://localhost:3000/api/structure/TESTCODE/notes', 'POST', {
      inscription_id: 'insc-1', content: 'Mehdi bien intégré depuis mardi',
    }), { params: notesParams });
    expect(res.status).toBe(201);
  });

  it('9 — sans inscription_id → 400', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'cds', email: 'cds@test.fr' });
    const res = await postNotes(makeReq('http://localhost:3000/api/structure/TESTCODE/notes', 'POST', {
      content: 'Note sans enfant',
    }), { params: notesParams });
    expect(res.status).toBe(400);
  });

  it('10 — contenu trop court → 400', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'direction', email: 'dir@test.fr' });
    const res = await postNotes(makeReq('http://localhost:3000/api/structure/TESTCODE/notes', 'POST', {
      inscription_id: 'insc-1', content: 'ab',
    }), { params: notesParams });
    expect(res.status).toBe(400);
  });
});
