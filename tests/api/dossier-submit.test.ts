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
 */

// ── Env ──────────────────────────────────────────────────────────────────────
import type { NextRequest } from 'next/server';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-key';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockFrom = jest.fn();

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
 */
function setupMocks(opts: {
  ownership?: 'ok' | 'not_found' | 'mismatch';
  dossier?: Record<string, unknown> | null; // null = not found, object = dossier data
  updateError?: unknown;
} = {}) {
  const { ownership = 'ok', dossier = completeDossier(), updateError = null } = opts;

  // Track which call index per table to differentiate
  // gd_inscriptions calls (ownership check has 2 calls)
  let inscriptionCallCount = 0;

  mockFrom.mockImplementation((table: string) => {
    if (table === 'gd_inscriptions') {
      return {
        select: () => ({
          eq: (col: string, val: unknown) => ({
            single: () => {
              inscriptionCallCount++;
              if (ownership === 'not_found') {
                return { data: null, error: null };
              }
              if (ownership === 'mismatch') {
                // First call (suivi_token lookup) → returns one email
                // Second call (id lookup) → returns different email
                if (inscriptionCallCount <= 1) {
                  return { data: { referent_email: REFERENT_EMAIL }, error: null };
                }
                return { data: { referent_email: 'autre@autre.fr' }, error: null };
              }
              // ok — both calls return same email
              return { data: { referent_email: REFERENT_EMAIL }, error: null };
            },
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
});
