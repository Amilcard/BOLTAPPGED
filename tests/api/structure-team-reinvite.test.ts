/** @jest-environment node */
import { POST } from '@/app/api/structure/[code]/team/[memberId]/reinvite/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/structure');
jest.mock('@/lib/supabase-server');
jest.mock('@/lib/email', () => ({
  sendTeamMemberInvite: jest.fn().mockResolvedValue({ sent: true, messageId: 'mock-id' }),
}));
jest.mock('@/lib/rate-limit-structure', () => ({
  structureRateLimitGuard: jest.fn().mockResolvedValue(null),
  getStructureClientIp: jest.fn().mockReturnValue('127.0.0.1'),
}));
jest.mock('@/lib/audit-log', () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));

import { resolveCodeToStructure } from '@/lib/structure';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendTeamMemberInvite } from '@/lib/email';

const mkReq = () => new NextRequest('http://localhost/x', { method: 'POST' });

describe('POST team/[memberId]/reinvite', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 si membre déjà activé', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1', name: 'S' }, role: 'direction', roles: ['direction'], email: 'd@x.fr',
    });
    (getSupabaseAdmin as jest.Mock).mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({
        data: { id: 'm1', email: 'sec@x.fr', role: 'secretariat', activated_at: '2026-04-01T00:00:00Z', prenom: 'Marie' },
      }) }) }) }) }),
    });
    const res = await POST(mkReq(),
      { params: Promise.resolve({ code: 'ABCDEFGHIJ', memberId: '00000000-0000-4000-8000-000000000001' }) });
    expect(res.status).toBe(400);
  });

  test('200 regen token + resend email', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1', name: 'MECS' }, role: 'direction', roles: ['direction'], email: 'd@x.fr',
    });
    const fromMock = jest.fn();
    (getSupabaseAdmin as jest.Mock).mockReturnValue({ from: fromMock });
    fromMock
      .mockReturnValueOnce({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({
        data: { id: 'm1', email: 'sec@x.fr', role: 'secretariat', activated_at: null, prenom: 'Marie' },
      }) }) }) }) })
      .mockReturnValueOnce({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) });
    (sendTeamMemberInvite as jest.Mock).mockResolvedValue({ sent: true, messageId: 'mock-id' });
    const res = await POST(mkReq(),
      { params: Promise.resolve({ code: 'ABCDEFGHIJ', memberId: '00000000-0000-4000-8000-000000000001' }) });
    expect(res.status).toBe(200);
    expect(sendTeamMemberInvite).toHaveBeenCalled();
  });
});
