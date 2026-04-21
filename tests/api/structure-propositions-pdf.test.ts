/**
 * @jest-environment node
 *
 * Tests unitaires — /api/structure/[code]/propositions/pdf
 *
 * Pattern : iso tests/api/structure-propositions.test.ts (mock chainable Supabase + resolveCodeToStructure).
 *
 * Scénarios couverts :
 *  1. 403 si code structure invalide (resolve retourne null)
 *  2. 400 si id manquant ou non-UUID
 *  3. 404 si proposition inexistante
 *  4. 403 cross-tenant : proposition d'une autre structure → refusée
 *  5. 200 direction : PDF régénéré + auditLog download avec metadata context
 *  6. 200 éducateur : autorisé si inscription liée à son email
 *  7. 403 éducateur : refusé si proposition non liée à son email / ses inscriptions
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake';

// ── Mock Supabase chainable ────────────────────────────────────────────────

type Thenable<T> = Promise<T> & { [k: string]: unknown };

interface MockBuilderState {
  table: string | null;
  filters: Array<{ op: string; args: unknown[] }>;
  responses: Record<string, Array<{ data: unknown; error: unknown; count?: number }>>;
}

const state: MockBuilderState = {
  table: null,
  filters: [],
  responses: {},
};

function resetState() {
  state.table = null;
  state.filters = [];
  state.responses = {};
}

function queueResponse(table: string, response: { data: unknown; error: unknown; count?: number }) {
  if (!state.responses[table]) state.responses[table] = [];
  state.responses[table].push(response);
}

function consumeResponse(table: string): { data: unknown; error: unknown; count?: number } {
  const queue = state.responses[table];
  if (!queue || queue.length === 0) return { data: null, error: null };
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
  builder.or = jest.fn(() => builder);
  builder.order = jest.fn(() => builder);
  builder.range = jest.fn(() => builder);
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

// PDF generation mockée — retourne un Uint8Array vide (content neutre)
const mockGeneratePdf = jest.fn().mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46])); // "%PDF"
jest.mock('@/lib/pdf-proposition', () => ({
  generatePropositionPdf: (...args: unknown[]) => mockGeneratePdf(...args),
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/structure/[code]/propositions/pdf/route';

const VALID_UUID = '11111111-2222-3333-4444-555555555555';
const OTHER_UUID = '99999999-8888-7777-6666-555555555555';

function makeReq(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

const params = Promise.resolve({ code: 'TESTCODE' });
const STRUCTURE = { id: 'struct-1', name: 'MECS Test' };

beforeEach(() => {
  jest.clearAllMocks();
  resetState();
  mockFrom.mockClear();
  mockGeneratePdf.mockClear();
});

describe('GET /api/structure/[code]/propositions/pdf', () => {
  it('1 — retourne 403 si code structure invalide', async () => {
    mockResolve.mockResolvedValue(null);
    const res = await GET(
      makeReq(`http://localhost:3000/api/structure/BADCODE/propositions/pdf?id=${VALID_UUID}`),
      { params }
    );
    expect(res.status).toBe(403);
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it('2a — retourne 400 si id manquant', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'direction', email: 'dir@test.fr' });
    const res = await GET(
      makeReq('http://localhost:3000/api/structure/TESTCODE/propositions/pdf'),
      { params }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_ID');
  });

  it('2b — retourne 400 si id non-UUID', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'direction', email: 'dir@test.fr' });
    const res = await GET(
      makeReq('http://localhost:3000/api/structure/TESTCODE/propositions/pdf?id=not-a-uuid'),
      { params }
    );
    expect(res.status).toBe(400);
  });

  it('3 — retourne 404 si proposition inexistante', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'direction', email: 'dir@test.fr' });
    queueResponse('gd_propositions_tarifaires', { data: null, error: null });

    const res = await GET(
      makeReq(`http://localhost:3000/api/structure/TESTCODE/propositions/pdf?id=${VALID_UUID}`),
      { params }
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it('4 — 403 cross-tenant : proposition liée à une autre structure', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'direction', email: 'dir@test.fr' });

    // proposition existante mais liée à inscription d'une autre structure
    queueResponse('gd_propositions_tarifaires', {
      data: {
        id: VALID_UUID,
        inscription_id: 'insc-other',
        demandeur_email: 'foreign@other.fr',
        enfant_prenom: 'X',
        enfant_nom: 'Y',
        status: 'envoyee',
      },
      error: null,
    });
    // inscription résolue → structure_id différent
    queueResponse('gd_inscriptions', {
      data: { structure_id: 'struct-other', referent_email: 'foreign@other.fr' },
      error: null,
    });
    // fallback demandeur_email : access codes structure courante (ne contient pas l'email foreign)
    queueResponse('gd_structure_access_codes', { data: [{ email: 'staff@test.fr' }], error: null });
    queueResponse('gd_inscriptions', { data: [{ referent_email: 'ownstaff@test.fr' }], error: null });

    const res = await GET(
      makeReq(`http://localhost:3000/api/structure/TESTCODE/propositions/pdf?id=${VALID_UUID}`),
      { params }
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
    expect(mockGeneratePdf).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it('5 — 200 direction : PDF régénéré + auditLog download avec context', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'direction', email: 'dir@test.fr' });

    queueResponse('gd_propositions_tarifaires', {
      data: {
        id: VALID_UUID,
        inscription_id: 'insc-1',
        demandeur_email: 'educ@test.fr',
        enfant_prenom: 'Lea',
        enfant_nom: 'Martin',
        status: 'envoyee',
        sejour_slug: 'aventure',
      },
      error: null,
    });
    queueResponse('gd_inscriptions', {
      data: { structure_id: STRUCTURE.id, referent_email: 'educ@test.fr' },
      error: null,
    });

    const res = await GET(
      makeReq(`http://localhost:3000/api/structure/TESTCODE/propositions/pdf?id=${VALID_UUID}`),
      { params }
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('Proposition_Martin_Lea.pdf');

    expect(mockGeneratePdf).toHaveBeenCalledTimes(1);
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    const call = mockAuditLog.mock.calls[0][1];
    expect(call.action).toBe('download');
    expect(call.resourceType).toBe('proposition');
    expect(call.resourceId).toBe(VALID_UUID);
    expect(call.metadata.context).toBe('structure_proposition_pdf');
    expect(call.metadata.role).toBe('direction');
  });

  it('6 — 200 éducateur : proposition liée à ses inscriptions', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'educateur', email: 'educ@test.fr' });

    queueResponse('gd_propositions_tarifaires', {
      data: {
        id: VALID_UUID,
        inscription_id: 'insc-educ',
        demandeur_email: 'educ@test.fr',
        enfant_prenom: 'Noa',
        enfant_nom: 'Durand',
        status: 'validee',
      },
      error: null,
    });
    queueResponse('gd_inscriptions', {
      data: { structure_id: STRUCTURE.id, referent_email: 'educ@test.fr' },
      error: null,
    });

    const res = await GET(
      makeReq(`http://localhost:3000/api/structure/TESTCODE/propositions/pdf?id=${VALID_UUID}`),
      { params }
    );
    expect(res.status).toBe(200);
    expect(mockGeneratePdf).toHaveBeenCalledTimes(1);
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    expect(mockAuditLog.mock.calls[0][1].metadata.role).toBe('educateur');
  });

  it('7 — 403 éducateur : proposition non liée à son email ni à ses inscriptions', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'educateur', email: 'educ@test.fr' });

    // proposition de la structure mais via un autre éducateur
    queueResponse('gd_propositions_tarifaires', {
      data: {
        id: OTHER_UUID,
        inscription_id: 'insc-other-educ',
        demandeur_email: 'autre@test.fr',
        enfant_prenom: 'X',
        enfant_nom: 'Y',
        status: 'envoyee',
      },
      error: null,
    });
    // inscription liée à un autre educ de la structure
    queueResponse('gd_inscriptions', {
      data: { structure_id: STRUCTURE.id, referent_email: 'autre@test.fr' },
      error: null,
    });

    const res = await GET(
      makeReq(`http://localhost:3000/api/structure/TESTCODE/propositions/pdf?id=${OTHER_UUID}`),
      { params }
    );
    expect(res.status).toBe(403);
    expect(mockGeneratePdf).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
  });
});
