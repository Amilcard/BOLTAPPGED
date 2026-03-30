import { test, expect } from '@playwright/test';

/**
 * Parcours Espace Structure
 * Tests de l'accès par code, login, et dashboard inscriptions.
 */

test.describe('Espace Structure — Accès', () => {

  test('S1 — page login structure accessible', async ({ page }) => {
    await page.goto('/structure/login');
    await expect(page.locator('h1, h2, form')).toBeVisible({ timeout: 8000 });
    // Champ code visible
    const codeInput = page.locator('input[name="code"], input[placeholder*="code"], input[type="text"]').first();
    await expect(codeInput).toBeVisible({ timeout: 5000 });
  });

  test('S2 — code invalide affiche erreur', async ({ page }) => {
    await page.goto('/structure/login');
    const codeInput = page.locator('input[name="code"], input[placeholder*="code"], input[type="text"]').first();
    await expect(codeInput).toBeVisible({ timeout: 8000 });
    await codeInput.fill('XXXXXX');
    const submitBtn = page.locator('button[type="submit"], button:has-text("Accéder"), button:has-text("Connexion")').first();
    await submitBtn.click();
    await expect(page.locator('text=/invalide|introuvable|incorrect|erreur/i')).toBeVisible({ timeout: 8000 });
  });

  test('S3 — code vide affiche validation', async ({ page }) => {
    await page.goto('/structure/login');
    const submitBtn = page.locator('button[type="submit"], button:has-text("Accéder"), button:has-text("Connexion")').first();
    await expect(submitBtn).toBeVisible({ timeout: 8000 });
    await submitBtn.click();
    const hasError = await page.locator(':invalid, .error, text=/requis|obligatoire|renseigner/i').count();
    expect(hasError).toBeGreaterThan(0);
  });

  test('S4 — page structure avec code invalide retourne erreur', async ({ page }) => {
    await page.goto('/structure/XXXXXX');
    await expect(page.locator('text=/introuvable|invalide|erreur|not found/i')).toBeVisible({ timeout: 8000 });
  });

  test('S5 — dashboard structure protégé sans authentification', async ({ page }) => {
    // Une URL de structure sans s\'être authentifié doit soit rediriger soit afficher erreur
    const response = await page.goto('/structure/AAAAAA');
    const redirectedToLogin = page.url().includes('/login') || page.url().includes('/structure/login');
    const hasErrorMsg = await page.locator('text=/introuvable|invalide|accès/i').isVisible();
    const is404 = response?.status() === 404;
    expect(redirectedToLogin || hasErrorMsg || is404).toBeTruthy();
  });

});
