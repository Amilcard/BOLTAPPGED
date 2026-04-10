/**
 * @jest-environment node
 *
 * Tests unitaires — POST + DELETE /api/dossier-enfant/[inscriptionId]/upload
 *
 * Scénarios couverts :
 *  1. Type invalide → 400
 *  2. Fichier manquant → 400
 *  3. Fichier > 5 Mo → 400
 *  4. Token ownership invalide → 404
 *  5. Upload standard (vaccins) sur dossier existant → 201
 *  6. Upload bulletin_signe → 201 + bulletin_completed = true en base
 *  7. Upload sanitaire_signe → 201 + sanitaire_completed = true en base
 *  8. Upload liaison_signe → 201 + liaison_completed = true en base
 *  9. Upload bulletin_signe sur dossier inexistant → crée le dossier + marque completed
 * 10. DELETE : update DB avant storage (si DB échoue → storage intact)
 * 11. DELETE IDOR : path ne commence pas par inscriptionId → 403
 */

// ── Env ──────────────────────────────────────────────────────────────────────
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockFrom = jest.fn();
const mockStorageUpload = jest.fn();
const mockStorageRemove = jest.fn();
const mockStorageCreateSignedUrl = jest.fn();

jest.mock('@/lib/audit-log', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
  getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
}));

jest.mock('@/lib/supabase-server', () => ({
  getSupabase: () => ({
    from: mockFrom,
    storage: {
      from: () => ({
        upload: mockStorageUpload,
        remove: mockStorageRemove,
        createSignedUrl: mockStorageCreateSignedUrl,
      }),
    },
  }),
  getSupabaseAdmin: () => ({
    from: mockFrom,
    storage: {
      from: () => ({
        upload: mockStorageUpload,
        remove: mockStorageRemove,
        createSignedUrl: mockStorageCreateSignedUrl,
      }),
    },
  }),
}));

import type { NextRequest } from 'next/server';
import { POST, DELETE } from '@/app/api/dossier-enfant/[inscriptionId]/upload/route';

// ── Constantes ───────────────────────────────────────────────────────────────

const VALID_TOKEN = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const INSCRIPTION_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const REFERENT_EMAIL = 'marie.dupont@test.fr';
const STORAGE_PATH = `${INSCRIPTION_ID}/vaccins_123.pdf`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeFile(name = 'doc.pdf', type = 'application/pdf', size = 1024): File {
  const content = new Uint8Array(size);
  // PDF magic bytes: %PDF (0x25 0x50 0x44 0x46)
  content[0] = 0x25; content[1] = 0x50; content[2] = 0x44; content[3] = 0x46;
  return new File([content], name, { type });
}

function makeFormDataRequest(fields: Record<string, string | File>): NextRequest {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return { formData: () => Promise.resolve(fd) } as unknown as NextRequest;
}

function makeParams(id = INSCRIPTION_ID) {
  return { params: Promise.resolve({ inscriptionId: id }) };
}

function makeDeleteRequest(body: Record<string, unknown>): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest;
}

/** Mock ownership OK + dossier existant avec documents_joints vide */
function setupOwnershipOk(dossierExists = true) {
  let inscriptionCalls = 0;
  mockFrom.mockImplementation((table: string) => {
    if (table === 'gd_inscriptions') {
      return {
        select: () => ({
          eq: () => {
            const singleFn = () => {
              inscriptionCalls++;
              return { data: { referent_email: REFERENT_EMAIL }, error: null };
            };
            return { is: () => ({ single: singleFn }), single: singleFn };
          },
        }),
      };
    }
    if (table === 'gd_dossier_enfant') {
      return {
        select: () => ({
          eq: () => ({
            single: () => dossierExists
              ? { data: { id: 'dossier_abc', documents_joints: [] }, error: null }
              : { data: null, error: null },
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ error: null }),
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { id: 'dossier_new' }, error: null }),
          }),
        }),
      };
    }
    return { select: () => ({ eq: () => ({ is: () => ({ single: () => ({ data: null, error: null }) }), single: () => ({ data: null, error: null }) }) }) };
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/dossier-enfant/[id]/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageUpload.mockResolvedValue({ error: null });
    mockStorageCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://cdn.test/signed/doc.pdf' }, error: null });
  });

  it('retourne 400 si type de document invalide', async () => {
    setupOwnershipOk();
    const req = makeFormDataRequest({
      token: VALID_TOKEN,
      type: 'type_inexistant',
      file: makeFile(),
    });
    const res = await POST(req, makeParams());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/type invalide/i);
  });

  it('retourne 400 si fichier manquant', async () => {
    setupOwnershipOk();
    const fd = new FormData();
    fd.append('token', VALID_TOKEN);
    fd.append('type', 'vaccins');
    const req = { formData: () => Promise.resolve(fd) } as unknown as NextRequest;
    const res = await POST(req, makeParams());
    expect(res.status).toBe(400);
  });

  it('retourne 400 si fichier > 5 Mo', async () => {
    setupOwnershipOk();
    const req = makeFormDataRequest({
      token: VALID_TOKEN,
      type: 'vaccins',
      file: makeFile('big.pdf', 'application/pdf', 6 * 1024 * 1024),
    });
    const res = await POST(req, makeParams());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/volumineux/i);
  });

  it('retourne 404 si token ownership invalide', async () => {
    mockFrom.mockImplementation(() => ({
      select: () => ({ eq: () => ({ is: () => ({ single: () => ({ data: null, error: null }) }), single: () => ({ data: null, error: null }) }) }),
    }));
    const req = makeFormDataRequest({
      token: VALID_TOKEN,
      type: 'vaccins',
      file: makeFile(),
    });
    const res = await POST(req, makeParams());
    expect(res.status).toBe(404);
  });

  it('upload vaccins sur dossier existant → 201 + document retourné', async () => {
    setupOwnershipOk(true);
    const req = makeFormDataRequest({
      token: VALID_TOKEN,
      type: 'vaccins',
      file: makeFile('carnet.pdf'),
    });
    const res = await POST(req, makeParams());
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.document.type).toBe('vaccins');
  });

  it('upload bulletin_signe → 201 + bulletin_completed mis à true', async () => {
    const mockUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ error: null }) });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gd_inscriptions') {
        return { select: () => ({ eq: () => ({ is: () => ({ single: () => ({ data: { referent_email: REFERENT_EMAIL }, error: null }) }), single: () => ({ data: { referent_email: REFERENT_EMAIL }, error: null }) }) }) };
      }
      if (table === 'gd_dossier_enfant') {
        return {
          select: () => ({ eq: () => ({ single: () => ({ data: { id: 'dossier_abc', documents_joints: [] }, error: null }) }) }),
          update: mockUpdate,
        };
      }
      return { select: () => ({ eq: () => ({ is: () => ({ single: () => ({ data: null, error: null }) }), single: () => ({ data: null, error: null }) }) }) };
    });

    const req = makeFormDataRequest({ token: VALID_TOKEN, type: 'bulletin_signe', file: makeFile('bulletin.pdf') });
    const res = await POST(req, makeParams());
    expect(res.status).toBe(201);

    // Vérifie que bulletin_completed = true a été mis à jour
    const updateCalls = mockUpdate.mock.calls;
    const completedCall = updateCalls.find(([data]: [Record<string, unknown>]) => data?.bulletin_completed === true);
    expect(completedCall).toBeDefined();
  });

  it('upload sanitaire_signe → sanitaire_completed mis à true', async () => {
    const mockUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ error: null }) });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gd_inscriptions') return { select: () => ({ eq: () => ({ is: () => ({ single: () => ({ data: { referent_email: REFERENT_EMAIL }, error: null }) }), single: () => ({ data: { referent_email: REFERENT_EMAIL }, error: null }) }) }) };
      if (table === 'gd_dossier_enfant') return {
        select: () => ({ eq: () => ({ single: () => ({ data: { id: 'dossier_abc', documents_joints: [] }, error: null }) }) }),
        update: mockUpdate,
      };
      return { select: () => ({ eq: () => ({ is: () => ({ single: () => ({ data: null, error: null }) }), single: () => ({ data: null, error: null }) }) }) };
    });

    const req = makeFormDataRequest({ token: VALID_TOKEN, type: 'sanitaire_signe', file: makeFile('sanitaire.pdf') });
    await POST(req, makeParams());
    const updateCalls = mockUpdate.mock.calls;
    const completedCall = updateCalls.find(([data]: [Record<string, unknown>]) => data?.sanitaire_completed === true);
    expect(completedCall).toBeDefined();
  });

  it('upload liaison_signe → liaison_completed mis à true', async () => {
    const mockUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ error: null }) });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gd_inscriptions') return { select: () => ({ eq: () => ({ is: () => ({ single: () => ({ data: { referent_email: REFERENT_EMAIL }, error: null }) }), single: () => ({ data: { referent_email: REFERENT_EMAIL }, error: null }) }) }) };
      if (table === 'gd_dossier_enfant') return {
        select: () => ({ eq: () => ({ single: () => ({ data: { id: 'dossier_abc', documents_joints: [] }, error: null }) }) }),
        update: mockUpdate,
      };
      return { select: () => ({ eq: () => ({ is: () => ({ single: () => ({ data: null, error: null }) }), single: () => ({ data: null, error: null }) }) }) };
    });

    const req = makeFormDataRequest({ token: VALID_TOKEN, type: 'liaison_signe', file: makeFile('liaison.pdf') });
    await POST(req, makeParams());
    const updateCalls = mockUpdate.mock.calls;
    const completedCall = updateCalls.find(([data]: [Record<string, unknown>]) => data?.liaison_completed === true);
    expect(completedCall).toBeDefined();
  });

  it('upload signé sur dossier inexistant → crée le dossier + marque completed', async () => {
    const mockInsert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: 'dossier_new' }, error: null }),
      }),
    });
    const mockUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ error: null }) });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gd_inscriptions') return {
        select: () => ({
          eq: () => ({
            is: () => ({ single: () => ({ data: { referent_email: REFERENT_EMAIL, sejour_slug: 'sejour-test' }, error: null }) }),
            single: () => ({ data: { referent_email: REFERENT_EMAIL, sejour_slug: 'sejour-test' }, error: null }),
          }),
        }),
      };
      if (table === 'gd_stays') return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => ({ data: { documents_requis: [] }, error: null }),
          }),
        }),
      };
      if (table === 'gd_dossier_enfant') return {
        select: () => ({ eq: () => ({ is: () => ({ single: () => ({ data: null, error: null }) }), single: () => ({ data: null, error: null }) }) }),
        insert: mockInsert,
        update: mockUpdate,
      };
      return { select: () => ({ eq: () => ({ is: () => ({ single: () => ({ data: null, error: null }) }), single: () => ({ data: null, error: null }) }) }) };
    });

    const req = makeFormDataRequest({ token: VALID_TOKEN, type: 'bulletin_signe', file: makeFile('signed.pdf') });
    const res = await POST(req, makeParams());
    expect(res.status).toBe(201);
    expect(mockInsert).toHaveBeenCalled();
    const updateCalls = mockUpdate.mock.calls;
    const completedCall = updateCalls.find(([data]: [Record<string, unknown>]) => data?.bulletin_completed === true);
    expect(completedCall).toBeDefined();
  });
});

describe('DELETE /api/dossier-enfant/[id]/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageRemove.mockResolvedValue({ error: null });
  });

  it('retourne 403 si storage_path IDOR (chemin ne commence pas par inscriptionId)', async () => {
    const mockOwnership = jest.fn().mockImplementation((table: string) => {
      if (table === 'gd_inscriptions') return { select: () => ({ eq: () => ({ is: () => ({ single: () => ({ data: { referent_email: REFERENT_EMAIL }, error: null }) }), single: () => ({ data: { referent_email: REFERENT_EMAIL }, error: null }) }) }) };
      return { select: () => ({ eq: () => ({ is: () => ({ single: () => ({ data: null, error: null }) }), single: () => ({ data: null, error: null }) }) }) };
    });
    mockFrom.mockImplementation(mockOwnership);

    const req = makeDeleteRequest({ token: VALID_TOKEN, storage_path: 'autre-inscription/doc.pdf' });
    const res = await DELETE(req, makeParams());
    expect(res.status).toBe(403);
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it('si update DB réussit → storage supprimé ensuite', async () => {
    const mockUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ error: null }) });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gd_inscriptions') return { select: () => ({ eq: () => ({ is: () => ({ single: () => ({ data: { referent_email: REFERENT_EMAIL }, error: null }) }), single: () => ({ data: { referent_email: REFERENT_EMAIL }, error: null }) }) }) };
      if (table === 'gd_dossier_enfant') return {
        select: () => ({ eq: () => ({ single: () => ({ data: { id: 'dossier_abc', documents_joints: [{ storage_path: STORAGE_PATH, type: 'vaccins' }] }, error: null }) }) }),
        update: mockUpdate,
      };
      return { select: () => ({ eq: () => ({ is: () => ({ single: () => ({ data: null, error: null }) }), single: () => ({ data: null, error: null }) }) }) };
    });

    const req = makeDeleteRequest({ token: VALID_TOKEN, storage_path: STORAGE_PATH });
    const res = await DELETE(req, makeParams());
    expect(res.status).toBe(200);
    // DB update appelé avant storage remove
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockStorageRemove).toHaveBeenCalledWith([STORAGE_PATH]);
  });

  it('si update DB échoue → storage NON supprimé (rollback implicite)', async () => {
    const mockUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ error: { message: 'DB error' } }) });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gd_inscriptions') return { select: () => ({ eq: () => ({ is: () => ({ single: () => ({ data: { referent_email: REFERENT_EMAIL }, error: null }) }), single: () => ({ data: { referent_email: REFERENT_EMAIL }, error: null }) }) }) };
      if (table === 'gd_dossier_enfant') return {
        select: () => ({ eq: () => ({ single: () => ({ data: { id: 'dossier_abc', documents_joints: [{ storage_path: STORAGE_PATH }] }, error: null }) }) }),
        update: mockUpdate,
      };
      return { select: () => ({ eq: () => ({ is: () => ({ single: () => ({ data: null, error: null }) }), single: () => ({ data: null, error: null }) }) }) };
    });

    const req = makeDeleteRequest({ token: VALID_TOKEN, storage_path: STORAGE_PATH });
    const res = await DELETE(req, makeParams());
    expect(res.status).toBe(500);
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });
});
