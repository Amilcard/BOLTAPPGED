import { describe, it, expect } from '@jest/globals';

describe('API /api/stays', () => {
  const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  it('retourne liste séjours avec noms CityCrunch', async () => {
    const response = await fetch(`${baseURL}/api/stays`);

    expect(response.status).toBe(200);

    const data = await response.json();

    // Vérifier format réponse
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    // Vérifier structure premier séjour
    const firstStay = data[0];
    expect(firstStay).toHaveProperty('slug');
    expect(firstStay).toHaveProperty('marketing_title');

    // Chercher ALPOO KIDS
    const alpooKids = data.find((s: any) => s.slug === 'alpoo-kids' || s.slug === 'croc-marmotte');

    if (alpooKids) {
      // Vérifier marketing_title présent
      expect(alpooKids.marketing_title).toBeTruthy();

      // Vérifier nom CityCrunch (pas UFOVAL)
      expect(alpooKids.marketing_title).toBe('ALPOO KIDS');
      expect(alpooKids.marketing_title).not.toContain('Marmotte');
    }
  });

  it('tous les séjours ont un slug unique', async () => {
    const response = await fetch(`${baseURL}/api/stays`);
    const data = await response.json();

    const slugs = data.map((s: any) => s.slug);
    const uniqueSlugs = new Set(slugs);

    // Vérifier pas de doublon
    expect(slugs.length).toBe(uniqueSlugs.size);
  });

  it('tous les séjours ont un marketing_title ou title_kids', async () => {
    const response = await fetch(`${baseURL}/api/stays`);
    const data = await response.json();

    data.forEach((stay: any) => {
      const hasTitle = stay.marketing_title || stay.title_kids || stay.title;
      expect(hasTitle).toBeTruthy();
    });
  });

  it('retourne séjour spécifique par slug', async () => {
    const response = await fetch(`${baseURL}/api/stays/alpoo-kids`);

    if (response.status === 404) {
      // Peut-être slug différent, tester croc-marmotte
      const response2 = await fetch(`${baseURL}/api/stays/croc-marmotte`);
      expect(response2.status).toBe(200);
      return;
    }

    expect(response.status).toBe(200);

    const data = await response.json();

    expect(data).toHaveProperty('slug');
    expect(data.slug).toMatch(/alpoo-kids|croc-marmotte/);
  });
});
