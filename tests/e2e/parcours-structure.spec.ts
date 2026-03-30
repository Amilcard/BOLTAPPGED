import { test, expect } from '@playwright/test';

/**
 * Parcours Espace Structure
 */

test.describe('Espace Structure — Accès', () => {

  test('S1 — page login structure accessible', async ({ page }) => {
    const response = await page.goto('/structure/login');
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible({ timeout: 8000 });
    // Un champ de saisie visible
    await expect(page.locator('input').first()).toBeVisible({ timeout: 5000 });
  });

  test('S2 — code invalide affiche erreur', async ({ page }) => {
    await page.goto('/structure/login');
    const input = page.locator('input').first();
    await expect(input).toBeVisible({ timeout: 8000 });
    await input.fill('XXXXXX');
    const submitBtn = page.locator('button[type="submit"], button').first();
    await submitBtn.click();
    // Erreur visible ou redirection vers page erreur
    const hasError = await page.locator('text=/invalide|introuvable|incorrect|erreur|not found/i').isVisible({ timeout: 8000 });
    const redirectedToError = page.url().includes('error') || page.url().includes('invalid');
    expect(hasError || redirectedToError).toBeTruthy();
  });

  test('S3 — soumission sans code affiche validation', async ({ page }) => {
    await page.goto('/structure/login');
    const submitBtn = page.locator('button[type="submit"], button').first();
    await expect(submitBtn).toBeVisible({ timeout: 8000 });
    await submitBtn.click();
    // Validation HTML5 native ou message d'erreur
    const hasValidation = await page.locator(':invalid').count() > 0;
    const hasErrorMsg = await page.locator('text=/requis|obligatoire|renseigner|code/i').isVisible({ timeout: 3000 });
    expect(hasValidation || hasErrorMsg).toBeTruthy();
  });

  test('S4 — page structure avec code invalide — statut < 500', async ({ page }) => {
    const response = await page.goto('/structure/XXXXXX');
    // Ne doit pas planter avec une 500
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible({ timeout: 8000 });
  });

  test('S5 — dashboard structure non accessible sans auth', async ({ page }) => {
    await page.goto('/structure/AAAAAA');
    // Soit redirect login, soit 404, soit erreur — jamais le dashboard réel
    const isNotDashboard =
      page.url().includes('login') ||
      !(await page.locator('text=/inscriptions|dossiers|tableau de bord/i').isVisible({ timeout: 3000 }));
    expect(isNotDashboard).toBeTruthy();
  });

});
