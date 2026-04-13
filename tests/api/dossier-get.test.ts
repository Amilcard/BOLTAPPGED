/**
 * @jest-environment node
 *
 * Tests unitaires — GET /api/dossier-enfant/[inscriptionId]
 *
 * Scénarios couverts :
 *  1. Token manquant → 400
 *  2. Ownership invalide → 404
 *  3. Dossier inexistant → squelette vide avec docs_optionnels_requis/manquants
 *  4. Dossier existant, séjour sans docs optionnels → manquants vide
 *  5. Dossier existant, séjour avec pass_nautique requis + non uploadé → dans manquants
 *  6. Dossier existant, pass_nautique uploadé → plus dans manquants
 *  7. autorisation_parentale requis → mappé vers signature_parentale dans documents_joints
 */

// ── Env ──────────────────────────────────────────────────────────────────────
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake';

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

import type { NextRequest } from 'next/server';
import { GET } from '@/app/api/dossier-enfant/[inscriptionId]/route';

// ── Constantes ───────────────────────────────────────────────────────────────

const VALID_TOKEN = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const INSCRIPTION_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const REFERENT_EMAIL = 'marie.dupont@test.fr';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeGetRequest(token: string, _id = INSCRIPTION_ID): NextRequest {
  return {
    nextUrl: { searchParams: { get: (k: string) => k === 'token' ? token : null } },
  } as unknown as NextRequest;
}

function makeParams(id = INSCRIPTION_ID) {
  return { params: Promise.resolve({ inscriptionId: id }) };
}

function baseDossier(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dossier_abc',
    inscription_id: INSCRIPTION_ID,
    bulletin_complement: {},
    fiche_sanitaire: {},
    fiche_liaison_jeune: {},
    fiche_renseignements: null,
    documents_joints: [],
    bulletin_completed: false,
    sanitaire_completed: false,
    liaison_completed: false,
    renseignements_completed: false,
    renseignements_required: false,
    ged_sent_at: null,
    ...overrides,
  };
}

function setupMocks(opts: {
  dossier?: Record<string, unknown> | null;
  sejourSlug?: string;
  documentsRequis?: string[];
  ownershipFail?: boolean;
} = {}) {
  const {
    dossier = baseDossier(),
    sejourSlug = 'sejour-test',
    documentsRequis = [],
    ownershipFail = false,
  } = opts;

  let _inscriptionCalls = 0;

  mockFrom.mockImplementation((table: string) => {
    if (table === 'gd_inscriptions') {
      return {
        select: () => ({
          eq: () => {
            const singleFn = () => {
              _inscriptionCalls++;
              if (ownershipFail) return { data: null, error: null };
              return { data: { referent_email: REFERENT_EMAIL, sejour_slug: sejourSlug }, error: null };
            };
            return { is: () => ({ single: singleFn }), single: singleFn };
          },
        }),
      };
    }

    if (table === 'gd_stays') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => ({ data: { documents_requis: documentsRequis }, error: null }),
          }),
        }),
      };
    }

    if (table === 'gd_dossier_enfant') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => ({ data: dossier, error: null }),
          }),
        }),
      };
    }

    return {
      select: () => ({
        eq: () => ({
          is: () => ({ single: () => ({ data: null, error: null }) }),
          single: () => ({ data: null, error: null }),
          maybeSingle: () => ({ data: null, error: null }),
        }),
      }),
    };
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/dossier-enfant/[id]', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne 400 si token manquant', async () => {
    const req = makeGetRequest('');
    const res = await GET(req, makeParams());
    expect(res.status).toBe(400);
  });

  it('retourne 404 si token ownership invalide', async () => {
    setupMocks({ ownershipFail: true });
    const req = makeGetRequest(VALID_TOKEN);
    const res = await GET(req, makeParams());
    expect(res.status).toBe(404);
  });

  it('dossier inexistant → retourne squelette avec docs_optionnels_requis/manquants', async () => {
    setupMocks({ dossier: null, documentsRequis: ['pass_nautique'] });
    const req = makeGetRequest(VALID_TOKEN);
    const res = await GET(req, makeParams());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.exists).toBe(false);
    expect(json.docs_optionnels_requis).toContain('pass_nautique');
    expect(json.docs_optionnels_manquants).toContain('pass_nautique');
  });

  it('séjour sans docs optionnels → manquants vide', async () => {
    setupMocks({ documentsRequis: [] });
    const req = makeGetRequest(VALID_TOKEN);
    const res = await GET(req, makeParams());
    const json = await res.json();
    expect(json.docs_optionnels_requis).toEqual([]);
    expect(json.docs_optionnels_manquants).toEqual([]);
  });

  it('pass_nautique requis + non uploadé → dans docs_optionnels_manquants', async () => {
    setupMocks({
      documentsRequis: ['pass_nautique'],
      dossier: baseDossier({ documents_joints: [] }),
    });
    const req = makeGetRequest(VALID_TOKEN);
    const res = await GET(req, makeParams());
    const json = await res.json();
    expect(json.docs_optionnels_requis).toContain('pass_nautique');
    expect(json.docs_optionnels_manquants).toContain('pass_nautique');
  });

  it('pass_nautique requis + uploadé → absent de docs_optionnels_manquants', async () => {
    setupMocks({
      documentsRequis: ['pass_nautique'],
      dossier: baseDossier({
        documents_joints: [{ type: 'pass_nautique', filename: 'pass.pdf', storage_path: 'x/y.pdf', uploaded_at: '2026-04-02' }],
      }),
    });
    const req = makeGetRequest(VALID_TOKEN);
    const res = await GET(req, makeParams());
    const json = await res.json();
    expect(json.docs_optionnels_requis).toContain('pass_nautique');
    expect(json.docs_optionnels_manquants).not.toContain('pass_nautique');
  });

  it('autorisation_parentale requis → mappé vers signature_parentale dans documents_joints', async () => {
    setupMocks({
      documentsRequis: ['autorisation_parentale'],
      dossier: baseDossier({
        documents_joints: [{ type: 'signature_parentale', filename: 'auth.pdf', storage_path: 'x/y.pdf', uploaded_at: '2026-04-02' }],
      }),
    });
    const req = makeGetRequest(VALID_TOKEN);
    const res = await GET(req, makeParams());
    const json = await res.json();
    // autorisation_parentale requis mais signature_parentale uploadée → pas manquant
    expect(json.docs_optionnels_manquants).not.toContain('autorisation_parentale');
  });

  it('plusieurs docs requis partiellement couverts → seuls les manquants listés', async () => {
    setupMocks({
      documentsRequis: ['pass_nautique', 'certificat_medical'],
      dossier: baseDossier({
        documents_joints: [{ type: 'pass_nautique', filename: 'pass.pdf', storage_path: 'x/y.pdf', uploaded_at: '2026-04-02' }],
      }),
    });
    const req = makeGetRequest(VALID_TOKEN);
    const res = await GET(req, makeParams());
    const json = await res.json();
    expect(json.docs_optionnels_requis).toHaveLength(2);
    expect(json.docs_optionnels_manquants).toEqual(['certificat_medical']);
  });
});
