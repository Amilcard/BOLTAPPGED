import { test, expect } from '@playwright/test';

test.describe('Page Vérification DB - Anti-régression', () => {
  test('affiche tableau vérification 24 séjours', async ({ page }) => {
    await page.goto('/verify-db');

    // Vérifier titre page
    await expect(page.locator('h1')).toContainText('Vérification');

    // Vérifier tableau présent
    await expect(page.locator('table')).toBeVisible();

    // Vérifier headers tableau
    await expect(page.locator('th:has-text("Status")')).toBeVisible();
    await expect(page.locator('th:has-text("Slug")')).toBeVisible();
    await expect(page.locator('th:has-text("Nom")')).toBeVisible();
  });

  test('aucune régression CityCrunch détectée', async ({ page }) => {
    await page.goto('/verify-db');

    // Attendre chargement données
    await page.waitForSelector('table tbody tr', { timeout: 10000 });

    // Vérifier stats affichées
    const okStat = page.locator('text=/\\d+.*OK/i').first();
    await expect(okStat).toBeVisible();

    // Extraire nombre OK
    const okText = await okStat.textContent();
    const okCount = parseInt(okText?.match(/\d+/)?.[0] || '0');

    // Vérifier au moins 20 séjours OK (sur 24)
    expect(okCount).toBeGreaterThanOrEqual(20);

    // Vérifier stat Dangers
    const dangerStat = page.locator('text=/\\d+.*Danger/i').first();
    const dangerText = await dangerStat.textContent();
    const dangerCount = parseInt(dangerText?.match(/\d+/)?.[0] || '0');

    // AUCUNE régression acceptée
    expect(dangerCount).toBe(0);
  });

  test('vérifie présence noms CityCrunch dans tableau', async ({ page }) => {
    await page.goto('/verify-db');

    await page.waitForSelector('table tbody tr', { timeout: 10000 });

    // Vérifier présence séjours clés
    await expect(page.locator('td:has-text("ALPOO KIDS")')).toBeVisible();
    await expect(page.locator('td:has-text("AZUR DIVE")')).toBeVisible();
    await expect(page.locator('td:has-text("BRETAGNE OCEAN RIDE")')).toBeVisible();

    // Vérifier ABSENCE anciens noms
    await expect(page.locator('td:has-text("Croc\' Marmotte")')).not.toBeVisible();
  });

  test('message succès si aucune régression', async ({ page }) => {
    await page.goto('/verify-db');

    await page.waitForSelector('table', { timeout: 10000 });

    // Chercher message succès ou alerte
    const successMsg = page.locator('text=/aucune régression|tous.*ok/i');
    const dangerMsg = page.locator('text=/régression.*détectée/i');

    // Au moins un des deux doit être visible
    const hasSuccess = await successMsg.isVisible();
    const hasDanger = await dangerMsg.isVisible();

    expect(hasSuccess || hasDanger).toBeTruthy();

    // Si danger visible, fail le test
    if (hasDanger) {
      throw new Error('❌ Régressions détectées dans la base de données !');
    }
  });

  test('affiche source données pour chaque séjour', async ({ page }) => {
    await page.goto('/verify-db');

    await page.waitForSelector('table tbody tr', { timeout: 10000 });

    // Vérifier colonne source affichée
    await expect(page.locator('th:has-text("Source")')).toBeVisible();

    // Vérifier au moins une source "CityCrunch Premium"
    await expect(page.locator('td:has-text("CityCrunch Premium")')).toBeVisible();
  });
});
