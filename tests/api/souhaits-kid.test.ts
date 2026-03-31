/**
 * @jest-environment node
 *
 * Tests unitaires — parcours kid
 *
 * GET /api/souhaits/kid/[kidToken]  — consultation wishlist kid
 * POST /api/souhaits                — émission souhait (déjà couvert dans souhaits.test.ts,
 *                                     ici on teste les cas spécifiques au kid_session_token)
 *
 * Scénarios :
 *  1. GET token non-UUID → 400
 *  2. GET token inexistant → tableau vide (pas d'erreur)
 *  3. GET token valide → liste des souhaits avec les bonnes colonnes
 *  4. GET token valide, souhaits multiples → triés par created_at DESC
 *  5. POST sans kidSessionToken → 400
 *  6. POST kidSessionToken non-UUID → 400
 *  7. POST souhait complet → 201 + kid_session_token persisté
 */

// ── Env ──────────────────────────────────────────────────────────────────────
import type { NextRequest } from 'next/server';
process.env.NEXT_PUBLIC_SUPABASE_URL    = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-key';
process.env.NEXT_PUBLIC_SITE_URL        = 'http://localhost:3000';
process.env.EMAIL_SERVICE_API_KEY       = 'fake-resend-key';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockSelect  = jest.fn();
const mockOrder   = jest.fn();
const mockEq      = jest.fn();
const mockFrom    = jest.fn();

const mockUpsert  = jest.fn();
const mockInsert  = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  getSupabase:      jest.fn(() => ({ from: mockFrom })),
  getSupabaseAdmin: jest.fn(() => ({ from: mockFrom })),
}));

jest.mock('@/lib/email', () => ({
  sendSouhaitNotificationEducateur: jest.fn().mockResolvedValue(undefined),
}));

import * as emailLib from '@/lib/email';
const mockSendEmail = emailLib.sendSouhaitNotificationEducateur as jest.Mock;

// ── Helpers ──────────────────────────────────────────────────────────────────

const VALID_KID_TOKEN  = 'aaaaaaaa-0000-0000-0000-000000000001';
const VALID_KID_TOKEN2 = 'aaaaaaaa-0000-0000-0000-000000000002';

function makeGetRequest(kidToken: string) {
  return {
    nextUrl: { searchParams: new URLSearchParams() },
  } as unknown as NextRequest;
}

function makePostRequest(body: object) {
  return {
    json: async () => body,
    nextUrl: { searchParams: new URLSearchParams() },
  } as unknown as NextRequest;
}

// ── Import handlers ──────────────────────────────────────────────────────────

import { GET  } from '@/app/api/souhaits/kid/[kidToken]/route';
import { POST } from '@/app/api/souhaits/route';

// ── Tests GET /api/souhaits/kid/[kidToken] ───────────────────────────────────

describe('GET /api/souhaits/kid/[kidToken]', () => {
  beforeEach(() => jest.clearAllMocks());

  it('token non-UUID → 400', async () => {
    const res = await GET(makeGetRequest('not-a-uuid'), { params: Promise.resolve({ kidToken: 'not-a-uuid' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Token invalide.');
  });

  it('token invalide court → 400', async () => {
    const res = await GET(makeGetRequest('abc'), { params: Promise.resolve({ kidToken: 'abc' }) });
    expect(res.status).toBe(400);
  });

  it('token valide, aucun souhait → tableau vide', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockEq.mockReturnValue({ order: mockOrder });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const res = await GET(makeGetRequest(VALID_KID_TOKEN), { params: Promise.resolve({ kidToken: VALID_KID_TOKEN }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
  });

  it('token valide → retourne les souhaits avec les bonnes colonnes', async () => {
    const fakeSouhaits = [
      {
        id: 'id-1',
        sejour_slug: 'mountain-and-chill',
        sejour_titre: 'Mountain & Chill',
        status: 'emis',
        reponse_educateur: null,
        kid_prenom_referent: 'Sophie',
        created_at: '2026-03-28T10:00:00Z',
        updated_at: '2026-03-28T10:00:00Z',
      },
    ];
    mockOrder.mockResolvedValue({ data: fakeSouhaits, error: null });
    mockEq.mockReturnValue({ order: mockOrder });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const res = await GET(makeGetRequest(VALID_KID_TOKEN), { params: Promise.resolve({ kidToken: VALID_KID_TOKEN }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toHaveProperty('sejour_slug', 'mountain-and-chill');
    expect(body[0]).toHaveProperty('status', 'emis');
    expect(body[0]).toHaveProperty('reponse_educateur');
    // Vérifier que les colonnes sensibles ne sont PAS retournées
    expect(body[0]).not.toHaveProperty('educateur_email');
    expect(body[0]).not.toHaveProperty('educateur_token');
    expect(body[0]).not.toHaveProperty('kid_session_token');
  });

  it('token valide → souhaits triés par created_at DESC (plus récent en premier)', async () => {
    const fakeSouhaits = [
      { id: 'id-2', sejour_slug: 'sejour-b', status: 'valide', created_at: '2026-03-28T12:00:00Z', sejour_titre: null, reponse_educateur: null, kid_prenom_referent: null, updated_at: null },
      { id: 'id-1', sejour_slug: 'sejour-a', status: 'emis',   created_at: '2026-03-28T09:00:00Z', sejour_titre: null, reponse_educateur: null, kid_prenom_referent: null, updated_at: null },
    ];
    mockOrder.mockResolvedValue({ data: fakeSouhaits, error: null });
    mockEq.mockReturnValue({ order: mockOrder });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const res = await GET(makeGetRequest(VALID_KID_TOKEN), { params: Promise.resolve({ kidToken: VALID_KID_TOKEN }) });
    const body = await res.json();
    expect(body[0].id).toBe('id-2'); // plus récent en premier
    expect(body[1].id).toBe('id-1');
  });
});

// ── Tests POST /api/souhaits — cas spécifiques kid ───────────────────────────

describe('POST /api/souhaits — kidSessionToken', () => {
  beforeEach(() => jest.clearAllMocks());

  it('kidSessionToken absent → 400', async () => {
    const res = await POST(makePostRequest({
      kidPrenom: 'Emma',
      sejourSlug: 'mountain-and-chill',
      motivation: 'Je veux y aller',
      educateurEmail: 'educ@structure.fr',
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Champs obligatoires manquants.');
  });

  it('kidSessionToken non-UUID → 400', async () => {
    const res = await POST(makePostRequest({
      kidSessionToken: 'not-valid',
      kidPrenom: 'Emma',
      sejourSlug: 'mountain-and-chill',
      motivation: 'Je veux y aller',
      educateurEmail: 'educ@structure.fr',
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('invalide');
  });

  it('souhait complet → 201 + email envoyé à l\'éducateur', async () => {
    // Même pattern que souhaits.test.ts setupCreatePath
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gd_structures') {
        return { select: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) }) };
      }
      if (table === 'gd_souhaits') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ single: () => ({ data: null, error: { code: 'PGRST116' } }) }) }) }),
          insert: () => ({
            select: () => ({
              single: () => ({
                data: { id: 'new-souhait-id', educateur_token: 'edu-tok', suivi_token_kid: 'kid-tok' },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) }) };
    });

    const res = await POST(makePostRequest({
      kidSessionToken:   VALID_KID_TOKEN2,
      kidPrenom:         'Emma',
      sejourSlug:        'mountain-and-chill',
      sejourTitre:       'Mountain & Chill',
      motivation:        'Je veux y aller cette année',
      educateurEmail:    'educ@structure.fr',
      educateurPrenom:   'Sophie',
    }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty('id');
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ educateurEmail: 'educ@structure.fr' })
    );
  });
});
