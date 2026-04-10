/**
 * @jest-environment node
 *
 * Tests intégration API — GET+PATCH /api/suivi/[token]
 *
 * Accès par magic-link (suivi_token UUID) — pas d'auth JWT classique.
 * Sécurité critique : isolation inter-référents, whitelist champs éditables.
 *
 * Scénarios :
 *  1. GET token non-UUID → 400
 *  2. GET token UUID inconnu → 404
 *  3. GET token valide → 200 + dossiers du référent uniquement
 *  4. PATCH champ non autorisé → 403 (whitelist)
 *  5. PATCH inscription d'un autre référent → 403 (isolation)
 *  6. PATCH champ valide (pref_nouvelles_sejour) → 200
 *  7. PATCH token non-UUID → 400
 *  8. PATCH inscriptionId manquant → 400
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
import { GET, PATCH } from '@/app/api/suivi/[token]/route';

// ── Constants ─────────────────────────────────────────────────────────────────

const VALID_TOKEN = 'bbb00000-0000-0000-0000-000000000001';
const INSCRIPTION_ID = 'ccc00000-0000-0000-0000-000000000002';
const OTHER_INSCRIPTION_ID = 'ddd00000-0000-0000-0000-000000000003';

const SAMPLE_INSCRIPTION = {
  id: INSCRIPTION_ID,
  dossier_ref: 'GED-2026-001',
  sejour_slug: 'sejour-alpes',
  session_date: '2026-07-08',
  city_departure: 'Paris',
  jeune_prenom: 'Léo',
  jeune_nom: 'Martin',
  organisation: 'CAF Paris',
  referent_nom: 'Alice Dupont',
  price_total: 350,
  status: 'en_attente',
  payment_status: 'pending_payment',
  payment_method: 'stripe',
  payment_reference: null,
  options_educatives: null,
  documents_status: null,
  besoins_pris_en_compte: false,
  equipe_informee: false,
  note_pro: null,
  pref_nouvelles_sejour: null,
  pref_canal_contact: null,
  pref_bilan_fin_sejour: null,
  consignes_communication: null,
  besoins_specifiques: null,
  created_at: '2026-03-01T10:00:00Z',
  updated_at: '2026-03-01T10:00:00Z',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGetRequest(token: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/suivi/${token}`);
}

function makePatchRequest(token: string, body: object): NextRequest {
  return new NextRequest(`http://localhost:3000/api/suivi/${token}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Tests — GET ───────────────────────────────────────────────────────────────

describe('GET /api/suivi/[token]', () => {
  it('retourne 400 si token non-UUID', async () => {
    const res = await GET(makeGetRequest('not-a-uuid'), { params: Promise.resolve({ token: 'not-a-uuid' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_TOKEN');
  });

  it('retourne 404 si token UUID inconnu', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
          }),
          single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
        }),
      }),
    });
    const res = await GET(makeGetRequest(VALID_TOKEN), { params: Promise.resolve({ token: VALID_TOKEN }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('retourne 200 avec les dossiers du référent (isolation par email)', async () => {
    // verifyToken(renew:true) flow:
    //   call 1 — select.eq.is.single (token lookup)
    //   call 2 — update.eq (renew expiration, fire-and-forget)
    // GET dossiers flow:
    //   call 3 — select.eq.is.order (all dossiers)
    //   call 4 — gd_stays select.in
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gd_inscriptions') {
        callCount++;
        if (callCount === 1) {
          // Token lookup
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                is: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { referent_email: 'ref@structure.fr', organisation: 'CAF Paris', suivi_token_expires_at: null },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (callCount === 2) {
          // Renew update (fire-and-forget, result not used)
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        // All dossiers for this referent
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              is: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: [SAMPLE_INSCRIPTION], error: null }),
              }),
            }),
          }),
        };
      }
      // gd_stays
      return {
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: [{ slug: 'sejour-alpes', marketing_title: 'Alpes Aventure' }],
            error: null,
          }),
        }),
      };
    });

    const res = await GET(makeGetRequest(VALID_TOKEN), { params: Promise.resolve({ token: VALID_TOKEN }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dossiers).toHaveLength(1);
    expect(body.dossiers[0].jeunePrenom).toBe('Léo');
    expect(body.referent.email).toBe('ref@structure.fr');
    // Le champ raw referent_email ne doit pas être exposé dans les dossiers
    expect(body.dossiers[0].referent_email).toBeUndefined();
  });
});

// ── Tests — PATCH ─────────────────────────────────────────────────────────────

describe('PATCH /api/suivi/[token]', () => {
  it('retourne 400 si token non-UUID', async () => {
    const res = await PATCH(
      makePatchRequest('bad-token', { inscriptionId: INSCRIPTION_ID, field: 'pref_nouvelles_sejour', value: 'oui' }),
      { params: Promise.resolve({ token: 'bad-token' }) }
    );
    expect(res.status).toBe(400);
  });

  it('retourne 400 si inscriptionId manquant', async () => {
    const res = await PATCH(
      makePatchRequest(VALID_TOKEN, { field: 'pref_nouvelles_sejour', value: 'oui' }),
      { params: Promise.resolve({ token: VALID_TOKEN }) }
    );
    expect(res.status).toBe(400);
  });

  it('retourne 403 si champ non dans la whitelist (field injection)', async () => {
    const res = await PATCH(
      makePatchRequest(VALID_TOKEN, {
        inscriptionId: INSCRIPTION_ID,
        field: 'status',  // champ admin — non autorisé au référent
        value: 'validee',
      }),
      { params: Promise.resolve({ token: VALID_TOKEN }) }
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FIELD_NOT_ALLOWED');
  });

  it('retourne 403 si inscription appartient à un autre référent (isolation)', async () => {
    let selectCall = 0;
    mockFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            single: jest.fn().mockImplementation(() => {
              selectCall++;
              if (selectCall === 1) {
                // Token source → referent A
                return Promise.resolve({ data: { referent_email: 'refA@structure.fr', suivi_token_expires_at: null }, error: null });
              }
              // Inscription cible → referent B (différent !)
              return Promise.resolve({ data: { referent_email: 'refB@other.fr' }, error: null });
            }),
          }),
          single: jest.fn().mockImplementation(() => {
            selectCall++;
            if (selectCall === 1) {
              return Promise.resolve({ data: { referent_email: 'refA@structure.fr', suivi_token_expires_at: null }, error: null });
            }
            return Promise.resolve({ data: { referent_email: 'refB@other.fr' }, error: null });
          }),
        }),
      }),
    }));

    const res = await PATCH(
      makePatchRequest(VALID_TOKEN, {
        inscriptionId: OTHER_INSCRIPTION_ID,
        field: 'pref_nouvelles_sejour',
        value: 'oui',
      }),
      { params: Promise.resolve({ token: VALID_TOKEN }) }
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('retourne 200 si champ valide mis à jour par le référent propriétaire', async () => {
    // verifyOwnership flow (no renew):
    //   call 1 — select.eq.is.single (token source lookup)
    //   call 2 — select.eq.is.single (target inscription lookup)
    // update flow:
    //   call 3 — update.eq.is (field update)
    mockFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { referent_email: 'ref@structure.fr', suivi_token_expires_at: null },
              error: null,
            }),
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockResolvedValue({ error: null }),
        }),
      }),
    }));

    const res = await PATCH(
      makePatchRequest(VALID_TOKEN, {
        inscriptionId: INSCRIPTION_ID,
        field: 'pref_nouvelles_sejour',
        value: 'oui',
      }),
      { params: Promise.resolve({ token: VALID_TOKEN }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.field).toBe('pref_nouvelles_sejour');
    expect(body.value).toBe('oui');
  });
});
