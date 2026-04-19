/**
 * @jest-environment node
 *
 * Tests unitaires — POST + DELETE /api/structure/[code]/inscriptions/[id]/upload
 *
 * Scénarios :
 *  U1. Secrétariat upload PDF → 201 + document retourné
 *  U2. Éducateur refusé → 403
 *  U3. docType hors whitelist → 400
 *  U4. File > 5 MB → 413
 *  U5. DELETE avec storage_path IDOR (ne commence pas par inscriptionId) → 403
 *  U6. DELETE succès → 200
 *  U7. UUID inscription invalide → 400
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake';
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-key!';

const mockFromChain = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn(),
  single: jest.fn(),
};
const mockStorage = {
  upload: jest.fn(),
  remove: jest.fn(),
  createSignedUrl: jest.fn(),
};
const mockFrom = jest.fn(() => mockFromChain);

jest.mock('@/lib/supabase-server', () => ({
  getSupabase: () => ({ from: mockFrom, storage: { from: () => mockStorage } }),
  getSupabaseAdmin: () => ({ from: mockFrom, storage: { from: () => mockStorage } }),
}));

const mockResolve = jest.fn();
jest.mock('@/lib/structure', () => ({
  resolveCodeToStructure: (...args: unknown[]) => mockResolve(...args),
}));

const mockAuditLog = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/audit-log', () => ({
  auditLog: (...args: unknown[]) => mockAuditLog(...args),
  getClientIp: () => '1.2.3.4',
}));

jest.mock('@/lib/rate-limit-structure', () => ({
  structureRateLimitGuard: jest.fn().mockResolvedValue(null),
}));

import { NextRequest } from 'next/server';
import { POST, DELETE } from '@/app/api/structure/[code]/inscriptions/[id]/upload/route';

const STRUCTURE = { id: 'struct-1', name: 'MECS Test' };
const VALID_UUID = '11111111-2222-3333-4444-555555555555';

// Header PDF valide (magic bytes %PDF-)
const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3]);

function makePdfFile(name = 'cert.pdf', sizePadding = 0): File {
  // Padding = taille supplémentaire (pour tests >5MB). Min = PDF magic.
  const content = new Uint8Array(12 + sizePadding);
  content.set(PDF_MAGIC);
  return new File([content], name, { type: 'application/pdf' });
}

function makeFormReq(fields: { type?: string; file?: File | null }): NextRequest {
  const fd = new FormData();
  if (fields.type) fd.append('type', fields.type);
  if (fields.file) fd.append('file', fields.file);
  return {
    formData: () => Promise.resolve(fd),
    headers: new Headers(),
  } as unknown as NextRequest;
}

function makeDeleteReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/structure/CODE/inscriptions/x/upload', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function params(id = VALID_UUID) {
  return Promise.resolve({ code: 'CODE1234AB', id });
}

beforeEach(() => {
  jest.resetAllMocks();
  mockFrom.mockImplementation(() => mockFromChain);
  mockFromChain.select.mockReturnThis();
  mockFromChain.eq.mockReturnThis();
  mockFromChain.is.mockReturnThis();
  mockFromChain.update.mockReturnThis();
  mockFromChain.insert.mockReturnThis();
  mockStorage.upload.mockResolvedValue({ error: null });
  mockStorage.remove.mockResolvedValue({ error: null });
  mockStorage.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.example/url' } });
  mockAuditLog.mockResolvedValue(undefined);
  const rl = jest.requireMock('@/lib/rate-limit-structure') as { structureRateLimitGuard: jest.Mock };
  rl.structureRateLimitGuard.mockResolvedValue(null);
});

describe('POST /api/structure/[code]/inscriptions/[id]/upload', () => {
  it('U1 — secrétariat upload PDF → 201', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'secretariat', email: 'sec@test.fr' });
    // ownership OK, puis attachDocToDossier : dossier existe déjà
    mockFromChain.maybeSingle.mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null });
    mockFromChain.single.mockResolvedValueOnce({
      data: { id: 'dos-1', documents_joints: [] },
      error: null,
    });

    const res = await POST(
      makeFormReq({ type: 'certificat_medical', file: makePdfFile() }),
      { params: params() },
    );
    expect(res.status).toBe(201);
    expect(mockStorage.upload).toHaveBeenCalled();
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'upload',
        metadata: expect.objectContaining({
          context: 'staff_upload_doc',
          actor_role: 'secretariat',
        }),
      }),
    );
  });

  it('U2 — éducateur refusé (403)', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'educateur', email: 'educ@test.fr' });
    const res = await POST(
      makeFormReq({ type: 'certificat_medical', file: makePdfFile() }),
      { params: params() },
    );
    expect(res.status).toBe(403);
    expect(mockStorage.upload).not.toHaveBeenCalled();
  });

  it('U3 — docType hors whitelist → 400', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'direction', email: 'dir@test.fr' });
    const res = await POST(
      makeFormReq({ type: 'hacker_script', file: makePdfFile() }),
      { params: params() },
    );
    expect(res.status).toBe(400);
  });

  it('U4 — fichier > 5 MB → 413', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'direction', email: 'dir@test.fr' });
    mockFromChain.maybeSingle.mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null });
    const bigFile = makePdfFile('big.pdf', 6 * 1024 * 1024);
    const res = await POST(
      makeFormReq({ type: 'certificat_medical', file: bigFile }),
      { params: params() },
    );
    expect(res.status).toBe(413);
  });

  it('U7 — UUID invalide → 400', async () => {
    const res = await POST(
      makeFormReq({ type: 'certificat_medical', file: makePdfFile() }),
      { params: params('not-a-uuid') },
    );
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/structure/[code]/inscriptions/[id]/upload', () => {
  it('U5 — IDOR storage_path autre inscription → 403', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'direction', email: 'dir@test.fr' });
    const res = await DELETE(
      makeDeleteReq({ storage_path: 'other-inscription/hack.pdf' }),
      { params: params() },
    );
    expect(res.status).toBe(403);
  });

  it('U6 — DELETE succès → 200', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'secretariat', email: 'sec@test.fr' });
    mockFromChain.maybeSingle.mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null });
    mockFromChain.single.mockResolvedValueOnce({
      data: { id: 'dos-1', documents_joints: [{ storage_path: `${VALID_UUID}/doc.pdf` }] },
      error: null,
    });

    const res = await DELETE(
      makeDeleteReq({ storage_path: `${VALID_UUID}/doc.pdf` }),
      { params: params() },
    );
    expect(res.status).toBe(200);
    expect(mockStorage.remove).toHaveBeenCalledWith([`${VALID_UUID}/doc.pdf`]);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'delete',
        metadata: expect.objectContaining({ context: 'staff_delete_doc' }),
      }),
    );
  });
});
