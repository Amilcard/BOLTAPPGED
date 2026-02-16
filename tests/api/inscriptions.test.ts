import { describe, it, expect } from '@jest/globals';

describe('API /api/inscriptions', () => {
  const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  it('crée inscription avec payment_reference auto-généré', async () => {
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

    const response = await fetch(`${baseURL}/api/inscriptions`, {
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
    expect(data).toHaveProperty('payment_reference');
    expect(data).toHaveProperty('status');

    // Vérifier format payment_reference: PAY-YYYYMMDD-xxxxxxxx
    expect(data.payment_reference).toMatch(/^PAY-\d{8}-[a-f0-9]{8}$/);

    // Vérifier status initial
    expect(data.status).toBe('en_attente');
  });

  it('rejette inscription sans consentement', async () => {
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
      consent: false, // ❌ Pas de consentement
    };

    const response = await fetch(`${baseURL}/api/inscriptions`, {
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
    const payload = {
      staySlug: 'alpoo-kids',
      sessionDate: '2026-07-08',
      cityDeparture: 'Paris',
      organisation: 'Test Org',
      socialWorkerName: 'Test',
      email: 'invalid-email', // ❌ Email invalide
      phone: '0612345678',
      childFirstName: 'Test',
      childBirthDate: '2019-01-15',
      priceTotal: 600,
      consent: true,
    };

    const response = await fetch(`${baseURL}/api/inscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    expect(response.status).toBe(400);
  });

  it('rejette inscription avec prix négatif', async () => {
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
      priceTotal: -100, // ❌ Prix négatif
      consent: true,
    };

    const response = await fetch(`${baseURL}/api/inscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    expect(response.status).toBe(400);
  });
});
