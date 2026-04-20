/**
 * @jest-environment node
 *
 * Tests unitaires — POST /api/dossier-enfant/[inscriptionId]/submit
 *
 * Vérifie : ownership, complétude des blocs, anti-doublon, et envoi réussi.
 *
 * Scénarios couverts :
 *  1. Token manquant → 400
 *  2. Token non-UUID → 400
 *  3. Ownership : token inconnu → 404
 *  4. Ownership : email différent → 403
 *  5. Dossier introuvable → 404
 *  6. Dossier déjà envoyé → 409
 *  7. Dossier incomplet (bloc manquant) → 400
 *  8. Dossier complet → 200 + ged_sent_at + partial_docs_missing vide
 *  9. Renseignements non-requis → OK même sans renseignements_completed
 * 10. Doc optionnel requis par séjour manquant → 200 + partial_docs_missing
 *     (changement 2026-04-19 : règle CEO non-bloquante, GED relance manuel)
 * 11. Doc optionnel requis présent dans documents_joints → 200 + partial vide
 * 12. 4 blocs OK + zéro PJ uploadée → 200 + liste complète des PJ manquantes
 */

// ── Env ──────────────────────────────────────────────────────────────────────
import type { NextRequest } from 'next/server';
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

jest.mock('@/lib/email', () => ({
  sendDossierCompletEmail: jest.fn().mockResolvedValue(undefined),
  sendDossierGedAdminNotification: jest.fn().mockResolvedValue(undefined),
  sendStructureArchivageEmail: jest.fn().mockResolvedValue(undefined),
}));

import { POST } from '@/app/api/dossier-enfant/[inscriptionId]/submit/route';

// ── Helpers ──────────────────────────────────────────────────────────────────

const VALID_TOKEN = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const VALID_INSCRIPTION_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const REFERENT_EMAIL = 'marie.dupont@test.fr';

function makeRequest(body: Record<string, unknown>) {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest;
}

function makeParams(inscriptionId: string) {
  return { params: Promise.resolve({ inscriptionId }) };
}

/** Complete dossier data */
function completeDossier(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dossier_123',
    bulletin_completed: true,
    sanitaire_completed: true,
    liaison_completed: true,
    renseignements_completed: true,
    renseignements_required: true,
    documents_joints: [],
    ged_sent_at: null,
    ...overrides,
  };
}

/**
 * Configure mockFrom for the full submit flow.
 * ownership: 'ok' | 'not_found' | 'mismatch'
 * documentsRequis: types requis par le séjour (ex: ['pass_nautique'])
 */
function setupMocks(opts: {
  ownership?: 'ok' | 'not_found' | 'mismatch';
  dossier?: Record<string, unknown> | null;
  updateError?: unknown;
  documentsRequis?: string[]; // ce que gd_stays.documents_requis retourne
  structureEmail?: string | null; // email contact structure (null = pas d'archive)
  structureId?: string | null; // structure_id sur l'inscription (null = pas de lookup)
} = {}) {
  const {
    ownership = 'ok',
    dossier = completeDossier(),
    updateError = null,
    documentsRequis = [], // par défaut aucun doc optionnel requis
    structureEmail = 'archivage@struct.fr',
    structureId = 'struct-test-1',
  } = opts;

  let inscriptionCallCount = 0;

  mockFrom.mockImplementation((table: string) => {
    if (table === 'gd_inscriptions') {
      return {
        select: () => ({
          eq: () => {
            const singleFn = () => {
              inscriptionCallCount++;
              if (ownership === 'not_found') return { data: null, error: null };
              if (ownership === 'mismatch') {
                if (inscriptionCallCount <= 1) return { data: { referent_email: REFERENT_EMAIL }, error: null };
                return { data: { referent_email: 'autre@autre.fr' }, error: null };
              }
              // ok — retourne email ET sejour_slug ET structure_id pour toutes les requêtes
              return {
                data: {
                  referent_email: REFERENT_EMAIL,
                  sejour_slug: 'test-sejour',
                  structure_id: structureId,
                },
                error: null,
              };
            };
            return {
              is: () => ({ single: singleFn }),
              single: singleFn,
            };
          },
        }),
      };
    }

    if (table === 'gd_stays') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => ({
              data: { documents_requis: documentsRequis },
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === 'gd_structures') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => ({
              data: structureEmail !== null ? { email: structureEmail } : null,
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === 'gd_dossier_enfant') {
      return {
        select: () => ({
          eq: () => ({
            single: () => ({
              data: dossier,
              error: dossier ? null : { code: 'PGRST116' },
            }),
          }),
        }),
        update: () => ({
          eq: () => ({
            is: () => ({
              select: () => ({ data: updateError ? null : [{ id: 'dossier_123' }], error: updateError }),
            }),
            error: updateError,
          }),
        }),
      };
    }

    return {
      select: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) }),
    };
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/dossier-enfant/[inscriptionId]/submit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Validation ──────────────────────────────────────────────────────

  it('retourne 400 si token manquant', async () => {
    const req = makeRequest({});
    const res = await POST(req, makeParams(VALID_INSCRIPTION_ID));
    expect(res.status).toBe(400);
  });

  it('retourne 400 si token non-UUID', async () => {
    setupMocks();
    const req = makeRequest({ token: 'not-a-uuid' });
    const res = await POST(req, makeParams(VALID_INSCRIPTION_ID));
    expect(res.status).toBe(400);
  });

  // ─── Ownership ───────────────────────────────────────────────────────

  it('retourne 404 si token inconnu (ownership)', async () => {
    setupMocks({ ownership: 'not_found' });
    const req = makeRequest({ token: VALID_TOKEN });
    const res = await POST(req, makeParams(VALID_INSCRIPTION_ID));
    expect(res.status).toBe(404);
  });

  it('retourne 403 si email ne match pas (ownership)', async () => {
    setupMocks({ ownership: 'mismatch' });
    const req = makeRequest({ token: VALID_TOKEN });
    const res = await POST(req, makeParams(VALID_INSCRIPTION_ID));
    expect(res.status).toBe(403);
  });

  // ─── Dossier ─────────────────────────────────────────────────────────

  it('retourne 404 si dossier introuvable', async () => {
    setupMocks({ dossier: null });
    const req = makeRequest({ token: VALID_TOKEN });
    const res = await POST(req, makeParams(VALID_INSCRIPTION_ID));
    expect(res.status).toBe(404);
  });

  it('retourne 409 si dossier déjà envoyé (anti-doublon)', async () => {
    setupMocks({ dossier: completeDossier({ ged_sent_at: '2026-03-01T10:00:00Z' }) });
    const req = makeRequest({ token: VALID_TOKEN });
    const res = await POST(req, makeParams(VALID_INSCRIPTION_ID));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.alreadySent).toBe(true);
  });

  it('retourne 400 si dossier incomplet (bloc sanitaire manquant)', async () => {
    setupMocks({ dossier: completeDossier({ sanitaire_completed: false }) });
    const req = makeRequest({ token: VALID_TOKEN });
    const res = await POST(req, makeParams(VALID_INSCRIPTION_ID));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain('incomplet');
  });

  // ─── Succès ──────────────────────────────────────────────────────────

  it('dossier complet → 200 + ok: true + gedSentAt + partial_docs_missing vide', async () => {
    setupMocks();
    const req = makeRequest({ token: VALID_TOKEN });
    const res = await POST(req, makeParams(VALID_INSCRIPTION_ID));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.gedSentAt).toBeDefined();
    expect(json.partial_docs_missing).toEqual([]);
  });

  it('renseignements non-requis → OK même si renseignements_completed = false', async () => {
    setupMocks({
      dossier: completeDossier({
        renseignements_required: false,
        renseignements_completed: false,
      }),
    });
    const req = makeRequest({ token: VALID_TOKEN });
    const res = await POST(req, makeParams(VALID_INSCRIPTION_ID));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  // ─── Docs optionnels requis par séjour ───────────────────────────────

  it('doc optionnel requis manquant → 200 + partial_docs_missing (règle CEO 2026-04-19)', async () => {
    setupMocks({
      // pass_nautique requis par le séjour mais absent des documents_joints.
      // Auparavant bloquant (400). Désormais 200 + info remontée pour relance GED.
      documentsRequis: ['pass_nautique'],
      dossier: completeDossier({ documents_joints: [] }),
    });
    const req = makeRequest({ token: VALID_TOKEN });
    const res = await POST(req, makeParams(VALID_INSCRIPTION_ID));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.partial_docs_missing).toContain('pass_nautique');
  });

  it('doc optionnel requis présent dans documents_joints → 200 + partial vide', async () => {
    setupMocks({
      documentsRequis: ['pass_nautique'],
      dossier: completeDossier({
        documents_joints: [{ type: 'pass_nautique', filename: 'pass.pdf', storage_path: 'x/y.pdf', uploaded_at: '2026-04-02' }],
      }),
    });
    const req = makeRequest({ token: VALID_TOKEN });
    const res = await POST(req, makeParams(VALID_INSCRIPTION_ID));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.partial_docs_missing).toEqual([]);
  });

  // ─── Archivage structure (email post-soumission) ─────────────────────

  it('archivage structure : envoie sendStructureArchivageEmail quand gd_structures.email présent', async () => {
    setupMocks({ structureEmail: 'archivage@struct.fr' });
    const email = jest.requireMock('@/lib/email') as {
      sendStructureArchivageEmail: jest.Mock;
    };
    const auditLogMock = jest.requireMock('@/lib/audit-log') as { auditLog: jest.Mock };

    const req = makeRequest({ token: VALID_TOKEN });
    const res = await POST(req, makeParams(VALID_INSCRIPTION_ID));

    expect(res.status).toBe(200);
    expect(email.sendStructureArchivageEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        structureEmail: 'archivage@struct.fr',
        pdfLink: expect.stringContaining(`/api/dossier-enfant/${VALID_INSCRIPTION_ID}/pdf?token=`),
      }),
    );
    expect(email.sendStructureArchivageEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        pdfLink: expect.stringContaining('type=bulletin'),
      }),
    );
    expect(auditLogMock.auditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: expect.objectContaining({ structure_archive_sent: true }),
      }),
    );
  });

  it('archivage structure : skip si gd_structures.email null', async () => {
    setupMocks({ structureEmail: null });
    const email = jest.requireMock('@/lib/email') as {
      sendStructureArchivageEmail: jest.Mock;
    };
    const auditLogMock = jest.requireMock('@/lib/audit-log') as { auditLog: jest.Mock };

    const req = makeRequest({ token: VALID_TOKEN });
    const res = await POST(req, makeParams(VALID_INSCRIPTION_ID));

    expect(res.status).toBe(200);
    expect(email.sendStructureArchivageEmail).not.toHaveBeenCalled();
    expect(auditLogMock.auditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: expect.objectContaining({ structure_archive_sent: false }),
      }),
    );
  });

  it('archivage structure : échec email NE BLOQUE PAS la réponse 200 (fire-and-forget)', async () => {
    setupMocks({ structureEmail: 'archivage@struct.fr' });
    const email = jest.requireMock('@/lib/email') as {
      sendStructureArchivageEmail: jest.Mock;
    };
    email.sendStructureArchivageEmail.mockRejectedValueOnce(new Error('SMTP down'));

    const req = makeRequest({ token: VALID_TOKEN });
    const res = await POST(req, makeParams(VALID_INSCRIPTION_ID));

    // Réponse OK même si l'email d'archivage échoue.
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it('4 blocs OK + 0 PJ uploadée → 200 + liste complète des PJ manquantes', async () => {
    // Scénario extrême : toutes les PJ optionnelles requises manquent.
    // Règle CEO : envoi OK, GED relance les 3 docs en post-envoi.
    setupMocks({
      documentsRequis: ['pass_nautique', 'certificat_medical', 'attestation_assurance'],
      dossier: completeDossier({ documents_joints: [] }),
    });
    const req = makeRequest({ token: VALID_TOKEN });
    const res = await POST(req, makeParams(VALID_INSCRIPTION_ID));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.partial_docs_missing).toEqual(
      expect.arrayContaining(['pass_nautique', 'certificat_medical', 'attestation_assurance']),
    );
    expect(json.partial_docs_missing).toHaveLength(3);
  });
});
