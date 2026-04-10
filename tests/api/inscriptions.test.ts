/**
 * @jest-environment node
 *
 * Tests unitaires — POST /api/inscriptions
 *
 * Vérifie la validation Zod du handler (rejets avant toute requête Supabase) :
 *  1. consent: false → 400
 *  2. email invalide → 400
 *  3. priceTotal négatif → 400
 *  4. priceTotal = 0 → 400
 *
 * Le handler est appelé directement (pas de fetch serveur).
 * Supabase et email sont mockés — si un test atteint Supabase, c'est un bug.
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake';
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-ok!';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Supabase ne doit JAMAIS être appelé pour ces tests (validation Zod rejette avant)
jest.mock('@/lib/supabase-server', () => ({
  getSupabase: () => ({
    from: () => { throw new Error('Supabase should not be called — validation Zod devrait rejeter avant'); },
    rpc: () => { throw new Error('Supabase RPC should not be called'); },
  }),
  getSupabaseAdmin: () => ({
    from: () => { throw new Error('Supabase Admin should not be called'); },
  }),
}));

jest.mock('@/lib/email', () => ({
  sendInscriptionConfirmation: jest.fn().mockResolvedValue(undefined),
  sendAdminNewInscriptionNotification: jest.fn().mockResolvedValue(undefined),
  sendStructureCodeEmail: jest.fn().mockResolvedValue(undefined),
  sendNewEducateurAlert: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/audit-log', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
  getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/inscriptions/route';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Body valide minimal — tous les champs requis par le schema Zod */
const VALID_BODY = {
  staySlug: 'alpoo-kids',
  sessionDate: '2026-07-08',
  cityDeparture: 'Paris',
  organisation: 'Test Org',
  socialWorkerName: 'Test Worker',
  email: 'test@example.com',
  phone: '0612345678',
  childFirstName: 'TestEnfant',
  childLastName: 'Test',
  childBirthDate: '2019-01-15',
  priceTotal: 600,
  consent: true,
  structureName: 'Structure Test',
  structurePostalCode: '75001',
  structureCity: 'Paris',
};

function makeRequest(bodyOverrides: Record<string, unknown> = {}): NextRequest {
  return new NextRequest('http://localhost/api/inscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...VALID_BODY, ...bodyOverrides }),
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/inscriptions — validation Zod', () => {
  it.skip('crée inscription avec payment_reference auto-généré', async () => {
    // SKIP — Nécessite données en base : séjour slug='alpoo-kids', session start_date='2026-07-08',
    // ville city_departure='Paris' dans gd_session_prices avec price_ged_total correspondant à 600.
    // Lancer avec npm run test:integration
  });

  it('rejette inscription sans consentement', async () => {
    const res = await POST(makeRequest({ consent: false }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('rejette inscription avec email invalide', async () => {
    const res = await POST(makeRequest({ email: 'invalid-email' }));
    expect(res.status).toBe(400);
  });

  it('rejette inscription avec prix négatif', async () => {
    const res = await POST(makeRequest({ priceTotal: -100 }));
    expect(res.status).toBe(400);
  });

  it('rejette inscription avec priceTotal à 0', async () => {
    const res = await POST(makeRequest({ priceTotal: 0 }));
    expect(res.status).toBe(400);
  });
});
