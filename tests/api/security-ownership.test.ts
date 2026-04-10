/**
 * @jest-environment node
 *
 * Tests sécurité — Contrôle d'ownership (IDOR + upload cross-referent)
 *
 * Objectif : s'assurer qu'un référent ne peut pas lire, modifier ou uploader
 * sur le dossier enfant d'un autre référent, même en connaissant l'inscriptionId.
 *
 * Matrice :
 *  1. GET sans token → 400 (paramètre manquant)
 *  2. GET token non-UUID → 400 (INVALID_TOKEN)
 *  3. GET token inconnu → 404 (token inexistant en DB)
 *  4. GET token référent B sur inscription A → 403 (FORBIDDEN)
 *  5. PATCH sans token → 400
 *  6. PATCH bloc non-whitelisté → 403 (INVALID_BLOC)
 *  7. PATCH token référent B sur inscription A → 403 (FORBIDDEN)
 *  8. Upload POST type de document invalide → 400
 *  9. Upload POST type MIME invalide (fichier .exe) → 400
 * 10. Upload POST token référent B sur inscription A → 403 (FORBIDDEN)
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-key';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockFrom = jest.fn();

jest.mock('@/lib/audit-log', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
  getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
}));

jest.mock('@/lib/supabase-server', () => ({
  getSupabase: () => ({ from: mockFrom }),
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));

import { NextRequest } from 'next/server';
import { GET, PATCH } from '@/app/api/dossier-enfant/[inscriptionId]/route';
import { POST as uploadPost } from '@/app/api/dossier-enfant/[inscriptionId]/upload/route';

// ── Constants ─────────────────────────────────────────────────────────────────

const INSCRIPTION_A = 'aaa00000-0000-0000-0000-000000000001'; // appartient à ref A
const TOKEN_A = 'aaa11111-1111-1111-1111-111111111111';       // suivi_token de A
const TOKEN_B = 'bbb22222-2222-2222-2222-222222222222';       // suivi_token de B (autre référent)
const EMAIL_A = 'refA@structure.fr';
const EMAIL_B = 'refB@other.org';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGetReq(inscriptionId: string, token?: string): NextRequest {
  const url = `http://localhost/api/dossier-enfant/${inscriptionId}${token ? `?token=${token}` : ''}`;
  return new NextRequest(url);
}

function makePatchReq(inscriptionId: string, body: object): NextRequest {
  return new NextRequest(`http://localhost/api/dossier-enfant/${inscriptionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Simule l'appel à verifyOwnership : token → referent A, inscription → referent X */
function mockOwnershipCheck(tokenEmail: string | null, inscriptionEmail: string | null) {
  let callCount = 0;
  mockFrom.mockImplementation(() => ({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // Lookup par suivi_token
            return Promise.resolve(
              tokenEmail ? { data: { referent_email: tokenEmail }, error: null }
                         : { data: null, error: { message: 'not found' } }
            );
          }
          // Lookup par id inscription
          return Promise.resolve(
            inscriptionEmail ? { data: { referent_email: inscriptionEmail }, error: null }
                              : { data: null, error: null }
          );
        }),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  }));
}

// ── Tests — GET ───────────────────────────────────────────────────────────────

describe('GET /api/dossier-enfant/[inscriptionId] — sécurité ownership', () => {
  beforeEach(() => jest.clearAllMocks());

  it('1. token absent → 400 MISSING_PARAMS', async () => {
    const res = await GET(makeGetReq(INSCRIPTION_A), { params: Promise.resolve({ inscriptionId: INSCRIPTION_A }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('MISSING_PARAMS');
  });

  it('2. token non-UUID → 400 INVALID_TOKEN', async () => {
    const res = await GET(makeGetReq(INSCRIPTION_A, 'not-a-uuid'), { params: Promise.resolve({ inscriptionId: INSCRIPTION_A }) });
    expect(res.status).toBe(400);
    // verifyOwnership rejects non-UUID tokens
  });

  it('3. token UUID inconnu (token absent en DB) → 404', async () => {
    mockOwnershipCheck(null, EMAIL_A); // token → not found
    const res = await GET(makeGetReq(INSCRIPTION_A, TOKEN_B), { params: Promise.resolve({ inscriptionId: INSCRIPTION_A }) });
    expect(res.status).toBe(404);
  });

  it('4. IDOR — référent B tente de lire le dossier de A → 403 FORBIDDEN', async () => {
    // TOKEN_B appartient à EMAIL_B, mais INSCRIPTION_A appartient à EMAIL_A
    mockOwnershipCheck(EMAIL_B, EMAIL_A);
    const res = await GET(makeGetReq(INSCRIPTION_A, TOKEN_B), { params: Promise.resolve({ inscriptionId: INSCRIPTION_A }) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });
});

// ── Tests — PATCH ─────────────────────────────────────────────────────────────

describe('PATCH /api/dossier-enfant/[inscriptionId] — sécurité ownership', () => {
  beforeEach(() => jest.clearAllMocks());

  it('5. token absent dans le body → 400 MISSING_PARAMS', async () => {
    const res = await PATCH(
      makePatchReq(INSCRIPTION_A, { bloc: 'bulletin_complement', data: {} }),
      { params: Promise.resolve({ inscriptionId: INSCRIPTION_A }) }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('MISSING_PARAMS');
  });

  it('6. bloc non dans la whitelist → 403 INVALID_BLOC', async () => {
    const res = await PATCH(
      makePatchReq(INSCRIPTION_A, { token: TOKEN_A, bloc: 'status', data: { status: 'validee' } }),
      { params: Promise.resolve({ inscriptionId: INSCRIPTION_A }) }
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BLOC');
  });

  it('7. IDOR — référent B tente de PATCH un bloc de A → 403 FORBIDDEN', async () => {
    mockOwnershipCheck(EMAIL_B, EMAIL_A);
    const res = await PATCH(
      makePatchReq(INSCRIPTION_A, { token: TOKEN_B, bloc: 'bulletin_complement', data: { nom: 'test' } }),
      { params: Promise.resolve({ inscriptionId: INSCRIPTION_A }) }
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });
});

// ── Tests — POST upload ───────────────────────────────────────────────────────

describe('POST /api/dossier-enfant/[inscriptionId]/upload — sécurité', () => {
  beforeEach(() => jest.clearAllMocks());

  async function makeUploadRequest(fields: {
    token?: string;
    type?: string;
    filename?: string;
    mime?: string;
    size?: number;
  } = {}): Promise<NextRequest> {
    const formData = new FormData();
    if (fields.token !== undefined) formData.append('token', fields.token);
    if (fields.type !== undefined) formData.append('type', fields.type);
    const file = new File(
      ['%PDF-1.4 fake content'],
      fields.filename ?? 'test.pdf',
      { type: fields.mime ?? 'application/pdf' }
    );
    // Override size via Object.defineProperty if needed
    Object.defineProperty(file, 'size', { value: fields.size ?? 1024, configurable: true });
    formData.append('file', file);
    return new NextRequest(`http://localhost/api/dossier-enfant/${INSCRIPTION_A}/upload`, {
      method: 'POST',
      body: formData,
    });
  }

  it('8. type de document invalide → 400', async () => {
    const req = await makeUploadRequest({ token: TOKEN_A, type: 'photo_profil' }); // non dans la liste
    const res = await uploadPost(req, { params: Promise.resolve({ inscriptionId: INSCRIPTION_A }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/type/i);
  });

  it('9. MIME type invalide (extension .exe) → 400 type non autorisé', async () => {
    const req = await makeUploadRequest({ token: TOKEN_A, type: 'vaccins', filename: 'malware.exe', mime: 'application/octet-stream' });
    const res = await uploadPost(req, { params: Promise.resolve({ inscriptionId: INSCRIPTION_A }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/non autorisé/i);
  });

  it('10. IDOR — référent B uploade sur inscription A → 403', async () => {
    mockOwnershipCheck(EMAIL_B, EMAIL_A);
    const req = await makeUploadRequest({ token: TOKEN_B, type: 'vaccins' });
    const res = await uploadPost(req, { params: Promise.resolve({ inscriptionId: INSCRIPTION_A }) });
    expect(res.status).toBe(403);
  });
});
