/**
 * @jest-environment node
 *
 * Tests unitaires — POST /api/souhaits (app/api/souhaits/route.ts)
 *
 * Parcours enfant : un kid émet un souhait → email à l'éducateur.
 * Logique testée : validation, détection doublon, domaine structure, création, email.
 *
 * Scénarios couverts :
 *  1. Champs obligatoires manquants → 400
 *  2. kidSessionToken non-UUID → 400
 *  3. Email éducateur invalide → 400
 *  4. Création souhait OK → 201 + email envoyé
 *  5. Domaine pro → structure_domain extrait
 *  6. Domaine générique (gmail) → structure_domain null
 *  7. Doublon non-traité → mise à jour + 200
 *  8. Doublon déjà validé → pas de mise à jour
 */

// ── Env ──────────────────────────────────────────────────────────────────────
import type { NextRequest } from 'next/server';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-key';
process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockFrom = jest.fn();
const mockSendSouhaitNotification = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/supabase-server', () => ({
  getSupabase: () => ({ from: mockFrom }),
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));

jest.mock('@/lib/email', () => ({
  sendSouhaitNotificationEducateur: (...args: unknown[]) => mockSendSouhaitNotification(...args),
}));

import { POST } from '@/app/api/souhaits/route';

// ── Helpers ──────────────────────────────────────────────────────────────────

const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function makeRequest(body: Record<string, unknown>) {
  return {
    json: () => Promise.resolve(body),
  } as unknown as NextRequest;
}

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kidSessionToken: VALID_UUID,
    kidPrenom: 'Lucas',
    kidPrenomReferent: 'Marie',
    sejourSlug: 'alpoo-kids-ete-2026',
    sejourTitre: 'Alpoo Kids Été 2026',
    motivation: 'Je veux faire du ski et me faire des copains',
    educateurEmail: 'marie.dupont@structure-sociale.fr',
    educateurPrenom: 'Marie',
    ...overrides,
  };
}

/** Configure mockFrom for the standard "create new souhait" path */
function setupCreatePath(opts: {
  structureExists?: boolean;
  existingSouhait?: Record<string, unknown> | null;
} = {}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'gd_structures') {
      return {
        select: () => ({
          eq: () => ({
            single: () => ({
              data: opts.structureExists ? { id: 'struct_123' } : null,
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === 'gd_souhaits') {
      return {
        select: () => ({
          eq: (_col1: string, val1: unknown) => ({
            eq: (_col2: string, val2: unknown) => ({
              single: () => ({
                data: opts.existingSouhait || null,
                error: opts.existingSouhait ? null : { code: 'PGRST116' },
              }),
            }),
          }),
        }),
        insert: (data: Record<string, unknown>) => ({
          select: () => ({
            single: () => ({
              data: {
                id: 'souhait_new_123',
                educateur_token: 'edu_tok_abc',
                suivi_token_kid: 'kid_tok_xyz',
              },
              error: null,
            }),
          }),
        }),
        update: (data: Record<string, unknown>) => ({
          eq: () => ({ error: null }),
        }),
      };
    }
    return { select: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) }) };
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/souhaits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Validation ──────────────────────────────────────────────────────

  it('retourne 400 si champs obligatoires manquants', async () => {
    const req = makeRequest({ kidPrenom: 'Lucas' }); // manque token, slug, motivation, email
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain('obligatoires');
  });

  it('retourne 400 si kidSessionToken n\'est pas un UUID', async () => {
    const req = makeRequest(validBody({ kidSessionToken: 'not-a-uuid' }));
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain('Token invalide');
  });

  it('retourne 400 si email éducateur invalide', async () => {
    const req = makeRequest(validBody({ educateurEmail: 'pas-un-email' }));
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain('Email');
  });

  // ─── Création ────────────────────────────────────────────────────────

  it('crée un souhait et retourne 201 avec id + suiviTokenKid', async () => {
    setupCreatePath({ structureExists: true });

    const req = makeRequest(validBody());
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.id).toBe('souhait_new_123');
    expect(json.suiviTokenKid).toBe('kid_tok_xyz');
  });

  it('envoie un email à l\'éducateur après création', async () => {
    setupCreatePath({ structureExists: true });

    const req = makeRequest(validBody());
    await POST(req);

    expect(mockSendSouhaitNotification).toHaveBeenCalledTimes(1);
    expect(mockSendSouhaitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        educateurEmail: 'marie.dupont@structure-sociale.fr',
        kidPrenom: 'Lucas',
        lienReponse: expect.stringContaining('/educateur/souhait/edu_tok_abc'),
      })
    );
  });

  // ─── Domaine structure ───────────────────────────────────────────────

  it('extrait structure_domain pour un email pro', async () => {
    setupCreatePath({ structureExists: false });

    const req = makeRequest(validBody({ educateurEmail: 'contact@mairie-lyon.fr' }));
    const res = await POST(req);

    expect(res.status).toBe(201);
    // Vérifie que gd_structures a été interrogé avec le domaine
    expect(mockFrom).toHaveBeenCalledWith('gd_structures');
  });

  it('ne cherche pas de structure pour un email générique (gmail)', async () => {
    setupCreatePath();

    const req = makeRequest(validBody({ educateurEmail: 'marie@gmail.com' }));
    const res = await POST(req);

    expect(res.status).toBe(201);
    // gd_structures ne devrait pas être appelé (domaine générique)
    const structureCalls = mockFrom.mock.calls.filter(
      (call: unknown[]) => call[0] === 'gd_structures'
    );
    expect(structureCalls).toHaveLength(0);
  });

  // ─── Doublons ────────────────────────────────────────────────────────

  it('doublon non-traité (emis) → mise à jour + email renvoyé', async () => {
    setupCreatePath({
      existingSouhait: {
        id: 'souhait_existing',
        status: 'emis',
        educateur_token: 'edu_tok_old',
      },
    });

    const req = makeRequest(validBody());
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe('souhait_existing');
    expect(json.updated).toBe(true);
    expect(mockSendSouhaitNotification).toHaveBeenCalledTimes(1);
  });

  it('doublon déjà validé → pas de mise à jour', async () => {
    setupCreatePath({
      existingSouhait: {
        id: 'souhait_validated',
        status: 'valide',
        educateur_token: 'edu_tok_done',
      },
    });

    const req = makeRequest(validBody());
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.updated).toBe(false);
    expect(json.message).toContain('déjà traité');
    expect(mockSendSouhaitNotification).not.toHaveBeenCalled();
  });
});
