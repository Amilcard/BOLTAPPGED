import { test, expect } from '@playwright/test';

/**
 * Parcours Admin (GED)
 * Tests de l'auth, protection des routes, et accès aux pages admin.
 * Ne modifie aucune donnée en production.
 */

test.describe('Admin GED — Auth', () => {

  test('A1 — page login admin accessible', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('form, input[type="email"], input[name="email"]')).toBeVisible({ timeout: 8000 });
  });

  test('A2 — identifiants invalides affichent erreur générique', async ({ page }) => {
    await page.goto('/login');
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    await expect(emailInput).toBeVisible({ timeout: 8000 });
    await emailInput.fill('attaquant@evil.com');
    await passwordInput.fill('mauvais-mdp');
    await page.click('button[type="submit"], button:has-text("Connexion")');
    // Message générique (pas de mention email/mot de passe séparément)
    await expect(page.locator('text=/invalide|incorrect|identifiant/i')).toBeVisible({ timeout: 8000 });
    // Pas de message révélant si l'email existe
    await expect(page.locator('text=/email.*inexistant|compte.*introuvable/i')).not.toBeVisible();
  });

  test('A3 — champs vides affichent validation', async ({ page }) => {
    await page.goto('/login');
    const submitBtn = page.locator('button[type="submit"], button:has-text("Connexion")').first();
    await expect(submitBtn).toBeVisible({ timeout: 8000 });
    await submitBtn.click();
    const hasError = await page.locator(':invalid, .error, text=/requis|obligatoire/i').count();
    expect(hasError).toBeGreaterThan(0);
  });

});

test.describe('Admin GED — Protection routes', () => {

  test('A4 — /admin redirige vers login si non authentifié', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForURL(/login|\/admin/, { timeout: 8000 });
    const isOnLogin = page.url().includes('login');
    const hasLoginForm = await page.locator('input[type="email"], input[type="password"]').count() > 0;
    expect(isOnLogin || hasLoginForm).toBeTruthy();
  });

  test('A5 — /admin/demandes protégé', async ({ page }) => {
    await page.goto('/admin/demandes');
    const isProtected =
      page.url().includes('login') ||
      (await page.locator('text=/connexion|authentifi|accès refusé/i').isVisible());
    expect(isProtected).toBeTruthy();
  });

  test('A6 — /admin/sejours protégé', async ({ page }) => {
    await page.goto('/admin/sejours');
    const isProtected =
      page.url().includes('login') ||
      (await page.locator('text=/connexion|authentifi|accès refusé/i').isVisible());
    expect(isProtected).toBeTruthy();
  });

  test('A7 — /admin/structures protégé', async ({ page }) => {
    await page.goto('/admin/structures');
    const isProtected =
      page.url().includes('login') ||
      (await page.locator('text=/connexion|authentifi|accès refusé/i').isVisible());
    expect(isProtected).toBeTruthy();
  });

  test('A8 — /admin/users protégé', async ({ page }) => {
    await page.goto('/admin/users');
    const isProtected =
      page.url().includes('login') ||
      (await page.locator('text=/connexion|authentifi|accès refusé/i').isVisible());
    expect(isProtected).toBeTruthy();
  });

});

test.describe('Admin GED — Rate limiting login', () => {

  test('A9 — 5 tentatives échouées déclenchent rate limit', async ({ page }) => {
    await page.goto('/login');
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    const submitBtn = page.locator('button[type="submit"], button:has-text("Connexion")').first();

    await expect(emailInput).toBeVisible({ timeout: 8000 });

    // 5 tentatives rapides
    for (let i = 0; i < 5; i++) {
      await emailInput.fill('test@test.fr');
      await passwordInput.fill(`mauvais-${i}`);
      await submitBtn.click();
      await page.waitForTimeout(300);
    }

    // La 6ème doit être bloquée par rate limit
    await emailInput.fill('test@test.fr');
    await passwordInput.fill('encore-mauvais');
    await submitBtn.click();
    await expect(page.locator('text=/tentatives|réessayez|bloqué|limite/i')).toBeVisible({ timeout: 8000 });
  });

});
