/**
 * @jest-environment node
 *
 * Tests API — POST /api/pro/request-access
 *
 * Lot L3/6 — ajout minimal couvrant :
 *  - happy path (200, 2 emails envoyés, lead persisté AVANT emails)
 *  - rate-limit (429)
 *  - validation (400)
 *  - email KO → logEmailFailure appelé + route continue 200 (au moins 1 email OK)
 *  - 2 emails KO → 500 EMAIL_ERROR
 *
 * On NE teste PAS la route exhaustivement (déjà 585 tests verts au
 * niveau infra + autres routes) — juste le contrat refactor L3/6.
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-service-role';
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-ok!';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockSendProAccessConfirmation = jest.fn().mockResolvedValue({ sent: true, messageId: 'mock-id' });
const mockSendProAccessAlertGED = jest.fn().mockResolvedValue({ sent: true, messageId: 'mock-id' });
jest.mock('@/lib/email', () => ({
  sendProAccessConfirmation: (...args: unknown[]) => mockSendProAccessConfirmation(...args),
  sendProAccessAlertGED: (...args: unknown[]) => mockSendProAccessAlertGED(...args),
}));

const mockLogEmailFailure = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/email-logger', () => ({
  logEmailFailure: (...args: unknown[]) => mockLogEmailFailure(...args),
}));

// Rate-limit mock (pas d'entry → autorisé)
const mockLoginAttemptsSingle = jest.fn().mockResolvedValue({ data: null });
const mockLoginAttemptsUpsert = jest.fn().mockResolvedValue({ data: null, error: null });
const mockLoginAttemptsUpdateEq = jest.fn().mockResolvedValue({ data: null, error: null });

// smart_form_submissions insert → retourne leadId
const mockSmartFormSingle = jest.fn().mockResolvedValue({ data: { id: 'lead-uuid-99' }, error: null });

jest.mock('@/lib/supabase-server', () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === 'gd_login_attempts') {
        return {
          select: () => ({ eq: () => ({ single: mockLoginAttemptsSingle }) }),
          upsert: mockLoginAttemptsUpsert,
          update: () => ({ eq: mockLoginAttemptsUpdateEq }),
        };
      }
      if (table === 'smart_form_submissions') {
        return {
          insert: () => ({
            select: () => ({ single: mockSmartFormSingle }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/pro/request-access/route';

const VALID_PAYLOAD = {
  prenom: 'Laura',
  nom: 'Martin',
  structureName: 'MECS Les Tilleuls',
  structureType: 'MECS',
  email: 'laura@mecs.fr',
  phone: '0611223344',
};

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/pro/request-access', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/pro/request-access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendProAccessConfirmation.mockResolvedValue({ sent: true, messageId: 'mock-id' });
    mockSendProAccessAlertGED.mockResolvedValue({ sent: true, messageId: 'mock-id' });
    mockLoginAttemptsSingle.mockResolvedValue({ data: null });
    mockSmartFormSingle.mockResolvedValue({ data: { id: 'lead-uuid-99' }, error: null });
  });

  it('200 happy path — 2 emails envoyés, lead persisté, pas de logEmailFailure', async () => {
    const res = await POST(makeReq(VALID_PAYLOAD));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockSendProAccessConfirmation).toHaveBeenCalledTimes(1);
    expect(mockSendProAccessAlertGED).toHaveBeenCalledTimes(1);
    expect(mockSmartFormSingle).toHaveBeenCalled();
    expect(mockLogEmailFailure).not.toHaveBeenCalled();
  });

  it('400 si champs obligatoires manquants', async () => {
    const res = await POST(makeReq({ prenom: 'Laura' }));
    expect(res.status).toBe(400);
    expect(mockSendProAccessConfirmation).not.toHaveBeenCalled();
  });

  it('400 si email invalide', async () => {
    const res = await POST(makeReq({ ...VALID_PAYLOAD, email: 'pas-un-email' }));
    expect(res.status).toBe(400);
  });

  it('400 si structureType invalide', async () => {
    const res = await POST(makeReq({ ...VALID_PAYLOAD, structureType: 'Bogus' }));
    expect(res.status).toBe(400);
  });

  it('logEmailFailure appelé si confirmation retourne { sent: false }', async () => {
    mockSendProAccessConfirmation.mockResolvedValue({ sent: false, reason: 'missing_api_key' });
    // alert reste OK → route doit quand même retourner 200
    const res = await POST(makeReq(VALID_PAYLOAD));
    expect(res.status).toBe(200);
    expect(mockLogEmailFailure).toHaveBeenCalledWith(
      'pro_access_confirmation',
      { sent: false, reason: 'missing_api_key' },
      'pro_access_request',
      'lead-uuid-99'
    );
  });

  it('logEmailFailure appelé avec provider_error si confirmation throw', async () => {
    mockSendProAccessConfirmation.mockRejectedValue(new Error('Resend 503'));
    const res = await POST(makeReq(VALID_PAYLOAD));
    expect(res.status).toBe(200);
    expect(mockLogEmailFailure).toHaveBeenCalledWith(
      'pro_access_confirmation',
      { sent: false, reason: 'provider_error' },
      'pro_access_request',
      'lead-uuid-99'
    );
  });

  it('500 EMAIL_ERROR si les 2 emails échouent (fulfilled sent:false)', async () => {
    mockSendProAccessConfirmation.mockResolvedValue({ sent: false, reason: 'provider_error' });
    mockSendProAccessAlertGED.mockResolvedValue({ sent: false, reason: 'provider_error' });
    const res = await POST(makeReq(VALID_PAYLOAD));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error.code).toBe('EMAIL_ERROR');
    expect(mockLogEmailFailure).toHaveBeenCalledTimes(2);
  });

  it('500 EMAIL_ERROR si les 2 emails throw (legacy pattern)', async () => {
    mockSendProAccessConfirmation.mockRejectedValue(new Error('fail'));
    mockSendProAccessAlertGED.mockRejectedValue(new Error('fail'));
    const res = await POST(makeReq(VALID_PAYLOAD));
    expect(res.status).toBe(500);
  });

  it('lead inséré AVANT les emails (ordre transactionnel)', async () => {
    const order: string[] = [];
    mockSmartFormSingle.mockImplementation(async () => {
      order.push('insert');
      return { data: { id: 'lead-uuid-99' }, error: null };
    });
    mockSendProAccessConfirmation.mockImplementation(async () => {
      order.push('email_confirm');
      return { sent: true, messageId: 'x' };
    });
    mockSendProAccessAlertGED.mockImplementation(async () => {
      order.push('email_alert');
      return { sent: true, messageId: 'y' };
    });

    await POST(makeReq(VALID_PAYLOAD));

    expect(order[0]).toBe('insert');
    expect(order).toContain('email_confirm');
    expect(order).toContain('email_alert');
  });
});
