/** @jest-environment node */
import { POST } from '@/app/api/structure/[code]/team/[memberId]/revoke/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/structure');
jest.mock('@/lib/supabase-server');
jest.mock('@/lib/rate-limit-structure', () => ({
  structureRateLimitGuard: jest.fn().mockResolvedValue(null),
  structureRateLimitGuardStrict: jest.fn().mockResolvedValue(null),
  getStructureClientIp: jest.fn().mockReturnValue('127.0.0.1'),
}));
jest.mock('@/lib/audit-log', () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));

import { resolveCodeToStructure } from '@/lib/structure';
import { getSupabaseAdmin } from '@/lib/supabase-server';

const mkReq = () => new NextRequest('http://localhost/x', { method: 'POST' });

describe('POST team/[memberId]/revoke', () => {
  beforeEach(() => jest.clearAllMocks());

  test('403 si pas direction', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1' }, role: 'cds', roles: ['cds'], email: null,
    });
    const res = await POST(mkReq(),
      { params: Promise.resolve({ code: 'ABCDEFGHIJ', memberId: '00000000-0000-4000-8000-000000000001' }) });
    expect(res.status).toBe(403);
  });

  test('404 si member introuvable dans la structure', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1' }, role: 'direction', roles: ['direction'], email: 'd@x.fr',
    });
    (getSupabaseAdmin as jest.Mock).mockReturnValue({
      from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }),
      }),
    });
    const res = await POST(mkReq(),
      { params: Promise.resolve({ code: 'ABCDEFGHIJ', memberId: '00000000-0000-4000-8000-000000000002' }) });
    expect(res.status).toBe(404);
  });

  test('200 révoque le membre', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1' }, role: 'direction', roles: ['direction'], email: 'd@x.fr',
    });
    const fromMock = jest.fn();
    (getSupabaseAdmin as jest.Mock).mockReturnValue({ from: fromMock });
    fromMock
      .mockReturnValueOnce({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'm1', email: 'sec@x.fr', role: 'secretariat', last_jti: 'jti-123', last_jti_exp: '2026-05-01T00:00:00Z' } }) }) }) }) })
      .mockReturnValueOnce({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) })
      .mockReturnValueOnce({ upsert: () => Promise.resolve({ error: null }) });
    const res = await POST(mkReq(),
      { params: Promise.resolve({ code: 'ABCDEFGHIJ', memberId: '00000000-0000-4000-8000-000000000001' }) });
    expect(res.status).toBe(200);
  });

  test('200 révoque membre sans JWT actif (pas de upsert gd_revoked_tokens)', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1' }, role: 'direction', roles: ['direction'], email: 'd@x.fr',
    });
    const fromMock = jest.fn();
    (getSupabaseAdmin as jest.Mock).mockReturnValue({ from: fromMock });
    fromMock
      .mockReturnValueOnce({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'm1', email: 'sec@x.fr', role: 'secretariat', last_jti: null, last_jti_exp: null } }) }) }) }) })
      .mockReturnValueOnce({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) });
    const res = await POST(mkReq(),
      { params: Promise.resolve({ code: 'ABCDEFGHIJ', memberId: '00000000-0000-4000-8000-000000000001' }) });
    expect(res.status).toBe(200);
  });
});
