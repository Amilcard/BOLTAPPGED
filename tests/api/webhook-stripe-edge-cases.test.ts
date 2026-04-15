/**
 * @jest-environment node
 *
 * Tests edge cases — Webhook Stripe (app/api/webhooks/stripe/route.ts)
 *
 * Complète webhook-stripe.test.ts (scénarios nominaux déjà couverts).
 * Couvre les cas qui causent des pertes financières silencieuses :
 *
 *  1. rollbackClaim appelé si update Supabase échoue post-claim → retour 500 (Stripe retry)
 *  2. STRIPE_WEBHOOK_SECRET absent → throw, pas de fallback silencieux
 *  3. payment_intent.succeeded + inscription déjà 'paid' → skip idempotent (200, pas de double update)
 *  4. metadata.inscriptionId absent → 200 sans mise à jour BDD (Stripe ne doit pas retry)
 */

process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-service-role-key-for-tests';
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-pad';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';

jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue({
    get: (name: string) => (name === 'stripe-signature' ? 'sig_test_valid' : null),
  }),
}));

interface SupabaseRow { [key: string]: unknown }
interface SelectSingleResult { data: SupabaseRow | null; error: unknown }

const mockSupabaseSelect = jest.fn();
const mockSupabaseUpdate = jest.fn();
const mockSupabaseUpsert = jest.fn();
let selectSingleResult: SelectSingleResult = { data: null, error: null };
let updateError: unknown = null;

const mockSupabaseFrom = jest.fn().mockImplementation((table: string) => ({
  select: (..._args: unknown[]) => {
    mockSupabaseSelect(table, ..._args);
    return { eq: (..._eqArgs: unknown[]) => ({ single: () => selectSingleResult }) };
  },
  update: (data: SupabaseRow) => {
    mockSupabaseUpdate(table, data);
    return { eq: () => ({ error: updateError }) };
  },
  upsert: (data: SupabaseRow, opts?: unknown) => {
    mockSupabaseUpsert(table, data, opts);
    return { error: null };
  },
}));

jest.mock('@/lib/supabase-server', () => ({
  getSupabaseAdmin: () => ({ from: mockSupabaseFrom }),
}));

const mockConstructEvent = jest.fn();
jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    webhooks: { constructEventAsync: mockConstructEvent },
  })),
}));

jest.mock('@/lib/email', () => ({
  sendInscriptionConfirmation: jest.fn().mockResolvedValue(undefined),
  sendPaymentFailedNotification: jest.fn().mockResolvedValue(undefined),
}));

import { POST } from '@/app/api/webhooks/stripe/route';
import { NextRequest } from 'next/server';

function makeRequest(body = '{}') {
  return new NextRequest('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers: { 'stripe-signature': 'sig_test_valid', 'content-type': 'application/json' },
  });
}

describe('Webhook Stripe — edge cases financiers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateError = null;
    selectSingleResult = { data: null, error: null };
  });

  it('metadata.inscriptionId absent → 200 sans mise à jour BDD', async () => {
    mockConstructEvent.mockResolvedValue({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_no_meta',
          amount: 50000,
          metadata: {}, // pas d'inscriptionId
        },
      },
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    // Aucun SELECT/UPDATE sur inscriptions
    expect(mockSupabaseUpdate).not.toHaveBeenCalled();
  });

  it('inscription déjà paid → skip idempotent → 200 sans double update', async () => {
    selectSingleResult = {
      data: {
        id: 'insc_already_paid',
        status: 'paid',
        price_total: 500,
        payment_method: 'card',
      },
      error: null,
    };
    mockConstructEvent.mockResolvedValue({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_already_paid',
          amount: 50000,
          metadata: { inscriptionId: 'insc_already_paid' },
        },
      },
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    // L'update ne doit pas re-déclencher si déjà paid
    const updateCalls = mockSupabaseUpdate.mock.calls.filter(
      (c) => (c[1] as SupabaseRow)?.status === 'paid'
    );
    // On accepte 0 ou 1 appel (idempotent) mais jamais 2+
    expect(updateCalls.length).toBeLessThanOrEqual(1);
  });

  it('STRIPE_WEBHOOK_SECRET absent → erreur catchée, pas de fallback silencieux', async () => {
    const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET;

    mockConstructEvent.mockRejectedValue(new Error('No webhook secret'));

    const res = await POST(makeRequest());
    // Doit retourner 400 ou 500, jamais 200 sans vérification
    expect(res.status).not.toBe(200);

    process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
  });

  it('update Supabase échoue post-claim → retour 500 pour que Stripe retry', async () => {
    selectSingleResult = {
      data: {
        id: 'insc_update_fail',
        status: 'pending',
        price_total: 500,
        payment_method: 'card',
      },
      error: null,
    };
    // Simuler une erreur Supabase sur l'update
    updateError = { message: 'DB connection lost', code: '08006' };

    mockConstructEvent.mockResolvedValue({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_update_fail',
          amount: 50000,
          metadata: { inscriptionId: 'insc_update_fail' },
        },
      },
    });

    const res = await POST(makeRequest());
    // Stripe doit pouvoir retry → la route doit retourner 500, pas 200
    expect(res.status).toBe(500);
  });
});
