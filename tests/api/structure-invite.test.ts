/**
 * @jest-environment node
 */
// tests/api/structure-invite.test.ts
import { POST } from '@/app/api/structure/[code]/invite/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/structure');
jest.mock('@/lib/supabase-server');
jest.mock('@/lib/email');
jest.mock('@/lib/rate-limit-structure', () => ({
  structureRateLimitGuard: jest.fn().mockResolvedValue(null),
  getStructureClientIp: jest.fn().mockReturnValue('127.0.0.1'),
}));
jest.mock('@/lib/audit-log', () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));

import { resolveCodeToStructure } from '@/lib/structure';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendTeamMemberInvite } from '@/lib/email';

const makeReq = (code: string, body: unknown) =>
  new NextRequest(`http://localhost/api/structure/${code}/invite`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

describe('POST /api/structure/[code]/invite', () => {
  beforeEach(() => jest.clearAllMocks());

  test('403 si code pas direction', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1', name: 'S' }, role: 'cds', roles: ['cds'], email: null,
    });
    const res = await POST(makeReq('ABCDEFGHIJ', { email: 'x@y.fr', role: 'secretariat' }),
      { params: Promise.resolve({ code: 'ABCDEFGHIJ' }) });
    expect(res.status).toBe(403);
  });

  test('400 si email invalide', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1', name: 'S' }, role: 'direction', roles: ['direction'], email: null,
    });
    const res = await POST(makeReq('ABCDEFGHIJ', { email: 'pas-email', role: 'secretariat' }),
      { params: Promise.resolve({ code: 'ABCDEFGHIJ' }) });
    expect(res.status).toBe(400);
  });

  test('400 si rôle invalide', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1', name: 'S' }, role: 'direction', roles: ['direction'], email: null,
    });
    const res = await POST(makeReq('ABCDEFGHIJ', { email: 'x@y.fr', role: 'admin' }),
      { params: Promise.resolve({ code: 'ABCDEFGHIJ' }) });
    expect(res.status).toBe(400);
  });

  test('409 si email déjà invité', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1', name: 'S' }, role: 'direction', roles: ['direction'], email: null,
    });
    const fromMock = jest.fn();
    (getSupabaseAdmin as jest.Mock).mockReturnValue({ from: fromMock });
    fromMock.mockReturnValue({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'existing' } }) }) }) }),
    });
    const res = await POST(makeReq('ABCDEFGHIJ', { email: 'x@y.fr', role: 'secretariat' }),
      { params: Promise.resolve({ code: 'ABCDEFGHIJ' }) });
    expect(res.status).toBe(409);
  });

  test('201 happy path', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1', name: 'MECS Test' }, role: 'direction', roles: ['direction'], email: 'dir@x.fr',
    });
    const fromMock = jest.fn();
    (getSupabaseAdmin as jest.Mock).mockReturnValue({ from: fromMock });
    fromMock
      .mockReturnValueOnce({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }) })
      .mockReturnValueOnce({ insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'new-id' }, error: null }) }) }) });
    (sendTeamMemberInvite as jest.Mock).mockResolvedValue({ id: 'email-id' });
    const res = await POST(makeReq('ABCDEFGHIJ', { email: 'marie@x.fr', prenom: 'Marie', role: 'secretariat' }),
      { params: Promise.resolve({ code: 'ABCDEFGHIJ' }) });
    expect(res.status).toBe(201);
    expect(sendTeamMemberInvite).toHaveBeenCalled();
  });
});
