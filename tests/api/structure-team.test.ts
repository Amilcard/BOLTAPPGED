/**
 * @jest-environment node
 */
// tests/api/structure-team.test.ts
import { GET } from '@/app/api/structure/[code]/team/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/structure');
jest.mock('@/lib/supabase-server');
jest.mock('@/lib/rate-limit-structure', () => ({
  structureRateLimitGuard: jest.fn().mockResolvedValue(null),
  getStructureClientIp: jest.fn().mockReturnValue('127.0.0.1'),
}));
jest.mock('@/lib/audit-log', () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));

import { resolveCodeToStructure } from '@/lib/structure';
import { getSupabaseAdmin } from '@/lib/supabase-server';

describe('GET /api/structure/[code]/team', () => {
  beforeEach(() => jest.clearAllMocks());

  test('403 si pas direction', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1' }, role: 'cds', roles: ['cds'], email: null,
    });
    const res = await GET(new NextRequest('http://localhost/api/structure/ABCDEFGHIJ/team'),
      { params: Promise.resolve({ code: 'ABCDEFGHIJ' }) });
    expect(res.status).toBe(403);
  });

  test('200 liste membres pour direction', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1' }, role: 'direction', roles: ['direction'], email: 'd@x.fr',
    });
    (getSupabaseAdmin as jest.Mock).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({
              data: [
                { id: 'm1', email: 'sec@x.fr', role: 'secretariat', active: true, activated_at: '2026-04-17T10:00:00Z', prenom: 'Marie', nom: 'Dupont' },
                { id: 'm2', email: 'edu@x.fr', role: 'educateur', active: false, activated_at: null, prenom: null, nom: null, invitation_expires_at: '2099-12-31T10:00:00Z' },
              ],
              error: null,
            }),
          }),
        }),
      }),
    });
    const res = await GET(new NextRequest('http://localhost/api/structure/ABCDEFGHIJ/team'),
      { params: Promise.resolve({ code: 'ABCDEFGHIJ' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.members).toHaveLength(2);
    expect(body.members[0].status).toBe('active');
    expect(body.members[1].status).toBe('pending');
  });

  test('200 cds_delegated peut lister l\'équipe (subrogation direction)', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1' }, role: 'cds_delegated', roles: ['cds_delegated'], email: 'cds@x.fr',
    });
    (getSupabaseAdmin as jest.Mock).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({
              data: [],
              error: null,
            }),
          }),
        }),
      }),
    });
    const res = await GET(new NextRequest('http://localhost/api/structure/ABCDEFGHIJ/team'),
      { params: Promise.resolve({ code: 'ABCDEFGHIJ' }) });
    expect(res.status).toBe(200);
  });
});
