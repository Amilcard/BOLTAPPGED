/** @jest-environment node */
import { POST } from '@/app/api/auth/activate-invitation/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/supabase-server');
jest.mock('@/lib/password');
jest.mock('@/lib/rate-limit', () => ({
  isRateLimited: jest.fn().mockResolvedValue(false),
  getClientIpFromHeaders: jest.fn().mockReturnValue('127.0.0.1'),
}));
jest.mock('@/lib/audit-log', () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));

import { getSupabaseAdmin } from '@/lib/supabase-server';
import { hashPassword, isPasswordStrong } from '@/lib/password';

const mkReq = (body: unknown) =>
  new NextRequest('http://localhost/api/auth/activate-invitation', {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  });

describe('POST /api/auth/activate-invitation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isPasswordStrong as jest.Mock).mockReturnValue({ ok: true });
  });

  test('400 si token manquant', async () => {
    const res = await POST(mkReq({ password: 'abc' }));
    expect(res.status).toBe(400);
  });

  test('400 si password faible', async () => {
    (isPasswordStrong as jest.Mock).mockReturnValue({ ok: false, reason: 'trop court' });
    const res = await POST(mkReq({ token: '00000000-0000-4000-8000-000000000001', password: 'x' }));
    expect(res.status).toBe(400);
  });

  test('404 si token introuvable', async () => {
    (getSupabaseAdmin as jest.Mock).mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }),
    });
    const res = await POST(mkReq({ token: '00000000-0000-4000-8000-000000000001', password: 'Password123!' }));
    expect(res.status).toBe(404);
  });

  test('410 si token expiré', async () => {
    (getSupabaseAdmin as jest.Mock).mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({
        data: {
          id: 'm1', email: 'x@y.fr',
          invitation_expires_at: '2020-01-01T00:00:00Z',
          activated_at: null,
          gd_structures: { status: 'active' },
        },
      }) }) }) }),
    });
    const res = await POST(mkReq({ token: '00000000-0000-4000-8000-000000000001', password: 'Password123!' }));
    expect(res.status).toBe(410);
  });

  test('403 si structure inactive', async () => {
    (getSupabaseAdmin as jest.Mock).mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({
        data: {
          id: 'm1', email: 'x@y.fr', role: 'secretariat',
          invitation_expires_at: new Date(Date.now() + 3600_000).toISOString(),
          activated_at: null, structure_id: 's1',
          gd_structures: { status: 'suspended' },
        },
      }) }) }) }),
    });
    const res = await POST(mkReq({ token: '00000000-0000-4000-8000-000000000001', password: 'Password123!' }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe('STRUCTURE_INACTIVE');
  });

  test('200 activation réussie', async () => {
    const fromMock = jest.fn();
    (getSupabaseAdmin as jest.Mock).mockReturnValue({ from: fromMock });
    fromMock
      .mockReturnValueOnce({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({
        data: {
          id: 'm1', email: 'x@y.fr', role: 'secretariat',
          invitation_expires_at: new Date(Date.now() + 3600_000).toISOString(),
          activated_at: null, structure_id: 's1',
          gd_structures: { status: 'active' },
        },
      }) }) }) })
      .mockReturnValueOnce({ update: () => ({ eq: () => ({ eq: () => ({ select: () => Promise.resolve({ data: [{ id: 'm1' }], error: null }) }) }) }) });
    (hashPassword as jest.Mock).mockResolvedValue('$2a$12$hash');
    const res = await POST(mkReq({ token: '00000000-0000-4000-8000-000000000001', password: 'Password123!', prenom: 'Marie', nom: 'Dupont' }));
    expect(res.status).toBe(200);
  });
});
