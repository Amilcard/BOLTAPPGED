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
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon-key-test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service-role-test';
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-ok!';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockSendPriceInquiryToEducateur = jest.fn();
const mockSendPriceInquiryAlertGED = jest.fn();
jest.mock('@/lib/email', () => ({
  sendPriceInquiryToEducateur: (...args: unknown[]) => mockSendPriceInquiryToEducateur(...args),
  sendPriceInquiryAlertGED: (...args: unknown[]) => mockSendPriceInquiryAlertGED(...args),
}));

const mockInsert = jest.fn().mockResolvedValue({ error: null });
const mockSejourSingle = jest.fn();
jest.mock('@/lib/supabase-server', () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === 'smart_form_submissions') {
        return { insert: mockInsert };
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/pro/price-inquiry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendPriceInquiryToEducateur.mockResolvedValue({ ok: true });
    mockSendPriceInquiryAlertGED.mockResolvedValue({ ok: true });
    mockSejourFound();
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
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('honeypot vide ("") → traitement normal', async () => {
    const res = await POST(makeRequest({ ...VALID_PAYLOAD, website: '' }));
    expect(res.status).toBe(200);
    expect(mockSendPriceInquiryToEducateur).toHaveBeenCalled();
  });

  // ── Happy path complet ──
  it('payload valide → 200 + 2 emails envoyés + lead inséré', async () => {
    const res = await POST(makeRequest(VALID_PAYLOAD));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockSendPriceInquiryToEducateur).toHaveBeenCalledTimes(1);
    expect(mockSendPriceInquiryAlertGED).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        contact_email: 'educ@mecs.fr',
        referent_organization: 'MECS Les Tilleuls',
      })
    );
  });
});
