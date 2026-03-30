import { test, expect } from '@playwright/test';

/**
 * Parcours PRO (référent / travailleur social)
 * Tests du parcours inscription → suivi → dossier enfant.
 * Les tests d'inscription créent de vraies lignes en DB de test.
 * NE PAS lancer contre la production (guard dans playwright.config.ts).
 */

const PRO_DATA = {
  childFirstName: 'Théo',
  childBirthDate: '2015-06-10', // ~9 ans
  socialWorkerName: 'Marie Dupont',
  email: `test.pro.${Date.now()}@yopmail.com`,
  phone: '0612345678',
  structureName: 'Centre Social Test Playwright',
  structurePostalCode: '75011',
  structureCity: 'Paris',
};

test.describe('Parcours Pro — Inscription', () => {

  test('P1 — page séjour accessible en mode pro', async ({ page }) => {
    await page.goto('/sejours');
    const firstLink = page.locator('a[href^="/sejour/"]').first();
    await expect(firstLink).toBeVisible({ timeout: 10000 });
    const href = await firstLink.getAttribute('href');
    if (!href) return;
    await page.goto(href);
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    // Bouton réserver visible
    const reserverBtn = page.locator('button:has-text("Réserver"), a:has-text("Réserver")');
    await expect(reserverBtn.first()).toBeVisible({ timeout: 8000 });
  });

  test('P2 — formulaire inscription Pro s\'ouvre', async ({ page }) => {
    await page.goto('/sejours');
    const firstLink = page.locator('a[href^="/sejour/"]').first();
    await expect(firstLink).toBeVisible({ timeout: 10000 });
    const href = await firstLink.getAttribute('href');
    if (!href) return;
    await page.goto(href);
    const reserverBtn = page.locator('button:has-text("Réserver"), a:has-text("Réserver")').first();
    await reserverBtn.click();
    // Modal ou formulaire s'ouvre
    await expect(page.locator('form, [role="dialog"]')).toBeVisible({ timeout: 8000 });
  });

  test('P3 — validation âge hors limites affiche erreur', async ({ page }) => {
    await page.goto('/sejours');
    const firstLink = page.locator('a[href^="/sejour/"]').first();
    await expect(firstLink).toBeVisible({ timeout: 10000 });
    const href = await firstLink.getAttribute('href');
    if (!href) return;
    await page.goto(href);
    const reserverBtn = page.locator('button:has-text("Réserver"), a:has-text("Réserver")').first();
    await reserverBtn.click();
    await page.waitForTimeout(500);
    // Remplir avec un enfant trop jeune (1 an)
    const birthInput = page.locator('input[name="childBirthDate"]');
    if (await birthInput.isVisible()) {
      await birthInput.fill('2024-01-01');
      const submitBtn = page.locator('button[type="submit"], button:has-text("Valider")').first();
      await submitBtn.click();
      await expect(page.locator('text=/âge|age|limite|invalide/i')).toBeVisible({ timeout: 5000 });
    }
  });

  test('P4 — champs obligatoires manquants affichent erreurs', async ({ page }) => {
    await page.goto('/sejours');
    const firstLink = page.locator('a[href^="/sejour/"]').first();
    await expect(firstLink).toBeVisible({ timeout: 10000 });
    const href = await firstLink.getAttribute('href');
    if (!href) return;
    await page.goto(href);
    const reserverBtn = page.locator('button:has-text("Réserver"), a:has-text("Réserver")').first();
    await reserverBtn.click();
    await page.waitForTimeout(500);
    // Soumettre sans rien remplir
    const submitBtn = page.locator('button[type="submit"], button:has-text("Valider")').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      // Au moins un message d'erreur ou champ invalide
      const hasError = await page.locator(':invalid, [aria-invalid="true"], .error, text=/requis|obligatoire|required/i').count();
      expect(hasError).toBeGreaterThan(0);
    }
  });

});

test.describe('Parcours Pro — Suivi dossier', () => {

  test('P5 — page suivi avec token invalide retourne erreur', async ({ page }) => {
    await page.goto('/suivi/00000000-0000-0000-0000-000000000000');
    await expect(page.locator('text=/introuvable|invalide|expiré|non trouvé/i')).toBeVisible({ timeout: 8000 });
  });

  test('P6 — page suivi avec token non-UUID redirige ou erreur', async ({ page }) => {
    const response = await page.goto('/suivi/invalid-token');
    // Soit 404 soit message d'erreur
    const is404 = response?.status() === 404;
    const hasError = await page.locator('text=/invalide|erreur|introuvable/i').isVisible();
    expect(is404 || hasError).toBeTruthy();
  });

});
