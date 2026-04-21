/**
 * @jest-environment node
 *
 * Tests API — POST /api/pro/price-inquiry
 *
 * Vérifie :
 *  - Validation Zod stricte (email, prenom, structureName, sejourSlug, consentAccepted)
 *  - Cap body 32 Ko (Content-Length > limite → 413)
 *  - Consentement RGPD obligatoire
 *  - Honeypot `website` → 200 silencieux, pas d'email ni de lead
 *  - Sanitization : email.trim().toLowerCase()
 *  - Ordre transactionnel : INSERT lead AVANT email + auditLog RGPD
 *  - email KO + insert OK → user 200, lead persisté, auditLog email_failed
 *  - insert KO → 500 LEAD_PERSIST_FAILED, pas d'email envoyé, auditLog critical
 *  - consent_at tracé dans metadata auditLog
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon-key-test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service-role-test';
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-ok!';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockSendPriceInquiryToEducateur = jest.fn().mockResolvedValue({ sent: true, messageId: 'mock-id' });
const mockSendPriceInquiryAlertGED = jest.fn().mockResolvedValue({ sent: true, messageId: 'mock-id' });
jest.mock('@/lib/email', () => ({
  sendPriceInquiryToEducateur: (...args: unknown[]) => mockSendPriceInquiryToEducateur(...args),
  sendPriceInquiryAlertGED: (...args: unknown[]) => mockSendPriceInquiryAlertGED(...args),
}));

const mockAuditLog = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/audit-log', () => ({
  auditLog: (...args: unknown[]) => mockAuditLog(...args),
  getClientIp: jest.fn(),
}));

const mockIsRateLimited = jest.fn().mockResolvedValue(false);
jest.mock('@/lib/rate-limit', () => ({
  isRateLimited: (...args: unknown[]) => mockIsRateLimited(...args),
  getClientIpFromHeaders: () => '127.0.0.1',
}));

// smart_form_submissions.insert(...).select('id').single()
const mockInsertSingle = jest.fn();
const mockInsertChain = jest.fn(() => ({
  select: () => ({ single: mockInsertSingle }),
}));
const mockSejourSingle = jest.fn();
jest.mock('@/lib/supabase-server', () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === 'smart_form_submissions') {
        return { insert: mockInsertChain };
      }
      // gd_stays
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: mockSejourSingle,
            }),
          }),
        }),
      };
    },
  }),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/pro/price-inquiry/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, extraHeaders: Record<string, string> = {}): NextRequest {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Content-Length': String(Buffer.byteLength(payload, 'utf8')),
    ...extraHeaders,
  };
  return new NextRequest('http://localhost/api/pro/price-inquiry', {
    method: 'POST',
    body: payload,
    headers,
  });
}

const VALID_PAYLOAD = {
  email: 'educ@mecs.fr',
  prenom: 'Laura',
  structureName: 'MECS Les Tilleuls',
  sejourSlug: 'les-ptits-puisotins-1',
  consentAccepted: true,
};

function mockSejourFound() {
  mockSejourSingle.mockResolvedValue({
    data: { title: 'Les Ptits Puisotins', marketing_title: 'Les P\'tits Puisotins', price_from: 550 },
    error: null,
  });
}

function mockInsertOk(id = 'lead-uuid-123') {
  mockInsertSingle.mockResolvedValue({ data: { id }, error: null });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/pro/price-inquiry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Lot L3/6 — align mocks avec contrat EmailResult réel (depuis L2/6).
    // Anciens mocks `{ ok: true }` faisaient sent===undefined (faux positif
    // passant en happy path mais cassant les tests KO). Maintenant { sent: true }.
    mockSendPriceInquiryToEducateur.mockResolvedValue({ sent: true, messageId: 'mock-id' });
    mockSendPriceInquiryAlertGED.mockResolvedValue({ sent: true, messageId: 'mock-id' });
    mockIsRateLimited.mockResolvedValue(false);
    mockSejourFound();
    mockInsertOk();
  });

  // ── Validation email ──
  it('retourne 400 si email invalide', async () => {
    const res = await POST(makeRequest({ ...VALID_PAYLOAD, email: 'pas-un-email' }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(mockSendPriceInquiryToEducateur).not.toHaveBeenCalled();
  });

  it('accepte email valide et normalise (trim + lowercase)', async () => {
    const res = await POST(makeRequest({ ...VALID_PAYLOAD, email: '  Educ@MECS.FR  ' }));
    expect(res.status).toBe(200);
    expect(mockSendPriceInquiryToEducateur).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'educ@mecs.fr' })
    );
  });

  // ── Validation prenom ──
  it('retourne 400 si prenom dépasse 80 chars', async () => {
    const res = await POST(makeRequest({ ...VALID_PAYLOAD, prenom: 'a'.repeat(81) }));
    expect(res.status).toBe(400);
    expect(mockSendPriceInquiryToEducateur).not.toHaveBeenCalled();
  });

  it('accepte prenom exactement 80 chars', async () => {
    const res = await POST(makeRequest({ ...VALID_PAYLOAD, prenom: 'a'.repeat(80) }));
    expect(res.status).toBe(200);
  });

  it('retourne 400 si prenom vide', async () => {
    const res = await POST(makeRequest({ ...VALID_PAYLOAD, prenom: '   ' }));
    expect(res.status).toBe(400);
  });

  // ── Validation structureName ──
  it('retourne 400 si structureName dépasse 200 chars', async () => {
    const res = await POST(makeRequest({ ...VALID_PAYLOAD, structureName: 'a'.repeat(201) }));
    expect(res.status).toBe(400);
    expect(mockSendPriceInquiryToEducateur).not.toHaveBeenCalled();
  });

  it('accepte structureName exactement 200 chars', async () => {
    const res = await POST(makeRequest({ ...VALID_PAYLOAD, structureName: 'a'.repeat(200) }));
    expect(res.status).toBe(200);
  });

  // ── Validation sejourSlug (regex anti-injection) ──
  it('accepte slug valide au format attendu', async () => {
    const res = await POST(makeRequest({ ...VALID_PAYLOAD, sejourSlug: 'les-ptits-puisotins-1' }));
    expect(res.status).toBe(200);
  });

  it("refuse slug contenant SQL injection (\"'; DROP--\")", async () => {
    const res = await POST(makeRequest({ ...VALID_PAYLOAD, sejourSlug: "'; DROP--" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(mockSejourSingle).not.toHaveBeenCalled();
  });

  it('refuse slug avec majuscules', async () => {
    const res = await POST(makeRequest({ ...VALID_PAYLOAD, sejourSlug: 'Invalid-Slug' }));
    expect(res.status).toBe(400);
  });

  it('refuse slug avec espaces', async () => {
    const res = await POST(makeRequest({ ...VALID_PAYLOAD, sejourSlug: 'slug avec espace' }));
    expect(res.status).toBe(400);
  });

  it('refuse slug > 120 chars', async () => {
    const res = await POST(makeRequest({ ...VALID_PAYLOAD, sejourSlug: 'a'.repeat(121) }));
    expect(res.status).toBe(400);
  });

  // ── Consentement obligatoire ──
  it('retourne 400 CONSENT_REQUIRED si consentAccepted manquant', async () => {
    const { consentAccepted, ...payloadSansConsent } = VALID_PAYLOAD;
    void consentAccepted;
    const res = await POST(makeRequest(payloadSansConsent));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('CONSENT_REQUIRED');
    expect(mockSendPriceInquiryToEducateur).not.toHaveBeenCalled();
  });

  it('retourne 400 CONSENT_REQUIRED si consentAccepted = false', async () => {
    const res = await POST(makeRequest({ ...VALID_PAYLOAD, consentAccepted: false }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('CONSENT_REQUIRED');
  });

  // ── Cap body 32 Ko ──
  it('retourne 413 PAYLOAD_TOO_LARGE si Content-Length > 32 Ko', async () => {
    const payload = JSON.stringify(VALID_PAYLOAD);
    const req = new NextRequest('http://localhost/api/pro/price-inquiry', {
      method: 'POST',
      body: payload,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(32_768 + 1),
      },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(413);
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(mockSendPriceInquiryToEducateur).not.toHaveBeenCalled();
  });

  it('accepte Content-Length à exactement 32 Ko', async () => {
    const payload = JSON.stringify(VALID_PAYLOAD);
    const req = new NextRequest('http://localhost/api/pro/price-inquiry', {
      method: 'POST',
      body: payload,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(32_768),
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  // ── Body malformé ──
  it('retourne 400 INVALID_BODY si JSON invalide', async () => {
    const req = new NextRequest('http://localhost/api/pro/price-inquiry', {
      method: 'POST',
      body: 'not-json{',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('INVALID_BODY');
  });

  // ── Honeypot ──
  it('honeypot rempli → 200 silencieux, pas d\'email, pas de lead', async () => {
    const res = await POST(makeRequest({ ...VALID_PAYLOAD, website: 'http://spam.com' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockSendPriceInquiryToEducateur).not.toHaveBeenCalled();
    expect(mockSendPriceInquiryAlertGED).not.toHaveBeenCalled();
    expect(mockInsertChain).not.toHaveBeenCalled();
  });

  it('honeypot vide ("") → traitement normal', async () => {
    const res = await POST(makeRequest({ ...VALID_PAYLOAD, website: '' }));
    expect(res.status).toBe(200);
    expect(mockSendPriceInquiryToEducateur).toHaveBeenCalled();
  });

  // ── Happy path complet ──
  it('payload valide → 200 + 2 emails envoyés + lead inséré + auditLog create', async () => {
    const res = await POST(makeRequest(VALID_PAYLOAD));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockInsertChain).toHaveBeenCalledWith(
      expect.objectContaining({
        contact_email: 'educ@mecs.fr',
        referent_organization: 'MECS Les Tilleuls',
      })
    );
    expect(mockSendPriceInquiryToEducateur).toHaveBeenCalledTimes(1);
    expect(mockSendPriceInquiryAlertGED).toHaveBeenCalledTimes(1);
    // auditLog create sur lead
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'create',
        resourceType: 'inscription',
        actorId: 'educ@mecs.fr',
        metadata: expect.objectContaining({
          form: 'price_inquiry',
          structure: 'MECS Les Tilleuls',
          sejour_slug: 'les-ptits-puisotins-1',
          consent_at: expect.any(String),
        }),
      })
    );
  });

  // ── Ordre transactionnel : INSERT avant emails ──
  it('INSERT lead est appelé AVANT les emails', async () => {
    const callOrder: string[] = [];
    mockInsertSingle.mockImplementation(async () => {
      callOrder.push('insert');
      return { data: { id: 'lead-1' }, error: null };
    });
    mockSendPriceInquiryToEducateur.mockImplementation(async () => {
      callOrder.push('email_educ');
      return { sent: true, messageId: 'mock-id' };
    });
    mockSendPriceInquiryAlertGED.mockImplementation(async () => {
      callOrder.push('email_ged');
      return { sent: true, messageId: 'mock-id' };
    });

    await POST(makeRequest(VALID_PAYLOAD));

    expect(callOrder[0]).toBe('insert');
    expect(callOrder).toContain('email_educ');
    expect(callOrder).toContain('email_ged');
  });

  // ── Fix #5/6 : email KO + insert OK → user success, lead persisté, auditLog email_failed ──
  it('email éducateur KO + insert OK → 200, lead persisté, auditLog email_failed', async () => {
    mockSendPriceInquiryToEducateur.mockRejectedValue(new Error('Resend 503'));

    const res = await POST(makeRequest(VALID_PAYLOAD));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockInsertChain).toHaveBeenCalledTimes(1);

    // auditLog create + auditLog email_failed
    const emailFailedCall = mockAuditLog.mock.calls.find(
      (c) => c[1]?.metadata?.event === 'email_failed'
    );
    expect(emailFailedCall).toBeDefined();
    expect(emailFailedCall[1].metadata.educateur_email_status).toBe('failed');
    expect(emailFailedCall[1].metadata.ged_email_status).toBe('sent');
    expect(emailFailedCall[1].metadata.severity).toBe('medium');
  });

  it('les 2 emails KO + insert OK → 200 (user ne voit pas l\'erreur), auditLog severity=high', async () => {
    mockSendPriceInquiryToEducateur.mockRejectedValue(new Error('Resend 503'));
    mockSendPriceInquiryAlertGED.mockRejectedValue(new Error('Resend 503'));

    const res = await POST(makeRequest(VALID_PAYLOAD));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);

    const emailFailedCall = mockAuditLog.mock.calls.find(
      (c) => c[1]?.metadata?.event === 'email_failed'
    );
    expect(emailFailedCall[1].metadata.severity).toBe('high');
  });

  // ── Fix #6 : insert KO → 500 + auditLog critical + pas d'email envoyé ──
  it('insert lead KO → 500 LEAD_PERSIST_FAILED + auditLog critical + aucun email', async () => {
    mockInsertSingle.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    });

    const res = await POST(makeRequest(VALID_PAYLOAD));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error.code).toBe('LEAD_PERSIST_FAILED');
    expect(mockSendPriceInquiryToEducateur).not.toHaveBeenCalled();
    expect(mockSendPriceInquiryAlertGED).not.toHaveBeenCalled();

    const criticalCall = mockAuditLog.mock.calls.find(
      (c) => c[1]?.metadata?.event === 'lead_insert_failed'
    );
    expect(criticalCall).toBeDefined();
    expect(criticalCall[1].metadata.severity).toBe('critical');
    expect(criticalCall[1].metadata.error_code).toBe('23505');
  });

  // ── Rate-limit appelé APRÈS insert (ne brûle pas de tentative si DB KO) ──
  it('rate-limit appelé APRÈS insert lead', async () => {
    const callOrder: string[] = [];
    mockInsertSingle.mockImplementation(async () => {
      callOrder.push('insert');
      return { data: { id: 'lead-1' }, error: null };
    });
    mockIsRateLimited.mockImplementation(async () => {
      callOrder.push('rate_limit');
      return false;
    });

    await POST(makeRequest(VALID_PAYLOAD));

    expect(callOrder.indexOf('insert')).toBeLessThan(callOrder.indexOf('rate_limit'));
  });

  it('rate-limit bloque → 429 mais lead déjà persisté', async () => {
    mockIsRateLimited.mockResolvedValue(true);

    const res = await POST(makeRequest(VALID_PAYLOAD));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(mockInsertChain).toHaveBeenCalledTimes(1); // lead persisté avant blocage
    expect(mockSendPriceInquiryToEducateur).not.toHaveBeenCalled();
  });

  // ── Consent tracé dans metadata auditLog ──
  it('consent_at tracé dans metadata auditLog (colonne table absente → metadata only)', async () => {
    const before = new Date().toISOString();
    await POST(makeRequest(VALID_PAYLOAD));
    const after = new Date().toISOString();

    const createCall = mockAuditLog.mock.calls.find(
      (c) => c[1]?.action === 'create' && c[1]?.metadata?.form === 'price_inquiry'
    );
    expect(createCall).toBeDefined();
    const consentAt = createCall[1].metadata.consent_at;
    expect(typeof consentAt).toBe('string');
    expect(consentAt >= before && consentAt <= after).toBe(true);
  });
});
