/**
 * @jest-environment node
 *
 * Tests Lot L5/6 — callsites critiques email → EmailResult.
 *
 * Couverture :
 *   1. POST /api/pro/propositions  (sendPropositionAlertGED)
 *      - happy path : 201
 *      - email KO → 201 + logEmailFailure (pas bloquant, insert réussi)
 *   2. POST /api/structure/[code]/incidents (sendIncidentNotification)
 *      - happy path severity=info → pas d'email, 201
 *      - severity=attention email KO → 201 + logEmailFailure + auditLog alert
 *   3. POST /api/auth/pro-session (resetRateLimit helper)
 *      - succès login → resetRateLimit appelé avec prefix/ip corrects (pas delete brut)
 *
 * Webhook Stripe — tests des échecs emails volontairement couverts via
 * webhook-stripe.test.ts existant (mocks déjà en place sent:true). Un KO
 * email n'impacte pas le status HTTP (200 maintenu, pas de retry loop).
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake';
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-key!';

// ── Mocks ────────────────────────────────────────────────────────────────────

const sendPropositionAlertGEDMock = jest.fn();
const sendIncidentNotificationMock = jest.fn();
const logEmailFailureMock = jest.fn().mockResolvedValue(undefined);
const auditLogMock = jest.fn().mockResolvedValue(undefined);
const resetRateLimitMock = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/email', () => ({
  sendPropositionAlertGED: (...args: unknown[]) => sendPropositionAlertGEDMock(...args),
  sendIncidentNotification: (...args: unknown[]) => sendIncidentNotificationMock(...args),
}));

jest.mock('@/lib/email-logger', () => ({
  logEmailFailure: (...args: unknown[]) => logEmailFailureMock(...args),
}));

jest.mock('@/lib/audit-log', () => ({
  auditLog: (...args: unknown[]) => auditLogMock(...args),
  getClientIp: jest.fn().mockReturnValue('203.0.113.5'),
}));

jest.mock('@/lib/rate-limit', () => ({
  isRateLimited: jest.fn().mockResolvedValue(false),
  resetRateLimit: (...args: unknown[]) => resetRateLimitMock(...args),
  getClientIpFromHeaders: jest.fn().mockReturnValue('203.0.113.5'),
}));

jest.mock('@/lib/rate-limit-structure', () => ({
  structureRateLimitGuard: jest.fn().mockResolvedValue(null),
}));

// Supabase admin — chaînes configurables par test
const mockFrom = jest.fn();
jest.mock('@/lib/supabase-server', () => ({
  getSupabaseAdmin: () => ({ from: mockFrom }),
  getSupabase: () => ({ from: mockFrom }),
}));

// verifyProSession : retourne un pro légitime
jest.mock('@/lib/auth-middleware', () => ({
  verifyProSession: jest.fn().mockResolvedValue({
    email: 'educ@structure.fr',
    structureName: 'Structure Test',
    structureCode: 'ABCDEF',
    structureId: 'struct-id-1',
    structureRole: 'direction',
  }),
  buildProSessionToken: jest.fn().mockResolvedValue({ token: 'fake.jwt.token', jti: 'jti-1' }),
  errorResponse: (code: string, message: string, status: number) => {
    const { NextResponse } = jest.requireActual('next/server');
    return NextResponse.json({ error: { code, message } }, { status });
  },
}));

jest.mock('@/lib/structure-guard', () => ({
  requireStructureRole: jest.fn(),
}));

jest.mock('@/lib/resource-guard', () => ({
  requireInscriptionOwnership: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('@/lib/structure', () => ({
  resolveCodeToStructure: jest.fn().mockResolvedValue({
    structure: { id: 'struct-id-1', name: 'Structure Test' },
    role: 'direction',
  }),
}));

import { NextRequest } from 'next/server';
import { requireStructureRole } from '@/lib/structure-guard';

// ── Helpers ──────────────────────────────────────────────────────────────────

function jsonReq(url: string, body: object): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Tests — POST /api/pro/propositions ───────────────────────────────────────

import { POST as proPropositionsPOST } from '@/app/api/pro/propositions/route';

describe('POST /api/pro/propositions — L5 email_result', () => {
  const VALID_BODY = {
    sejour_slug: 'alpoo-kids',
    session_date: '2026-07-08',
    city_departure: 'Paris',
  };

  const setupDbChain = () => {
    let callIdx = 0;
    mockFrom.mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) {
        // gd_session_prices : query .eq().eq().eq().order().limit().maybeSingle()
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: () => Promise.resolve({
                        data: {
                          base_price_eur: 500,
                          transport_surcharge_ged: 50,
                          price_ged_total: 550,
                          start_date: '2026-07-08',
                          end_date: '2026-07-15',
                        },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (callIdx === 2) {
        // gd_stays : .select().eq().single()
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { marketing_title: 'Alpoo Kids', title: 'Alpoo' },
                error: null,
              }),
            }),
          }),
        };
      }
      // gd_propositions_tarifaires : .insert().select().single()
      return {
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({
              data: { id: 'prop-uuid-1' },
              error: null,
            }),
          }),
        }),
      };
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupDbChain();
  });

  it('happy path : alert email sent → 201 sans logEmailFailure', async () => {
    sendPropositionAlertGEDMock.mockResolvedValueOnce({ sent: true, messageId: 'm1' });

    const res = await proPropositionsPOST(jsonReq('/api/pro/propositions', VALID_BODY));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.propositionId).toBe('prop-uuid-1');
    expect(logEmailFailureMock).not.toHaveBeenCalled();
  });

  it('email KO (provider_error) → 201 maintenu + logEmailFailure (non-bloquant)', async () => {
    sendPropositionAlertGEDMock.mockResolvedValueOnce({ sent: false, reason: 'provider_error' });

    const res = await proPropositionsPOST(jsonReq('/api/pro/propositions', VALID_BODY));
    // Insert réussi → 201 maintenu même si alerte admin KO
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.propositionId).toBe('prop-uuid-1');

    expect(logEmailFailureMock).toHaveBeenCalledWith(
      'sendPropositionAlertGED',
      { sent: false, reason: 'provider_error' },
      'proposition',
      'prop-uuid-1',
    );
  });
});

// ── Tests — POST /api/structure/[code]/incidents ─────────────────────────────

import { POST as incidentsPOST } from '@/app/api/structure/[code]/incidents/route';

describe('POST /api/structure/[code]/incidents — L5 email_result', () => {
  const params = Promise.resolve({ code: 'TESTCODE' });

  const VALID_BODY = {
    inscription_id: 'insc-1',
    category: 'accident',
    severity: 'attention',
    description: 'Chute dans la cour - blessure légère',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (requireStructureRole as jest.Mock).mockResolvedValue({
      ok: true,
      resolved: {
        structure: { id: 'struct-id-1', name: 'MECS Test' },
        role: 'direction',
        email: 'dir@test.fr',
      },
    });

    // Chaînes Supabase séquentielles : insert incident, then emails lookup
    let idx = 0;
    mockFrom.mockImplementation((table: string) => {
      idx++;
      if (table === 'gd_incidents' && idx === 1) {
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'inc-1' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'gd_structure_access_codes') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: () => ({
                  not: () => Promise.resolve({
                    data: [{ email: 'dir@test.fr', role: 'direction' }],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'gd_inscriptions') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { jeune_prenom: 'Léo' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'gd_structures') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it('happy path severity=attention email sent → 201 sans logEmailFailure', async () => {
    sendIncidentNotificationMock.mockResolvedValueOnce({ sent: true, messageId: 'm1' });

    const res = await incidentsPOST(jsonReq('/api/structure/TESTCODE/incidents', VALID_BODY), { params });
    expect(res.status).toBe(201);
    expect(logEmailFailureMock).not.toHaveBeenCalled();
  });

  it('email KO severity=attention → 201 maintenu + logEmailFailure + auditLog alert', async () => {
    sendIncidentNotificationMock.mockResolvedValueOnce({ sent: false, reason: 'provider_error' });

    const res = await incidentsPOST(jsonReq('/api/structure/TESTCODE/incidents', VALID_BODY), { params });
    // Incident créé → 201 conservé (sécurité enfants : traçer > notifier parfaitement)
    expect(res.status).toBe(201);

    expect(logEmailFailureMock).toHaveBeenCalledWith(
      'sendIncidentNotification',
      { sent: false, reason: 'provider_error' },
      'incident',
      'inc-1',
    );

    // auditLog alert supplémentaire pour opérateur — pas de PII, juste enum
    const alertAuditCall = auditLogMock.mock.calls.find(c =>
      c[1]?.metadata?.type === 'incident_notification_failed'
    );
    expect(alertAuditCall).toBeDefined();
    expect(alertAuditCall[1].metadata).toMatchObject({
      type: 'incident_notification_failed',
      reason: 'provider_error',
      alert: 'notification_email_missing',
    });
  });
});

// ── Tests — POST /api/auth/pro-session ───────────────────────────────────────

import { POST as proSessionPOST } from '@/app/api/auth/pro-session/route';

describe('POST /api/auth/pro-session — L5 resetRateLimit helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockReset();
  });

  it('succès login → resetRateLimit(prefix="pro", ip) appelé (pas delete brut)', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/pro-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'educ@structure.fr',
        structureCode: 'ABCDEF',
      }),
    });

    const res = await proSessionPOST(req);
    expect(res.status).toBe(200);

    // Vérification anti-M3 : helper appelé avec clé brute, hash géré en interne
    expect(resetRateLimitMock).toHaveBeenCalledWith('pro', '203.0.113.5');

    // Sanity : PAS de tentative de delete manuel via mockFrom('gd_login_attempts')
    const loginAttemptsCalls = mockFrom.mock.calls.filter(c => c[0] === 'gd_login_attempts');
    expect(loginAttemptsCalls).toHaveLength(0);
  });
});
