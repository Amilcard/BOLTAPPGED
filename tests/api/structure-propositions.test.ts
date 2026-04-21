/**
 * @jest-environment node
 *
 * Tests unitaires — /api/structure/[code]/propositions
 *
 * 1. GET sans code valide → 403
 * 2. GET avec session pro valide → 200 + propositions filtrées
 * 3. GET cross-tenant : ne remonte que les propositions scoped (via OR filter)
 * 4. GET pagination + filtres
 * 5. GET auditLog déclenché systématiquement
 * 6. GET éducateur restreint à ses propres inscriptions + email
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake';

// ── Mocks Supabase : builder chainable qui enregistre la séquence d'appels ──

type Thenable<T> = Promise<T> & { [k: string]: unknown };

interface MockBuilderState {
  table: string | null;
  filters: Array<{ op: string; args: unknown[] }>;
  orderArgs: unknown[] | null;
  rangeArgs: unknown[] | null;
  orArg: string | null;
  // Réponses paramétrables par table (FIFO)
  responses: Record<string, Array<{ data: unknown; error: unknown; count?: number }>>;
}

const state: MockBuilderState = {
  table: null,
  filters: [],
  orderArgs: null,
  rangeArgs: null,
  orArg: null,
  responses: {},
};

function resetState() {
  state.table = null;
  state.filters = [];
  state.orderArgs = null;
  state.rangeArgs = null;
  state.orArg = null;
  state.responses = {};
}

function queueResponse(table: string, response: { data: unknown; error: unknown; count?: number }) {
  if (!state.responses[table]) state.responses[table] = [];
  state.responses[table].push(response);
}

function consumeResponse(table: string): { data: unknown; error: unknown; count?: number } {
  const queue = state.responses[table];
  if (!queue || queue.length === 0) {
    return { data: null, error: null };
  }
  return queue.shift() as { data: unknown; error: unknown; count?: number };
}

function makeBuilder(table: string): Thenable<unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {};
  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn((col: string, val: unknown) => {
    state.filters.push({ op: 'eq', args: [col, val] });
    return builder;
  });
  builder.gte = jest.fn(() => builder);
  builder.in = jest.fn(() => builder);
  builder.is = jest.fn(() => builder);
  builder.or = jest.fn((expr: string) => {
    state.orArg = expr;
    return builder;
  });
  builder.order = jest.fn((...args: unknown[]) => {
    state.orderArgs = args;
    return builder;
  });
  builder.range = jest.fn((...args: unknown[]) => {
    state.rangeArgs = args;
    return builder;
  });
  builder.single = jest.fn(() => Promise.resolve(consumeResponse(table)));
  builder.maybeSingle = jest.fn(() => Promise.resolve(consumeResponse(table)));
  builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(consumeResponse(table)).then(onFulfilled, onRejected);
  return builder as Thenable<unknown>;
}

const mockFrom = jest.fn((table: string) => {
  state.table = table;
  return makeBuilder(table);
});

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
  getClientIp: () => undefined,
}));

jest.mock('@/lib/rate-limit-structure', () => ({
  structureRateLimitGuard: jest.fn().mockResolvedValue(null),
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/structure/[code]/propositions/route';

function makeReq(url = 'http://localhost:3000/api/structure/TESTCODE/propositions'): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

const params = Promise.resolve({ code: 'TESTCODE' });
const STRUCTURE = { id: 'struct-1', name: 'MECS Test' };
const OTHER_STRUCTURE = { id: 'struct-2', name: 'Other' };

beforeEach(() => {
  jest.clearAllMocks();
  resetState();
  mockFrom.mockClear();
});

describe('GET /api/structure/[code]/propositions', () => {
  it('1 — retourne 403 si code invalide', async () => {
    mockResolve.mockResolvedValue(null);
    const res = await GET(makeReq(), { params });
    expect(res.status).toBe(403);
  });

  it('2 — direction autorisée : retourne propositions + 200', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'direction', email: 'dir@test.fr' });

    // inscriptions de la structure
    queueResponse('gd_inscriptions', { data: [{ id: 'insc-1', referent_email: 'educ@test.fr' }], error: null });
    // access codes emails
    queueResponse('gd_structure_access_codes', { data: [{ email: 'cds@test.fr' }], error: null });
    // propositions query finale
    queueResponse('gd_propositions_tarifaires', {
      data: [
        {
          id: 'prop-1',
          sejour_slug: 'aventure-ete',
          sejour_titre: 'Aventure Été',
          enfant_prenom: 'Léa',
          enfant_nom: 'Martin',
          session_start: '2026-07-01',
          session_end: '2026-07-08',
          ville_depart: 'Lyon',
          prix_total: 890,
          prix_sejour: 700,
          prix_transport: 60,
          prix_encadrement: 130,
          encadrement: true,
          status: 'envoyee',
          pdf_storage_path: null,
          demandeur_email: 'educ@test.fr',
          inscription_id: 'insc-1',
          created_at: '2026-04-18T10:00:00Z',
          updated_at: '2026-04-19T11:00:00Z',
          validated_at: null,
        },
      ],
      error: null,
      count: 1,
    });

    const res = await GET(makeReq(), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.propositions).toHaveLength(1);
    expect(body.propositions[0].enfant_prenom).toBe('Léa');
    expect(body.propositions[0].enfant_nom_initiale).toBe('M.');
    expect(body.total).toBe(1);
  });

  it('3 — scope cross-tenant : filtre OR contient bien structure_id courante', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'cds', email: 'cds@test.fr' });

    queueResponse('gd_inscriptions', { data: [{ id: 'insc-own', referent_email: 'r@test.fr' }], error: null });
    queueResponse('gd_structure_access_codes', { data: [], error: null });
    queueResponse('gd_propositions_tarifaires', { data: [], error: null, count: 0 });

    const res = await GET(makeReq(), { params });
    expect(res.status).toBe(200);

    // Le filtre OR doit citer insc-own, pas d'autre structure
    expect(state.orArg).toContain('insc-own');
    expect(state.orArg).not.toContain('insc-other');
  });

  it('4 — pagination + filtre status propagés en query', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'direction', email: 'dir@test.fr' });
    queueResponse('gd_inscriptions', { data: [{ id: 'i1', referent_email: 'r@test.fr' }], error: null });
    queueResponse('gd_structure_access_codes', { data: [], error: null });
    queueResponse('gd_propositions_tarifaires', { data: [], error: null, count: 0 });

    const res = await GET(
      makeReq('http://localhost:3000/api/structure/TESTCODE/propositions?page=2&limit=20&status=envoyee&since=30'),
      { params }
    );
    expect(res.status).toBe(200);
    expect(state.rangeArgs).toEqual([20, 39]); // page 2, limit 20
  });

  it('5 — auditLog déclenché systématiquement', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'direction', email: 'dir@test.fr' });
    queueResponse('gd_inscriptions', { data: [], error: null });
    queueResponse('gd_structure_access_codes', { data: [], error: null });

    const res = await GET(makeReq(), { params });
    expect(res.status).toBe(200);
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    const call = mockAuditLog.mock.calls[0][1];
    expect(call.action).toBe('read');
    expect(call.resourceType).toBe('proposition');
    expect(call.resourceId).toBe(STRUCTURE.id);
  });

  it('6 — éducateur : scope limité à son email + ses inscriptions', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'educateur', email: 'educ@test.fr' });

    queueResponse('gd_inscriptions', { data: [{ id: 'insc-educ', referent_email: 'educ@test.fr' }], error: null });
    queueResponse('gd_propositions_tarifaires', { data: [], error: null, count: 0 });

    const res = await GET(makeReq(), { params });
    expect(res.status).toBe(200);
    // pas d'appel à access_codes pour educ (scope restreint)
    const accessCodesCalls = mockFrom.mock.calls.filter((c) => c[0] === 'gd_structure_access_codes');
    expect(accessCodesCalls).toHaveLength(0);
    // filtre OR ne contient que l'email educ@test.fr + insc-educ
    expect(state.orArg).toContain('insc-educ');
    expect(state.orArg).toContain('educ@test.fr');
  });

  it('7 — pas d\'inscriptions ni email : renvoie liste vide + auditLog empty=true', async () => {
    mockResolve.mockResolvedValue({ structure: OTHER_STRUCTURE, role: 'direction', email: 'dir@other.fr' });
    queueResponse('gd_inscriptions', { data: [], error: null });
    queueResponse('gd_structure_access_codes', { data: [], error: null });

    const res = await GET(makeReq(), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.propositions).toEqual([]);
    expect(body.total).toBe(0);
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    expect(mockAuditLog.mock.calls[0][1].metadata.empty).toBe(true);
  });
});
