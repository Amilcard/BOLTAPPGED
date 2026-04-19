/**
 * @jest-environment node
 *
 * Tests unitaires — routes PDF staff
 *  - GET  /api/structure/[code]/inscriptions/[id]/pdf
 *  - POST /api/structure/[code]/inscriptions/[id]/pdf-email
 *
 * Scénarios :
 *  P1. staff GET pdf → 200 stream + auditLog staff_download_pdf
 *  P2. éducateur → 403
 *  P3. type invalide → 400
 *  P4. suivi_token manquant → 404
 *  P5. internal fetch timeout → 504
 *  E1. staff POST pdf-email → passthrough + auditLog staff_email_pdf
 *  E2. éducateur POST pdf-email → 403
 *  E3. UUID invalide → 400
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake';
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-key!';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

const mockFromChain = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn(),
  single: jest.fn(),
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
  getClientIp: () => '1.2.3.4',
}));

jest.mock('@/lib/rate-limit-structure', () => ({
  structureRateLimitGuard: jest.fn().mockResolvedValue(null),
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/structure/[code]/inscriptions/[id]/pdf/route';
import { POST as pdfEmailPOST } from '@/app/api/structure/[code]/inscriptions/[id]/pdf-email/route';

const STRUCTURE = { id: 'struct-1', name: 'MECS Test' };
const VALID_UUID = '11111111-2222-3333-4444-555555555555';

function getReq(type = 'bulletin'): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/structure/CODE/inscriptions/x/pdf?type=${type}`,
    { method: 'GET' },
  );
}

function postEmailReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/structure/CODE/inscriptions/x/pdf-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function params(id = VALID_UUID) {
  return Promise.resolve({ code: 'CODE1234AB', id });
}

// Mock global fetch — internal fetch vers route référent
let mockFetch: jest.Mock;

beforeEach(() => {
  jest.resetAllMocks();
  mockFrom.mockImplementation(() => mockFromChain);
  mockFromChain.select.mockReturnThis();
  mockFromChain.eq.mockReturnThis();
  mockFromChain.is.mockReturnThis();
  mockAuditLog.mockResolvedValue(undefined);
  const rl = jest.requireMock('@/lib/rate-limit-structure') as { structureRateLimitGuard: jest.Mock };
  rl.structureRateLimitGuard.mockResolvedValue(null);

  mockFetch = jest.fn();
  global.fetch = mockFetch as unknown as typeof fetch;
});

describe('GET /api/structure/[code]/inscriptions/[id]/pdf', () => {
  it('P1 — staff download pdf → 200 + auditLog', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'secretariat', email: 'sec@test.fr' });
    mockFromChain.maybeSingle.mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null });
    mockFromChain.single.mockResolvedValueOnce({
      data: { suivi_token: 'tok-123', jeune_prenom: 'X', jeune_nom: 'Y' },
      error: null,
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(42),
    } as unknown as Response);

    const res = await GET(getReq('bulletin'), { params: params() });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'download',
        metadata: expect.objectContaining({
          context: 'staff_download_pdf',
          actor_role: 'secretariat',
        }),
      }),
    );
  });

  it('P2 — éducateur refusé (403)', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'educateur', email: 'educ@test.fr' });
    const res = await GET(getReq(), { params: params() });
    expect(res.status).toBe(403);
  });

  it('P3 — type invalide → 400', async () => {
    const res = await GET(getReq('invalid'), { params: params() });
    expect(res.status).toBe(400);
  });

  it('P4 — suivi_token manquant → 404', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'direction', email: 'dir@test.fr' });
    mockFromChain.maybeSingle.mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null });
    mockFromChain.single.mockResolvedValueOnce({
      data: { suivi_token: null, jeune_prenom: 'X', jeune_nom: 'Y' },
      error: null,
    });
    const res = await GET(getReq('bulletin'), { params: params() });
    expect(res.status).toBe(404);
  });

  it('P5 — internal fetch timeout → 504', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'cds', email: 'cds@test.fr' });
    mockFromChain.maybeSingle.mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null });
    mockFromChain.single.mockResolvedValueOnce({
      data: { suivi_token: 'tok-123', jeune_prenom: 'X', jeune_nom: 'Y' },
      error: null,
    });
    mockFetch.mockRejectedValueOnce(new Error('AbortError'));

    const res = await GET(getReq('bulletin'), { params: params() });
    expect(res.status).toBe(504);
  });
});

describe('POST /api/structure/[code]/inscriptions/[id]/pdf-email', () => {
  it('E1 — staff email pdf → passthrough + auditLog', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'direction', email: 'dir@test.fr' });
    mockFromChain.maybeSingle.mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null });
    mockFromChain.single.mockResolvedValueOnce({
      data: { suivi_token: 'tok-999' },
      error: null,
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, sentTo: 'ref@test.fr' }),
    } as unknown as Response);

    const res = await pdfEmailPOST(postEmailReq({ type: 'sanitaire' }), { params: params() });
    expect(res.status).toBe(200);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: expect.objectContaining({
          context: 'staff_email_pdf',
          channel: 'email',
        }),
      }),
    );
  });

  it('E2 — éducateur refusé (403)', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'educateur', email: 'e@test.fr' });
    const res = await pdfEmailPOST(postEmailReq({ type: 'bulletin' }), { params: params() });
    expect(res.status).toBe(403);
  });

  it('E3 — UUID invalide → 400', async () => {
    const res = await pdfEmailPOST(postEmailReq({ type: 'bulletin' }), { params: params('bad') });
    expect(res.status).toBe(400);
  });
});
