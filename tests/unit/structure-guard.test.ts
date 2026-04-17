/** @jest-environment node */
import { requireStructureRole } from '@/lib/structure-guard';
import { NextRequest } from 'next/server';

jest.mock('@/lib/structure');
import { resolveCodeToStructure } from '@/lib/structure';

const mkReq = () => new NextRequest('http://localhost/x');

describe('requireStructureRole', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 si code vide', async () => {
    const r = await requireStructureRole(mkReq(), '', { allowRoles: ['direction'] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(400);
  });

  test('403 si code invalide (resolved null) — iso-comportement avec routes préexistantes', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue(null);
    const r = await requireStructureRole(mkReq(), 'ABC', { allowRoles: ['direction'] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(403);
  });

  test('403 si rôle non whitelisté (allowRoles)', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1' }, role: 'cds', roles: ['cds'], email: null,
    });
    const r = await requireStructureRole(mkReq(), 'ABCDEF', { allowRoles: ['direction'] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(403);
  });

  test('200 si rôle whitelisté', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1' }, role: 'direction', roles: ['direction'], email: 'd@x.fr',
    });
    const r = await requireStructureRole(mkReq(), 'ABCDEFGHIJ', { allowRoles: ['direction'] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.resolved.role).toBe('direction');
  });

  test('403 si rôle exclu (excludeRoles)', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1' }, role: 'secretariat', roles: ['secretariat'], email: null,
    });
    const r = await requireStructureRole(mkReq(), 'ABCDEF', { excludeRoles: ['secretariat'] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(403);
  });

  test('200 si rôle non exclu', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1' }, role: 'educateur', roles: ['educateur'], email: 'e@x.fr',
    });
    const r = await requireStructureRole(mkReq(), 'ABCDEF', { excludeRoles: ['secretariat'] });
    expect(r.ok).toBe(true);
  });

  test('throw si allowRoles ET excludeRoles fournis', async () => {
    await expect(
      requireStructureRole(mkReq(), 'ABC', { allowRoles: ['direction'], excludeRoles: ['cds'] })
    ).rejects.toThrow();
  });
});
