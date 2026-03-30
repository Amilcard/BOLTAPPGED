import { test, expect } from '@playwright/test';

/**
 * Parcours KIDS — navigation, recherche, wishlist, détail séjour
 * Ne crée aucune inscription — safe en dev et staging.
 */
test.describe('Parcours Kids', () => {

  test('K1 — accueil charge et affiche des séjours', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/.+/);
    // Au moins une carte séjour visible
    const cards = page.locator('[data-testid="stay-card"], .stay-card, article');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
  });

  test('K2 — liste séjours accessible', async ({ page }) => {
    await page.goto('/sejours');
    await expect(page.locator('h1, h2')).toBeVisible({ timeout: 8000 });
    const cards = page.locator('[data-testid="stay-card"], article').first();
    await expect(cards).toBeVisible({ timeout: 10000 });
  });

  test('K3 — page recherche fonctionne', async ({ page }) => {
    await page.goto('/recherche');
    await expect(page.locator('h1, h2, input[type="search"], input[placeholder]')).toBeVisible({ timeout: 8000 });
  });

  test('K4 — page liste d\'envies accessible', async ({ page }) => {
    await page.goto('/envies');
    await expect(page.locator('h1, h2')).toBeVisible({ timeout: 8000 });
  });

  test('K5 — détail séjour charge sans erreur 500', async ({ page }) => {
    // Naviguer depuis la liste pour trouver un slug réel
    await page.goto('/sejours');
    const firstLink = page.locator('a[href^="/sejour/"]').first();
    await expect(firstLink).toBeVisible({ timeout: 10000 });
    const href = await firstLink.getAttribute('href');
    if (!href) return;
    await page.goto(href);
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    // Pas de message d'erreur serveur
    await expect(page.locator('text=/erreur serveur|500|something went wrong/i')).not.toBeVisible();
  });

  test('K6 — bouton wishlist visible sur page séjour', async ({ page }) => {
    await page.goto('/sejours');
    const firstLink = page.locator('a[href^="/sejour/"]').first();
    await expect(firstLink).toBeVisible({ timeout: 10000 });
    const href = await firstLink.getAttribute('href');
    if (!href) return;
    await page.goto(href);
    const wishlistBtn = page.locator('button:has-text("envie"), button:has-text("liste"), button[aria-label*="envie"]');
    await expect(wishlistBtn.first()).toBeVisible({ timeout: 8000 });
  });

  test('K7 — page infos accessible', async ({ page }) => {
    await page.goto('/infos');
    await expect(page.locator('h1, h2, main')).toBeVisible({ timeout: 8000 });
  });

  test('K8 — pages légales accessibles (CGU, CGV, confidentialité)', async ({ page }) => {
    for (const path of ['/cgu', '/cgv', '/confidentialite', '/mentions-legales']) {
      await page.goto(path);
      await expect(page.locator('h1, h2, main')).toBeVisible({ timeout: 8000 });
    }
  });

});
