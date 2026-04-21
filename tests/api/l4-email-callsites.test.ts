/**
 * @jest-environment node
 *
 * Tests Lot L4/6 — callsites critiques email → EmailResult.
 *
 * Couverture :
 *   1. POST /api/auth/educator-invite
 *      - email sent=true → 200 success
 *      - email sent=false → 502 EMAIL_FAILED + logEmailFailure appelé
 *      - aucune PII dans le resourceId passé au logger
 *   2. POST /api/admin/inscriptions/manual
 *      - email CDS sent=false → 201 + warnings[] + logEmailFailure appelé
 *      - email CDS sent=true → 201 sans warnings
 *      - email suivi sent=false → warnings[cds+suivi] si les 2 KO
 *
 * Les tests inscriptions (email_status) sont couverts via mock dédié
 * dans tests/api/inscriptions.test.ts (validation Zod rejette avant d'atteindre
 * l'email — scénario email_status nécessite test d'intégration DB réelle, skippé).
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake';
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-key!';

// ── Mocks ────────────────────────────────────────────────────────────────────

const sendEducatorInviteEmailMock = jest.fn();
const sendChefDeServiceInvitationMock = jest.fn();
const sendInscriptionConfirmationMock = jest.fn();
const logEmailFailureMock = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/email', () => ({
  sendEducatorInviteEmail: (...args: unknown[]) => sendEducatorInviteEmailMock(...args),
  sendChefDeServiceInvitation: (...args: unknown[]) => sendChefDeServiceInvitationMock(...args),
  sendInscriptionConfirmation: (...args: unknown[]) => sendInscriptionConfirmationMock(...args),
}));

jest.mock('@/lib/email-logger', () => ({
  logEmailFailure: (...args: unknown[]) => logEmailFailureMock(...args),
}));

jest.mock('@/lib/rate-limit', () => ({
  isRateLimited: jest.fn().mockResolvedValue(false),
  getClientIpFromHeaders: jest.fn().mockReturnValue('127.0.0.1'),
}));

jest.mock('@/lib/auth-middleware', () => ({
  requireEditor: jest.fn().mockResolvedValue({ userId: 'editor-1', email: 'editor@ged.fr', role: 'EDITOR' }),
}));

// Supabase admin avec chaînes configurables par test
const mockFrom = jest.fn();
jest.mock('@/lib/supabase-server', () => ({
  getSupabaseAdmin: () => ({ from: mockFrom }),
  getSupabase: () => ({ from: mockFrom }),
  getSupabaseUser: () => ({ from: mockFrom }),
}));

jest.mock('@/lib/audit-log', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
  getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
}));

import { NextRequest } from 'next/server';

// ── Helpers ──────────────────────────────────────────────────────────────────

function jsonReq(url: string, body: object): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer fake-token' },
    body: JSON.stringify(body),
  });
}

// ── Tests — POST /api/auth/educator-invite ───────────────────────────────────

import { POST as educatorInvitePOST } from '@/app/api/auth/educator-invite/route';

describe('POST /api/auth/educator-invite — L4 email_result', () => {
  const VALID_BODY = {
    email: 'educ@example.com',
    sejour_slug: 'alpoo-kids',
    session_date: '2026-07-08',
    city_departure: 'Paris',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Chaîne : .from('gd_session_prices').select().eq().eq().eq().single()
    // puis  : .from('gd_stays').select().eq().single()
    // Supabase mock — 2 appels séquentiels (price puis stay)
    let callIdx = 0;
    mockFrom.mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) {
        // price lookup
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({
                    data: { price_ged_total: 600, stay_slug: 'alpoo-kids', start_date: '2026-07-08', city_departure: 'Paris' },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      // stays lookup
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: { marketing_title: 'Alpoo Kids' }, error: null }),
          }),
        }),
      };
    });
  });

  it('happy path : email sent=true → 200 success', async () => {
    sendEducatorInviteEmailMock.mockResolvedValueOnce({ sent: true, messageId: 'msg-123' });

    const res = await educatorInvitePOST(jsonReq('/api/auth/educator-invite', VALID_BODY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(logEmailFailureMock).not.toHaveBeenCalled();
  });

  it('email KO (provider_error) → 502 EMAIL_FAILED + logEmailFailure appelé', async () => {
    sendEducatorInviteEmailMock.mockResolvedValueOnce({ sent: false, reason: 'provider_error' });

    const res = await educatorInvitePOST(jsonReq('/api/auth/educator-invite', VALID_BODY));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.code).toBe('EMAIL_FAILED');
    expect(body.error.message).toMatch(/lien d'invitation/i);

    expect(logEmailFailureMock).toHaveBeenCalledTimes(1);
    const [context, result, resourceType, resourceId] = logEmailFailureMock.mock.calls[0];
    expect(context).toBe('educator_invite');
    expect(result).toEqual({ sent: false, reason: 'provider_error' });
    expect(resourceType).toBe('educator_invitation');
    // Anti-PII : resourceId doit PAS contenir l'email
    expect(resourceId).not.toContain('educ@example.com');
    expect(resourceId).toContain('alpoo-kids');
  });

  it('email KO (missing_api_key) → 502 et reason propagé dans logEmailFailure', async () => {
    sendEducatorInviteEmailMock.mockResolvedValueOnce({ sent: false, reason: 'missing_api_key' });

    const res = await educatorInvitePOST(jsonReq('/api/auth/educator-invite', VALID_BODY));
    expect(res.status).toBe(502);
    expect(logEmailFailureMock).toHaveBeenCalledTimes(1);
    const [, result] = logEmailFailureMock.mock.calls[0];
    expect(result.reason).toBe('missing_api_key');
  });
});

// ── Tests — POST /api/admin/inscriptions/manual ──────────────────────────────

import { POST as adminManualPOST } from '@/app/api/admin/inscriptions/manual/route';

describe('POST /api/admin/inscriptions/manual — L4 warnings[]', () => {
  const VALID_BODY = {
    childFirstName: 'Léo',
    childLastName: 'Martin',
    childBirthDate: '2015-05-10',
    staySlug: 'alpoo-kids',
    sessionDate: '2026-07-08',
    cityDeparture: 'Paris',
    referentNom: 'Alice',
    referentEmail: 'alice@structure.fr',
    referentTel: '0612345678',
    structureName: 'Structure Test',
    structurePostalCode: '75001',
    structureCity: 'Paris',
    priceTotal: 600,
    paymentMethod: 'transfer',
    sendSuiviLink: true,
    chefDeServiceEmail: 'cds@structure.fr',
  };

  const setupHappyPathDbChain = () => {
    // Séquence d'appels mockFrom :
    //  1. gd_stays (lookup) → { data: [{ slug, marketing_title }] }
    //  2. gd_inscriptions (anti-doublon) → { data: null }
    //  3. gd_structures (lookup by code) → NO-OP (pas de code dans body)
    //  4. gd_structures (lookup by name+cp) → { data: null }
    //  5. gd_structures (insert) → { data: { id, code } }
    //  6. gd_inscriptions (insert) → { data: { id, suivi_token, ... } }
    let idx = 0;
    mockFrom.mockImplementation((_table: string) => {
      idx++;
      switch (idx) {
        case 1: // gd_stays
          return {
            select: () => ({
              eq: () => ({
                limit: () => Promise.resolve({ data: [{ slug: 'alpoo-kids', marketing_title: 'Alpoo Kids' }], error: null }),
              }),
            }),
          };
        case 2: // gd_inscriptions anti-doublon
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      not: () => ({
                        maybeSingle: () => Promise.resolve({ data: null, error: null }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        case 3: // gd_structures lookup by name+cp (pas de code dans body)
          return {
            select: () => ({
              ilike: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          };
        case 4: // gd_structures insert
          return {
            insert: () => ({
              select: () => ({
                single: () => Promise.resolve({
                  data: { id: 'struct-uuid-123', code: 'ABC123' },
                  error: null,
                }),
              }),
            }),
          };
        case 5: // gd_inscriptions insert
          return {
            insert: () => ({
              select: () => ({
                single: () => Promise.resolve({
                  data: {
                    id: 'insc-uuid-456',
                    suivi_token: 'suivi-abc',
                    status: 'validee',
                    payment_status: 'paid',
                  },
                  error: null,
                }),
              }),
            }),
          };
        default:
          throw new Error(`[test] unexpected mockFrom call #${idx}`);
      }
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('happy path : tous emails sent → 201 sans warnings', async () => {
    setupHappyPathDbChain();
    sendChefDeServiceInvitationMock.mockResolvedValueOnce({ sent: true, messageId: 'm1' });
    sendInscriptionConfirmationMock.mockResolvedValueOnce({ sent: true, messageId: 'm2' });

    const res = await adminManualPOST(jsonReq('/api/admin/inscriptions/manual', VALID_BODY));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('insc-uuid-456');
    expect(body.warnings).toBeUndefined();
    expect(logEmailFailureMock).not.toHaveBeenCalled();
  });

  it('email CDS KO → 201 + warnings[cds_invitation] + logEmailFailure', async () => {
    setupHappyPathDbChain();
    sendChefDeServiceInvitationMock.mockResolvedValueOnce({ sent: false, reason: 'provider_error' });
    sendInscriptionConfirmationMock.mockResolvedValueOnce({ sent: true, messageId: 'm2' });

    const res = await adminManualPOST(jsonReq('/api/admin/inscriptions/manual', VALID_BODY));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.warnings).toEqual([
      { type: 'email_failed', context: 'cds_invitation', reason: 'provider_error' },
    ]);
    expect(logEmailFailureMock).toHaveBeenCalledWith(
      'admin_manual_cds_invite',
      { sent: false, reason: 'provider_error' },
      'structure',
      'struct-uuid-123',
    );
  });

  it('email suivi KO + CDS KO → 201 + warnings[2]', async () => {
    setupHappyPathDbChain();
    sendChefDeServiceInvitationMock.mockResolvedValueOnce({ sent: false, reason: 'missing_api_key' });
    sendInscriptionConfirmationMock.mockResolvedValueOnce({ sent: false, reason: 'provider_error' });

    const res = await adminManualPOST(jsonReq('/api/admin/inscriptions/manual', VALID_BODY));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.warnings).toHaveLength(2);
    expect(body.warnings).toEqual(
      expect.arrayContaining([
        { type: 'email_failed', context: 'cds_invitation', reason: 'missing_api_key' },
        { type: 'email_failed', context: 'suivi_link', reason: 'provider_error' },
      ])
    );
    expect(logEmailFailureMock).toHaveBeenCalledTimes(2);
  });
});
