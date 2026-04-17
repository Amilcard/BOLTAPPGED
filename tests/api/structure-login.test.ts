/** @jest-environment node */
import { POST } from '@/app/api/auth/structure-login/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/supabase-server');
jest.mock('@/lib/password');
jest.mock('@/lib/rate-limit', () => ({
  isRateLimited: jest.fn().mockResolvedValue(false),
  getClientIpFromHeaders: jest.fn().mockReturnValue('127.0.0.1'),
}));
jest.mock('@/lib/audit-log', () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));

import { getSupabaseAdmin } from '@/lib/supabase-server';
import { verifyPassword } from '@/lib/password';

const mkReq = (body: unknown) =>
  new NextRequest('http://localhost/api/auth/structure-login', {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  });

describe('POST /api/auth/structure-login', () => {
  beforeAll(() => { process.env.NEXTAUTH_SECRET = 'test-secret-min-32-chars-long-xxxx'; });
  beforeEach(() => jest.clearAllMocks());

  test('400 si email invalide', async () => {
    const res = await POST(mkReq({ email: 'pas-email', password: 'x' }));
    expect(res.status).toBe(400);
  });

  test('401 si user introuvable', async () => {
    (getSupabaseAdmin as jest.Mock).mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }) }),
    });
    const res = await POST(mkReq({ email: 'x@y.fr', password: 'abc' }));
    expect(res.status).toBe(401);
  });

  test('401 si password wrong', async () => {
    (getSupabaseAdmin as jest.Mock).mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({
        data: {
          id: 'm1', email: 'x@y.fr', role: 'secretariat', password_hash: '$2a$12$xxx',
          activated_at: '2026-04-01T00:00:00Z', active: true,
          structure_id: 's1',
          gd_structures: { id: 's1', name: 'S', status: 'active', code: 'ABCDEF' },
        },
      }) }) }) }) }),
    });
    (verifyPassword as jest.Mock).mockResolvedValue(false);
    const res = await POST(mkReq({ email: 'x@y.fr', password: 'wrong' }));
    expect(res.status).toBe(401);
  });

  test('429 si email bloqué par rate-limit même avec IP OK', async () => {
    const mockRate = require('@/lib/rate-limit').isRateLimited as jest.Mock;
    mockRate.mockImplementation((key: string) => {
      if (key === 'struct-login-email') return Promise.resolve(true);
      return Promise.resolve(false);
    });
    const res = await POST(mkReq({ email: 'x@y.fr', password: 'abc123' }));
    expect(res.status).toBe(429);
    mockRate.mockReset();
    mockRate.mockResolvedValue(false);
  });

  test('200 + cookie si login OK', async () => {
    const fromMock = jest.fn()
      .mockReturnValueOnce({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({
        data: {
          id: 'm1', email: 'x@y.fr', role: 'secretariat', password_hash: '$2a$12$xxx',
          activated_at: '2026-04-01T00:00:00Z', active: true,
          structure_id: 's1',
          gd_structures: { id: 's1', name: 'MECS', status: 'active', code: 'ABCDEF' },
        },
      }) }) }) }) })
      .mockReturnValueOnce({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) });
    (getSupabaseAdmin as jest.Mock).mockReturnValue({ from: fromMock });
    (verifyPassword as jest.Mock).mockResolvedValue(true);
    const res = await POST(mkReq({ email: 'x@y.fr', password: 'good' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('gd_pro_session=');
  });
});
