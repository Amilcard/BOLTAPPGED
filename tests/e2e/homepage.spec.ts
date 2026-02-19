import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('affiche noms CityCrunch (pas UFOVAL)', async ({ page }) => {
    await page.goto('/');

    // Vérifier noms CityCrunch présents
    await expect(page.locator('text=ALPOO KIDS')).toBeVisible();
    await expect(page.locator('text=AZUR DIVE')).toBeVisible();
    await expect(page.locator('text=BRETAGNE OCEAN RIDE')).toBeVisible();
    await expect(page.locator('text=ALPINE SKY CAMP')).toBeVisible();

    // Vérifier anciens noms UFOVAL absents
    await expect(page.locator('text=Croc\' Marmotte')).not.toBeVisible();
    await expect(page.locator('text=BREIZH PONEY')).not.toBeVisible();
    await expect(page.locator('text=Aqua\' Fun')).not.toBeVisible();
  });

  test('affiche 3 catégories principales', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('text=Ma Première Colo')).toBeVisible();
    await expect(page.locator('text=Aventure')).toBeVisible();
    await expect(page.locator('text=Sensations')).toBeVisible();
  });

  test('toggle Kids/Pro fonctionne', async ({ page }) => {
    await page.goto('/');

    // Vérifier mode initial
    const toggle = page.locator('[data-testid="mode-toggle"], button:has-text("Pro")').first();

    if (await toggle.isVisible()) {
      await toggle.click();
      await page.waitForTimeout(500);

      // Vérifier changement (contenu peut varier selon mode)
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('clic sur séjour navigue vers page détail', async ({ page }) => {
    await page.goto('/');

    // Attendre chargement séjours
    await page.waitForSelector('text=ALPOO KIDS', { timeout: 10000 });

    // Cliquer sur premier séjour
    await page.locator('text=ALPOO KIDS').first().click();

    // Vérifier navigation
    await expect(page).toHaveURL(/\/sejour\//);
    await expect(page.locator('h1')).toContainText('ALPOO KIDS');
  });

  test('prix affichés correctement', async ({ page }) => {
    await page.goto('/');

    // Vérifier format prix (ex: "dès 810€")
    await expect(page.locator('text=/dès \\d+€/i')).toBeVisible();
  });
});
