/**
 * @jest-environment node
 *
 * Tests unitaires — PATCH /api/structure/[code]/inscriptions/[id]/dossier
 *
 * Scenarios :
 *  1. Secrétariat : PATCH bulletin_complement → 200 + insert dossier
 *  2. Direction : PATCH fiche_sanitaire → 200 + update merge
 *  3. Éducateur : 403 (route réservée staff, educ utilise /suivi/[token])
 *  4. Anon (role absent) : 403
 *  5. Bloc hors whitelist → 403
 *  6. ID non-UUID → 400
 *  7. Signature > 500 KB → 413
 *  8. Inscription d'une autre structure → 404
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake';

const mockFromChain = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
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

jest.mock('@/lib/audit-log', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
  getClientIp: () => '1.2.3.4',
}));

jest.mock('@/lib/rate-limit-structure', () => ({
  structureRateLimitGuard: jest.fn().mockResolvedValue(null),
}));

import { NextRequest } from 'next/server';
import { PATCH, GET } from '@/app/api/structure/[code]/inscriptions/[id]/dossier/route';

const STRUCTURE = { id: 'struct-1', name: 'MECS Test' };
const VALID_UUID = '11111111-2222-3333-4444-555555555555';

function makeReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/structure/CODE/inscriptions/x/dossier', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function params(id = VALID_UUID) {
  return Promise.resolve({ code: 'CODE1234AB', id });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFromChain.select.mockReturnThis();
  mockFromChain.eq.mockReturnThis();
  mockFromChain.is.mockReturnThis();
  mockFromChain.insert.mockReturnThis();
  mockFromChain.update.mockReturnThis();
});

describe('PATCH /api/structure/[code]/inscriptions/[id]/dossier', () => {
  it('1 — secrétariat peut créer dossier (insert)', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'secretariat', email: 'sec@test.fr' });
    // ownership check (requireInscriptionInStructure) → maybeSingle() OK
    mockFromChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null }) // ownership
      .mockResolvedValueOnce({ data: null, error: null }); // existing dossier null → insert
    mockFromChain.single.mockResolvedValueOnce({ data: { id: 'dos-1' }, error: null });

    const res = await PATCH(
      makeReq({ bloc: 'bulletin_complement', data: { nom: 'Enfant X' } }),
      { params: params() },
    );
    expect(res.status).toBe(200);
  });

  it('2 — direction peut update bloc existant (merge)', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'direction', email: 'dir@test.fr' });
    mockFromChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null }) // ownership
      .mockResolvedValueOnce({ data: { id: 'dos-1', fiche_sanitaire: { vacc: true } }, error: null }); // existing
    mockFromChain.single.mockResolvedValueOnce({ data: { id: 'dos-1' }, error: null });

    const res = await PATCH(
      makeReq({ bloc: 'fiche_sanitaire', data: { allergie: 'arachide' }, completed: true }),
      { params: params() },
    );
    expect(res.status).toBe(200);
  });

  it('3 — éducateur refusé (403)', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'educateur', email: 'educ@test.fr' });
    const res = await PATCH(
      makeReq({ bloc: 'bulletin_complement', data: {} }),
      { params: params() },
    );
    expect(res.status).toBe(403);
  });

  it('4 — code invalide (resolve null) → 403', async () => {
    mockResolve.mockResolvedValue(null);
    const res = await PATCH(
      makeReq({ bloc: 'bulletin_complement', data: {} }),
      { params: params() },
    );
    expect(res.status).toBe(403);
  });

  it('5 — bloc hors whitelist → 403', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'direction', email: 'dir@test.fr' });
    const res = await PATCH(
      makeReq({ bloc: 'bloc_pirate', data: {} }),
      { params: params() },
    );
    expect(res.status).toBe(403);
  });

  it('6 — ID non-UUID → 400', async () => {
    const res = await PATCH(
      makeReq({ bloc: 'bulletin_complement', data: {} }),
      { params: params('not-a-uuid') },
    );
    expect(res.status).toBe(400);
  });

  it('7 — signature > 500 KB → 413', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'secretariat', email: 'sec@test.fr' });
    const huge = 'data:image/png;base64,' + 'A'.repeat(800_000);
    const res = await PATCH(
      makeReq({ bloc: 'fiche_sanitaire', data: { signature_image_url: huge } }),
      { params: params() },
    );
    expect(res.status).toBe(413);
  });

  it('8 — inscription d\'une autre structure → 404', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'cds', email: 'cds@test.fr' });
    mockFromChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null }); // ownership fail
    const res = await PATCH(
      makeReq({ bloc: 'bulletin_complement', data: {} }),
      { params: params() },
    );
    expect(res.status).toBe(404);
  });
});

function makeGetReq(): NextRequest {
  return new NextRequest('http://localhost:3000/api/structure/CODE/inscriptions/x/dossier', {
    method: 'GET',
  });
}

describe('GET /api/structure/[code]/inscriptions/[id]/dossier', () => {
  it('G1 — staff voit dossier existant', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'secretariat', email: 'sec@test.fr' });
    mockFromChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null }) // ownership
      .mockResolvedValueOnce({
        data: {
          inscription_id: VALID_UUID,
          bulletin_complement: { nom: 'X' },
          fiche_sanitaire: {},
          fiche_liaison_jeune: {},
          fiche_renseignements: null,
          documents_joints: [],
          bulletin_completed: true,
          sanitaire_completed: false,
          liaison_completed: false,
          renseignements_completed: false,
          renseignements_required: false,
        },
        error: null,
      }); // dossier
    const res = await GET(makeGetReq(), { params: params() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.exists).toBe(true);
    expect(body.bulletin_completed).toBe(true);
  });

  it('G2 — staff voit shell vide si dossier absent', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'direction', email: 'dir@test.fr' });
    mockFromChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null }) // ownership
      .mockResolvedValueOnce({ data: null, error: null }); // pas de dossier
    const res = await GET(makeGetReq(), { params: params() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.exists).toBe(false);
    expect(body.bulletin_completed).toBe(false);
  });

  it('G3 — éducateur refusé', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'educateur', email: 'educ@test.fr' });
    const res = await GET(makeGetReq(), { params: params() });
    expect(res.status).toBe(403);
  });
});
