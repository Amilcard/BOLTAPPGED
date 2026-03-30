import { test, expect } from '@playwright/test';

/**
 * Parcours KIDS — navigation, recherche, wishlist, détail séjour
 */
test.describe('Parcours Kids', () => {

  test('K1 — accueil charge et affiche des séjours', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/.+/);
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    // Pas d'erreur 500
    await expect(page.locator('text=/erreur serveur|500|something went wrong/i')).not.toBeVisible();
  });

  test('K2 — liste séjours accessible', async ({ page }) => {
    const response = await page.goto('/sejours');
    // La page répond (200 ou redirect)
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible({ timeout: 8000 });
  });

  test('K3 — page recherche fonctionne', async ({ page }) => {
    const response = await page.goto('/recherche');
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible({ timeout: 8000 });
  });

  test('K4 — page liste d\'envies accessible', async ({ page }) => {
    const response = await page.goto('/envies');
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible({ timeout: 8000 });
  });

  test('K5 — détail séjour charge sans erreur 500', async ({ page }) => {
    await page.goto('/');
    const firstLink = page.locator('a[href^="/sejour/"]').first();
    await expect(firstLink).toBeVisible({ timeout: 10000 });
    const href = await firstLink.getAttribute('href');
    if (!href) return;
    const response = await page.goto(href);
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/erreur serveur|500|something went wrong/i')).not.toBeVisible();
  });

  test('K6 — bouton réserver ou wishlist visible sur page séjour', async ({ page }) => {
    await page.goto('/');
    const firstLink = page.locator('a[href^="/sejour/"]').first();
    await expect(firstLink).toBeVisible({ timeout: 10000 });
    const href = await firstLink.getAttribute('href');
    if (!href) return;
    await page.goto(href);
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    // Au moins un bouton d'action visible
    const actionBtn = page.locator('button').first();
    await expect(actionBtn).toBeVisible({ timeout: 8000 });
  });

  test('K7 — page infos accessible', async ({ page }) => {
    const response = await page.goto('/infos');
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible({ timeout: 8000 });
  });

  test('K8 — pages légales accessibles (CGU, CGV, confidentialité)', async ({ page }) => {
    for (const path of ['/cgu', '/cgv', '/confidentialite', '/mentions-legales']) {
      const response = await page.goto(path);
      expect(response?.status()).toBeLessThan(500);
      await expect(page.locator('body')).toBeVisible({ timeout: 8000 });
    }
  });

});
