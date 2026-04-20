/**
 * @jest-environment node
 *
 * Tests unitaires — PATCH /api/dossier-enfant/[inscriptionId]
 * Scope : signature électronique simple (SES eIDAS) — vague C#3 (2026-04-19).
 *
 * Cas couverts :
 *  S1. Signature canvas + qualité + completed=true → 200 + persist metadata
 *      (bulletin_signed_at, _signed_ip, _signer_qualite, _signature_hash,
 *       consent_text_version) SANS exiger d'upload PDF.
 *  S2. Signature canvas SANS qualité → 400 INVALID_SIGNER_QUALITE.
 *  S3. Signature identique à l'existante → pas de re-persist metadata.
 *  S4. PATCH sans champ signature → pas de metadata persistée.
 *  S5. Signature sur fiche_renseignements (bloc non signable) → pas de metadata.
 *  S6. Qualité invalide (hors enum) → 400.
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

jest.mock('@/lib/verify-ownership', () => ({
  verifyOwnership: jest.fn().mockResolvedValue({
    ok: true,
    referentEmail: 'ref@test.fr',
    status: 200,
  }),
}));

jest.mock('@/lib/audit-log', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
  getClientIp: jest.fn().mockReturnValue('10.0.0.1'),
}));

import { NextRequest } from 'next/server';
import { PATCH } from '@/app/api/dossier-enfant/[inscriptionId]/route';

const INSCRIPTION_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const TOKEN = 'bbbbbbbb-0000-0000-0000-000000000001';
// PNG 1×1 valide en base64 (fait ~80 octets — passe validateBase64Image)
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=';

function makeReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/dossier-enfant/${INSCRIPTION_ID}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: TOKEN, ...body }),
    },
  );
}

function params() {
  return { params: Promise.resolve({ inscriptionId: INSCRIPTION_ID }) };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFromChain.select.mockReturnThis();
  mockFromChain.eq.mockReturnThis();
  mockFromChain.is.mockReturnThis();
  mockFromChain.insert.mockReturnThis();
  mockFromChain.update.mockReturnThis();
  mockFromChain.maybeSingle.mockReset();
  mockFromChain.single.mockReset();
});

describe('PATCH /api/dossier-enfant/[inscriptionId] — signature SES eIDAS (C#3)', () => {
  it('S1 — signature + qualité + completed=true → 200 + persist metadata (insert)', async () => {
    // pas de dossier existant → insert
    mockFromChain.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null }) // existing dossier
      .mockResolvedValueOnce({ data: { documents_requis: [] }, error: null }); // gd_stays
    let insertPayload: Record<string, unknown> = {};
    mockFromChain.insert.mockImplementation((payload: Record<string, unknown>) => {
      insertPayload = payload;
      return mockFromChain;
    });
    mockFromChain.single
      .mockResolvedValueOnce({ data: { sejour_slug: 'slug-x' }, error: null }) // gd_inscriptions
      .mockResolvedValueOnce({ data: { id: 'dos-1' }, error: null }); // insert result

    const res = await PATCH(
      makeReq({
        bloc: 'bulletin_complement',
        data: {
          autorisation_accepte: true,
          signature_image_url: TINY_PNG,
          signer_qualite: 'responsable_legal',
        },
        completed: true,
      }),
      params(),
    );

    expect(res.status).toBe(200);
    expect(insertPayload.bulletin_signed_at).toBeTruthy();
    expect(insertPayload.bulletin_signed_ip).toBe('10.0.0.1');
    expect(insertPayload.bulletin_signer_qualite).toBe('responsable_legal');
    expect(insertPayload.bulletin_signature_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(insertPayload.consent_text_version).toBe('v2026-04');
    expect(insertPayload.bulletin_completed).toBe(true);
  });

  it('S2 — signature SANS qualité → 400 INVALID_SIGNER_QUALITE', async () => {
    mockFromChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const res = await PATCH(
      makeReq({
        bloc: 'fiche_sanitaire',
        data: { signature_image_url: TINY_PNG },
      }),
      params(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_SIGNER_QUALITE');
    // Aucun insert DB ne doit avoir été tenté
    expect(mockFromChain.insert).not.toHaveBeenCalled();
  });

  it('S3 — signature identique à existante → no-op metadata (update, pas de re-persist)', async () => {
    // dossier existant avec même signature déjà en place
    mockFromChain.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'dos-1',
        fiche_sanitaire: { signature_image_url: TINY_PNG, poids: '40' },
      },
      error: null,
    });
    let updatePayload: Record<string, unknown> = {};
    mockFromChain.update.mockImplementation((payload: Record<string, unknown>) => {
      updatePayload = payload;
      return mockFromChain;
    });
    mockFromChain.single.mockResolvedValueOnce({
      data: { id: 'dos-1' },
      error: null,
    });

    const res = await PATCH(
      makeReq({
        bloc: 'fiche_sanitaire',
        data: {
          signature_image_url: TINY_PNG, // identique
          taille: '160', // nouveau champ
        },
      }),
      params(),
    );
    expect(res.status).toBe(200);
    expect(updatePayload.sanitaire_signed_at).toBeUndefined();
    expect(updatePayload.sanitaire_signature_hash).toBeUndefined();
    expect(updatePayload.sanitaire_signer_qualite).toBeUndefined();
  });

  it('S4 — PATCH sans signature → pas de metadata persistée', async () => {
    mockFromChain.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null }) // existing dossier
      .mockResolvedValueOnce({ data: { documents_requis: [] }, error: null });
    let insertPayload: Record<string, unknown> = {};
    mockFromChain.insert.mockImplementation((payload: Record<string, unknown>) => {
      insertPayload = payload;
      return mockFromChain;
    });
    mockFromChain.single
      .mockResolvedValueOnce({ data: { sejour_slug: 'slug-x' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'dos-1' }, error: null });

    const res = await PATCH(
      makeReq({
        bloc: 'bulletin_complement',
        data: { contact_urgence_nom: 'Marie' },
      }),
      params(),
    );
    expect(res.status).toBe(200);
    expect(insertPayload.bulletin_signed_at).toBeUndefined();
    expect(insertPayload.bulletin_signer_qualite).toBeUndefined();
  });

  it('S5 — signature sur fiche_renseignements (non signable) → pas de metadata', async () => {
    mockFromChain.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { documents_requis: [] }, error: null });
    let insertPayload: Record<string, unknown> = {};
    mockFromChain.insert.mockImplementation((payload: Record<string, unknown>) => {
      insertPayload = payload;
      return mockFromChain;
    });
    mockFromChain.single
      .mockResolvedValueOnce({ data: { sejour_slug: 'slug-x' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'dos-1' }, error: null });

    const res = await PATCH(
      makeReq({
        bloc: 'fiche_renseignements',
        data: { signature_image_url: TINY_PNG, signer_qualite: 'responsable_legal' },
      }),
      params(),
    );
    expect(res.status).toBe(200);
    // fiche_renseignements n'a pas de colonnes signature → rien ne doit être écrit
    const hasAnySigMeta = Object.keys(insertPayload).some(k => k.includes('signed_') || k.includes('signer_qualite') || k === 'consent_text_version');
    expect(hasAnySigMeta).toBe(false);
  });

  it('S6 — qualité hors enum → 400 INVALID_SIGNER_QUALITE', async () => {
    mockFromChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const res = await PATCH(
      makeReq({
        bloc: 'fiche_liaison_jeune',
        data: { signature_image_url: TINY_PNG, signer_qualite: 'grand_mere' },
      }),
      params(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_SIGNER_QUALITE');
  });
});
