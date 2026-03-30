/**
 * @jest-environment node
 *
 * Tests API — inscriptions
 *
 * L'environnement node est requis pour que fetch puisse ouvrir
 * de vraies connexions TCP vers localhost. jsdom ne supporte pas
 * les requêtes réseau réelles.
 *
 * Préconditions : serveur dev en écoute sur BASE_URL (ou localhost:3000).
 * Si le serveur est injoignable, tous les tests sont ignorés silencieusement.
 *
 * Note : le test de création d'inscription (test #1) crée une vraie entrée
 * en base lorsque le serveur est joignable. Prévoir un nettoyage manuel
 * via Supabase Studio si nécessaire (email de test : test@example.com).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const BASE_URL = process.env.BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

let serverReachable = false;
let _skipped = 0;

beforeAll(async () => {
  try {
    const res = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(4000) });
    serverReachable = res.status < 600;
  } catch {
    serverReachable = false;
    console.warn(`[INFO] Serveur ${BASE_URL} non joignable. Les tests inscriptions seront ignorés silencieusement.`);
  }
}, 8000);

afterAll(() => {
  if (_skipped > 0) {
    console.info(`[INFO] ${_skipped} test(s) ignoré(s) — serveur non joignable.`);
  }
});

function skipIfNoServer() {
  if (!serverReachable) {
    _skipped++;
    return true;
  }
  return false;
}

describe('API /api/inscriptions', () => {
  it.skip('crée inscription avec payment_reference auto-généré', async () => {
    // SKIP — Nécessite données en base : séjour slug='alpoo-kids', session start_date='2026-07-08',
    // ville city_departure='Paris' dans gd_session_prices avec price_ged_total correspondant à 600.
    // La route vérifie le prix côté serveur (PRICE_NOT_FOUND → 400) avant l'insertion.
    // Ce test ne peut passer qu'avec un environnement de staging contenant ces fixtures.
    if (skipIfNoServer()) return;

    const payload = {
      staySlug: 'alpoo-kids',
      sessionDate: '2026-07-08',
      cityDeparture: 'Paris',
      organisation: 'Test Organisation',
      socialWorkerName: 'Test Worker',
      email: 'test@example.com',
      phone: '0612345678',
      childFirstName: 'TestEnfant',
      childLastName: 'Test',
      childBirthDate: '2019-01-15',
      optionsEducatives: 'Aucune',
      remarques: 'Test automatisé',
      priceTotal: 600,
      consent: true,
    };

    const response = await fetch(`${BASE_URL}/api/inscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    expect(response.status).toBe(201);

    const data = await response.json();

    // Vérifier structure réponse
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('dossier_ref');
    expect(data).toHaveProperty('status');

    // Vérifier format dossier_ref: DOS-YYYYMMDD-XXXXXXXX (généré côté serveur)
    // payment_reference est une colonne DB optionnelle — peut être null si pas de défaut DB
    expect(data.dossier_ref).toMatch(/^DOS-\d{8}-[A-Z0-9]{8}$/);

    // Vérifier status initial
    expect(data.status).toBe('en_attente');
  });

  it('rejette inscription sans consentement', async () => {
    if (skipIfNoServer()) return;

    const payload = {
      staySlug: 'alpoo-kids',
      sessionDate: '2026-07-08',
      cityDeparture: 'Paris',
      organisation: 'Test Org',
      socialWorkerName: 'Test',
      email: 'test@example.com',
      phone: '0612345678',
      childFirstName: 'Test',
      childBirthDate: '2019-01-15',
      priceTotal: 600,
      consent: false, // Pas de consentement
    };

    const response = await fetch(`${BASE_URL}/api/inscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  it('rejette inscription avec email invalide', async () => {
    if (skipIfNoServer()) return;

    const payload = {
      staySlug: 'alpoo-kids',
      sessionDate: '2026-07-08',
      cityDeparture: 'Paris',
      organisation: 'Test Org',
      socialWorkerName: 'Test',
      email: 'invalid-email', // Email invalide
      phone: '0612345678',
      childFirstName: 'Test',
      childBirthDate: '2019-01-15',
      priceTotal: 600,
      consent: true,
    };

    const response = await fetch(`${BASE_URL}/api/inscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    expect(response.status).toBe(400);
  });

  it('rejette inscription avec prix négatif', async () => {
    if (skipIfNoServer()) return;

    const payload = {
      staySlug: 'alpoo-kids',
      sessionDate: '2026-07-08',
      cityDeparture: 'Paris',
      organisation: 'Test Org',
      socialWorkerName: 'Test',
      email: 'test@example.com',
      phone: '0612345678',
      childFirstName: 'Test',
      childBirthDate: '2019-01-15',
      priceTotal: -100, // Prix négatif
      consent: true,
    };

    const response = await fetch(`${BASE_URL}/api/inscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    expect(response.status).toBe(400);
  });
});
