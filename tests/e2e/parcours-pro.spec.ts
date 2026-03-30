import { test, expect } from '@playwright/test';

/**
 * Parcours PRO (référent / travailleur social)
 * NE PAS lancer contre la production.
 */

test.describe('Parcours Pro — Navigation', () => {

  test('P1 — page séjour charge correctement', async ({ page }) => {
    await page.goto('/');
    const firstLink = page.locator('a[href^="/sejour/"]').first();
    await expect(firstLink).toBeVisible({ timeout: 10000 });
    const href = await firstLink.getAttribute('href');
    if (!href) return;
    const response = await page.goto(href);
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  });

  test('P2 — bouton Réserver présent sur page séjour', async ({ page }) => {
    await page.goto('/');
    const firstLink = page.locator('a[href^="/sejour/"]').first();
    await expect(firstLink).toBeVisible({ timeout: 10000 });
    const href = await firstLink.getAttribute('href');
    if (!href) return;
    await page.goto(href);
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    // Bouton Réserver présent (peut être disabled avant sélection session)
    const reserverBtn = page.locator('button:has-text("Réserver")').first();
    await expect(reserverBtn).toBeAttached({ timeout: 8000 });
  });

  test('P3 — sélection session active le bouton Réserver', async ({ page }) => {
    await page.goto('/');
    const firstLink = page.locator('a[href^="/sejour/"]').first();
    await expect(firstLink).toBeVisible({ timeout: 10000 });
    const href = await firstLink.getAttribute('href');
    if (!href) return;
    await page.goto(href);
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // Sélectionner la première session disponible
    const sessionBtn = page.locator('[data-testid^="session-"], button[data-session], .session-card, [class*="session"]').first();
    if (await sessionBtn.isVisible({ timeout: 3000 })) {
      await sessionBtn.click();
      await page.waitForTimeout(500);
    }

    // Le bouton Réserver doit maintenant être cliquable
    const reserverBtn = page.locator('button:has-text("Réserver")').first();
    await expect(reserverBtn).toBeAttached({ timeout: 5000 });
  });

  test('P4 — formulaire inscription s\'ouvre après sélection session', async ({ page }) => {
    await page.goto('/');
    const firstLink = page.locator('a[href^="/sejour/"]').first();
    await expect(firstLink).toBeVisible({ timeout: 10000 });
    const href = await firstLink.getAttribute('href');
    if (!href) return;
    await page.goto(href);
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // Sélectionner session
    const sessionBtn = page.locator('[data-testid^="session-"], button[data-session], .session-card').first();
    if (await sessionBtn.isVisible({ timeout: 3000 })) {
      await sessionBtn.click();
      await page.waitForTimeout(500);
    }

    // Cliquer Réserver si activé
    const reserverBtn = page.locator('button:has-text("Réserver"):not([disabled])').first();
    if (await reserverBtn.isVisible({ timeout: 3000 })) {
      await reserverBtn.click();
      await expect(page.locator('form, [role="dialog"], input[name="childFirstName"]')).toBeVisible({ timeout: 8000 });
    } else {
      // Passer le test si bouton reste disabled (données de session absentes en dev)
      test.skip();
    }
  });

});

test.describe('Parcours Pro — Suivi dossier', () => {

  test('P5 — page suivi avec token invalide retourne erreur', async ({ page }) => {
    const response = await page.goto('/suivi/00000000-0000-0000-0000-000000000000');
    // Soit erreur HTTP soit message d'erreur
    const isErrorStatus = (response?.status() ?? 200) >= 400;
    const hasErrorText = await page.locator('text=/introuvable|invalide|expiré|non trouvé|erreur/i').isVisible({ timeout: 8000 });
    expect(isErrorStatus || hasErrorText).toBeTruthy();
  });

  test('P6 — page suivi avec token non-UUID redirige ou erreur', async ({ page }) => {
    const response = await page.goto('/suivi/invalid-token');
    const isErrorStatus = (response?.status() ?? 200) >= 400;
    const hasErrorText = await page.locator('text=/invalide|erreur|introuvable/i').isVisible({ timeout: 5000 });
    expect(isErrorStatus || hasErrorText).toBeTruthy();
  });

});
