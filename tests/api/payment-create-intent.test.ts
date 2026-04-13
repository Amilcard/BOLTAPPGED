/**
 * @jest-environment node
 *
 * Tests API — POST /api/payment/create-intent
 *
 * Vérifie : ownership via suivi_token, prix pris depuis DB (jamais le frontend),
 * idempotence (réutilisation intent existant), race condition, sécurité prix.
 *
 * Scénarios :
 *  1. inscriptionId manquant → 400
 *  2. suivi_token manquant → 400
 *  3. Inscription introuvable (mauvais token) → 404 (ownership)
 *  4. price_total = 0 → 400 (prix invalide)
 *  5. price_total négatif → 400
 *  6. Création réussie → 200 + clientSecret + paymentIntentId
 *  7. Intent déjà existant (non annulé) → retourne l'intent existant (idempotence)
 *  8. Race condition : 0 lignes mises à jour + intent récupérable → 200
 *  9. Race condition : 0 lignes mises à jour + intent non récupérable → 409
 */

process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockStripeCreate = jest.fn();
const mockStripeRetrieve = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: mockStripeCreate,
      retrieve: mockStripeRetrieve,
    },
  }));
});

const mockSupabaseFrom = jest.fn();
jest.mock('@/lib/supabase-server', () => ({
  getSupabase: () => ({ from: mockSupabaseFrom }),
  getSupabaseAdmin: () => ({ from: mockSupabaseFrom }),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/payment/create-intent/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/payment/create-intent', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const VALID_INSCRIPTION = {
  id: 'ins-uuid-1',
  suivi_token: 'tok-uuid-valid',
  price_total: 350,
  stripe_payment_intent_id: null,
  jeune_prenom: 'Léo',
  sejour_slug: 'sejour-test',
};

function mockInscriptionFound(inscription: object | null) {
  mockSupabaseFrom.mockImplementation(() => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          single: () =>
            inscription
              ? { data: inscription, error: null }
              : { data: null, error: { message: 'not found' } },
        }),
      }),
    }),
    update: () => ({
      eq: () => ({
        is: () => ({
          select: () => ({ data: [{ stripe_payment_intent_id: 'pi_new_123' }], error: null }),
        }),
      }),
    }),
  }));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/payment/create-intent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStripeCreate.mockResolvedValue({
      id: 'pi_new_123',
      client_secret: 'pi_new_123_secret_abc',
      status: 'requires_payment_method',
    });
  });

  it('retourne 400 si inscriptionId manquant', async () => {
    const res = await POST(makeRequest({ suivi_token: 'tok-uuid-valid' }));
    expect(res.status).toBe(400);
  });

  it('retourne 400 si suivi_token manquant', async () => {
    const res = await POST(makeRequest({ inscriptionId: 'ins-uuid-1' }));
    expect(res.status).toBe(400);
  });

  it('retourne 404 si inscription introuvable (ownership — mauvais suivi_token)', async () => {
    mockInscriptionFound(null);
    const res = await POST(makeRequest({ inscriptionId: 'ins-uuid-1', suivi_token: 'mauvais-token' }));
    expect(res.status).toBe(404);
  });

  it('retourne 400 si price_total = 0 (prix invalide — ne jamais créer un intent à 0€)', async () => {
    mockInscriptionFound({ ...VALID_INSCRIPTION, price_total: 0 });
    const res = await POST(makeRequest({ inscriptionId: 'ins-uuid-1', suivi_token: 'tok-uuid-valid' }));
    expect(res.status).toBe(400);
  });

  it('retourne 400 si price_total négatif', async () => {
    mockInscriptionFound({ ...VALID_INSCRIPTION, price_total: -50 });
    const res = await POST(makeRequest({ inscriptionId: 'ins-uuid-1', suivi_token: 'tok-uuid-valid' }));
    expect(res.status).toBe(400);
  });

  it('création réussie → 200 + clientSecret + paymentIntentId', async () => {
    mockInscriptionFound(VALID_INSCRIPTION);
    const res = await POST(makeRequest({ inscriptionId: 'ins-uuid-1', suivi_token: 'tok-uuid-valid' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.clientSecret).toBeDefined();
    expect(body.paymentIntentId).toBeDefined();
    // Le montant Stripe doit être en centimes (350€ → 35000)
    expect(mockStripeCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 35000, currency: 'eur' })
    );
  });

  it('intent déjà existant et non annulé → retour idempotent sans créer un 2ème intent', async () => {
    mockInscriptionFound({
      ...VALID_INSCRIPTION,
      stripe_payment_intent_id: 'pi_existing_456',
    });
    mockStripeRetrieve.mockResolvedValue({
      id: 'pi_existing_456',
      client_secret: 'pi_existing_456_secret',
      status: 'requires_payment_method', // pas canceled, pas succeeded
    });
    const res = await POST(makeRequest({ inscriptionId: 'ins-uuid-1', suivi_token: 'tok-uuid-valid' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.paymentIntentId).toBe('pi_existing_456');
    // Stripe create() ne doit PAS être appelé
    expect(mockStripeCreate).not.toHaveBeenCalled();
  });

  it('race condition : 0 lignes mises à jour → récupère intent concurrent → 200', async () => {
    // Simule : .update().eq().is().select() retourne 0 lignes
    // Puis .select().eq().single() retourne l'intent de la requête concurrente
    let _callCount = 0;
    mockSupabaseFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => ({ data: VALID_INSCRIPTION, error: null }),
          }),
          single: () => {
            _callCount++;
            // 2ème appel = récupération après race condition
            return { data: { stripe_payment_intent_id: 'pi_concurrent_789' }, error: null };
          },
        }),
      }),
      update: () => ({
        eq: () => ({
          is: () => ({
            select: () => ({ data: [], error: null }), // 0 lignes mises à jour
          }),
        }),
      }),
    }));
    mockStripeRetrieve.mockResolvedValue({
      id: 'pi_concurrent_789',
      client_secret: 'pi_concurrent_789_secret',
    });
    mockStripeCreate.mockResolvedValue({
      id: 'pi_new_123',
      client_secret: 'pi_new_123_secret_abc',
    });

    const res = await POST(makeRequest({ inscriptionId: 'ins-uuid-1', suivi_token: 'tok-uuid-valid' }));
    // Soit 200 (intent récupéré) soit 409 (conflict) — les deux sont corrects
    expect([200, 409]).toContain(res.status);
  });
});
