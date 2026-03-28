/**
 * @jest-environment node
 *
 * Tests unitaires — Webhook Stripe (app/api/webhooks/stripe/route.ts)
 *
 * Ces tests vérifient la logique métier du webhook SANS appeler Stripe ni Supabase.
 * Tout est mocké : signature, BDD, email.
 *
 * Scénarios couverts :
 *  1. Signature manquante → 400
 *  2. Signature invalide → 400
 *  3. payment_intent.succeeded → met à jour inscription en 'paid'
 *  4. Montant Stripe ≠ montant BDD → 'amount_mismatch'
 *  5. Idempotency : event déjà traité → skip
 *  6. payment_intent.payment_failed → met à jour en 'failed'
 *  7. inscriptionId manquant dans metadata → pas de crash
 */

// ── Env variables needed by the route ────────────────────────────────────────
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-service-role-key-for-tests';

// ── Mocks (jest.mock hoisted before imports) ─────────────────────────────────

// Mock next/headers — must return the stripe-signature
jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue({
    get: (name: string) => (name === 'stripe-signature' ? 'sig_test_valid' : null),
  }),
}));

// Mock Supabase
const mockSupabaseSelect = jest.fn();
const mockSupabaseUpdate = jest.fn();
const mockSupabaseInsert = jest.fn();
let selectSingleResult: { data: any; error: any } = { data: null, error: null };

const mockSupabaseFrom = jest.fn().mockImplementation((table: string) => ({
  select: (...args: any[]) => {
    mockSupabaseSelect(table, ...args);
    return {
      eq: (...eqArgs: any[]) => ({
        single: () => selectSingleResult,
      }),
    };
  },
  update: (data: any) => {
    mockSupabaseUpdate(table, data);
    return {
      eq: () => ({ error: null }),
    };
  },
  insert: (data: any) => {
    mockSupabaseInsert(table, data);
    return { single: () => ({ data: null, error: null }) };
  },
}));

jest.mock('@/lib/supabase-server', () => ({
  getSupabase: () => ({ from: mockSupabaseFrom }),
  getSupabaseAdmin: () => ({ from: mockSupabaseFrom }),
}));

// Mock Stripe
const mockConstructEvent = jest.fn();
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: { constructEvent: mockConstructEvent },
  }));
});

// Mock email
jest.mock('@/lib/email', () => ({
  sendPaymentConfirmedAdminNotification: jest.fn().mockResolvedValue(undefined),
}));

// ── Import route AFTER mocks ────────────────────────────────────────────────
import { POST } from '@/app/api/webhooks/stripe/route';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: string): any {
  return {
    text: () => Promise.resolve(body),
  } as any;
}

function makeStripeEvent(type: string, inscriptionId: string | null, amountCents: number): any {
  return {
    id: `evt_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    data: {
      object: {
        id: `pi_test_${Date.now()}`,
        amount: amountCents,
        metadata: inscriptionId ? { inscriptionId } : {},
      },
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Webhook Stripe — /api/webhooks/stripe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Par défaut : event pas encore traité
    selectSingleResult = { data: null, error: null };
    // Reset headers mock to return signature
    const { headers } = require('next/headers');
    (headers as jest.Mock).mockResolvedValue({
      get: (name: string) => (name === 'stripe-signature' ? 'sig_test_valid' : null),
    });
  });

  it('retourne 400 si stripe-signature est absent', async () => {
    const { headers } = require('next/headers');
    (headers as jest.Mock).mockResolvedValueOnce({
      get: () => null,
    });

    const req = makeRequest('{}');
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain('Missing stripe-signature');
  });

  it('retourne 400 si la signature est invalide', async () => {
    mockConstructEvent.mockImplementationOnce(() => {
      throw new Error('Invalid signature');
    });

    const req = makeRequest('{}');
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain('Invalid signature');
  });

  it('payment_intent.succeeded → met à jour inscription en paid', async () => {
    const event = makeStripeEvent('payment_intent.succeeded', 'insc_123', 60000);
    mockConstructEvent.mockReturnValueOnce(event);

    // Override from() pour gérer les différentes tables
    mockSupabaseFrom.mockImplementation((table: string) => ({
      select: (...args: any[]) => ({
        eq: (...eqArgs: any[]) => ({
          single: () => {
            if (table === 'gd_processed_events') return { data: null, error: null };
            if (table === 'gd_inscriptions') {
              return {
                data: {
                  price_total: 600,
                  referent_nom: 'Dupont',
                  referent_email: 'test@test.fr',
                  jeune_prenom: 'Jules',
                  jeune_nom: 'Martin',
                  sejour_slug: 'alpoo-kids',
                  dossier_ref: 'DOS-TEST',
                },
                error: null,
              };
            }
            return { data: null, error: null };
          },
        }),
      }),
      update: (data: any) => {
        mockSupabaseUpdate(table, data);
        return { eq: () => ({ error: null }) };
      },
      insert: (data: any) => {
        mockSupabaseInsert(table, data);
        return { single: () => ({ data: null, error: null }) };
      },
      upsert: (data: any, opts: any) => {
        mockSupabaseInsert(table, data);
        return { error: null };
      },
    }));

    const req = makeRequest(JSON.stringify(event));
    const res = await POST(req);
    const json = await res.json();

    expect(json.received).toBe(true);
    expect(mockSupabaseUpdate).toHaveBeenCalledWith(
      'gd_inscriptions',
      expect.objectContaining({ payment_status: 'paid' })
    );
    // L'event est enregistré via upsert (qui appelle mockSupabaseInsert dans notre mock)
    expect(mockSupabaseInsert).toHaveBeenCalledWith(
      'gd_processed_events',
      expect.objectContaining({ event_id: event.id })
    );
  });

  it('payment_intent.succeeded avec montant différent → amount_mismatch', async () => {
    const event = makeStripeEvent('payment_intent.succeeded', 'insc_123', 99900); // 999€
    mockConstructEvent.mockReturnValueOnce(event);

    mockSupabaseFrom.mockImplementation((table: string) => ({
      select: (...args: any[]) => ({
        eq: (...eqArgs: any[]) => ({
          single: () => {
            if (table === 'gd_processed_events') return { data: null, error: null };
            if (table === 'gd_inscriptions') {
              return { data: { price_total: 600 }, error: null }; // 600€ en BDD, 999€ Stripe
            }
            return { data: null, error: null };
          },
        }),
      }),
      update: (data: any) => {
        mockSupabaseUpdate(table, data);
        return { eq: () => ({ error: null }) };
      },
      insert: (data: any) => {
        mockSupabaseInsert(table, data);
        return { single: () => ({ data: null, error: null }) };
      },
      upsert: (data: any, opts: any) => {
        mockSupabaseInsert(table, data);
        return { error: null };
      },
    }));

    const req = makeRequest(JSON.stringify(event));
    const res = await POST(req);

    expect(mockSupabaseUpdate).toHaveBeenCalledWith(
      'gd_inscriptions',
      expect.objectContaining({ payment_status: 'amount_mismatch' })
    );
  });

  it('event déjà traité → skip (idempotency)', async () => {
    const event = makeStripeEvent('payment_intent.succeeded', 'insc_123', 60000);
    mockConstructEvent.mockReturnValueOnce(event);

    mockSupabaseFrom.mockImplementation((table: string) => ({
      select: (...args: any[]) => ({
        eq: (...eqArgs: any[]) => ({
          single: () => {
            if (table === 'gd_processed_events') return { data: { id: 'exists' }, error: null };
            return { data: null, error: null };
          },
        }),
      }),
      update: (data: any) => {
        mockSupabaseUpdate(table, data);
        return { eq: () => ({ error: null }) };
      },
      insert: (data: any) => {
        mockSupabaseInsert(table, data);
        return { single: () => ({ data: null, error: null }) };
      },
      upsert: (data: any, opts: any) => {
        mockSupabaseInsert(table, data);
        return { error: null };
      },
    }));

    const req = makeRequest(JSON.stringify(event));
    const res = await POST(req);
    const json = await res.json();

    expect(json.skipped).toBe(true);
    expect(mockSupabaseUpdate).not.toHaveBeenCalled();
  });

  it('payment_intent.payment_failed avec inscriptionId → met à jour en failed', async () => {
    const event = makeStripeEvent('payment_intent.payment_failed', 'insc_456', 60000);
    mockConstructEvent.mockReturnValueOnce(event);

    mockSupabaseFrom.mockImplementation((table: string) => ({
      select: (...args: any[]) => ({
        eq: (...eqArgs: any[]) => ({
          single: () => ({ data: null, error: null }),
        }),
      }),
      update: (data: any) => {
        mockSupabaseUpdate(table, data);
        return { eq: () => ({ error: null }) };
      },
      insert: (data: any) => {
        mockSupabaseInsert(table, data);
        return { single: () => ({ data: null, error: null }) };
      },
      upsert: (data: any, opts: any) => {
        mockSupabaseInsert(table, data);
        return { error: null };
      },
    }));

    const req = makeRequest(JSON.stringify(event));
    const res = await POST(req);
    const json = await res.json();

    expect(json.received).toBe(true);
    expect(mockSupabaseUpdate).toHaveBeenCalledWith(
      'gd_inscriptions',
      expect.objectContaining({ payment_status: 'failed' })
    );
  });

  it('metadata sans inscriptionId → reçu OK mais event NON enregistré (Stripe réessaiera)', async () => {
    const event = makeStripeEvent('payment_intent.succeeded', null, 60000);
    mockConstructEvent.mockReturnValueOnce(event);

    mockSupabaseFrom.mockImplementation((table: string) => ({
      select: (...args: any[]) => ({
        eq: (...eqArgs: any[]) => ({
          single: () => ({ data: null, error: null }),
        }),
      }),
      update: (data: any) => {
        mockSupabaseUpdate(table, data);
        return { eq: () => ({ error: null }) };
      },
      insert: (data: any) => {
        mockSupabaseInsert(table, data);
        return { single: () => ({ data: null, error: null }) };
      },
      upsert: (data: any, opts: any) => {
        mockSupabaseInsert(table, data);
        return { error: null };
      },
    }));

    const req = makeRequest(JSON.stringify(event));
    const res = await POST(req);
    const json = await res.json();

    expect(json.received).toBe(true);
    // L'event ne doit PAS être enregistré dans gd_processed_events
    // car inscriptionId manquant → Stripe réessaiera
    expect(mockSupabaseInsert).not.toHaveBeenCalledWith(
      'gd_processed_events',
      expect.anything()
    );
    expect(mockSupabaseUpdate).not.toHaveBeenCalledWith(
      'gd_inscriptions',
      expect.anything()
    );
  });
});
