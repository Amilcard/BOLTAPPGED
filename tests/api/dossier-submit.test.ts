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
 *  8. Dossier complet → 200 + ged_sent_at
 *  9. Renseignements non-requis → OK même sans renseignements_completed
 * 10. Doc optionnel requis par séjour manquant → 400 + docs_manquants
 * 11. Doc optionnel requis présent dans documents_joints → 200
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
} = {}) {
  const {
    ownership = 'ok',
    dossier = completeDossier(),
    updateError = null,
    documentsRequis = [], // par défaut aucun doc optionnel requis
  } = opts;

  let inscriptionCallCount = 0;

  mockFrom.mockImplementation((table: string) => {
    if (table === 'gd_inscriptions') {
      return {
        select: () => ({
          eq: () => ({
            single: () => {
              inscriptionCallCount++;
              if (ownership === 'not_found') return { data: null, error: null };
              if (ownership === 'mismatch') {
                if (inscriptionCallCount <= 1) return { data: { referent_email: REFERENT_EMAIL }, error: null };
                return { data: { referent_email: 'autre@autre.fr' }, error: null };
              }
              // ok — retourne email ET sejour_slug pour toutes les requêtes
              return { data: { referent_email: REFERENT_EMAIL, sejour_slug: 'test-sejour' }, error: null };
            },
          }),
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
          eq: () => ({ error: updateError }),
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

  it('dossier complet → 200 + ok: true + gedSentAt', async () => {
    setupMocks();
    const req = makeRequest({ token: VALID_TOKEN });
    const res = await POST(req, makeParams(VALID_INSCRIPTION_ID));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.gedSentAt).toBeDefined();
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

  it('doc optionnel requis manquant → 400 + docs_manquants', async () => {
    setupMocks({
      // pass_nautique requis par le séjour mais absent des documents_joints
      documentsRequis: ['pass_nautique'],
      dossier: completeDossier({ documents_joints: [] }),
    });
    const req = makeRequest({ token: VALID_TOKEN });
    const res = await POST(req, makeParams(VALID_INSCRIPTION_ID));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.docs_manquants).toContain('pass_nautique');
  });

  it('doc optionnel requis présent dans documents_joints → 200', async () => {
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
  });
});
