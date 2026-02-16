import { test, expect } from '@playwright/test';

test.describe('Parcours Kids - Liste d\'envies', () => {
  test('flux complet ajout à la wishlist', async ({ page }) => {
    // 1. Accéder à un séjour en mode Kids
    await page.goto('/sejour/alpoo-kids');
    await expect(page.locator('h1')).toContainText('ALPOO KIDS');

    // 2. Vérifier mode Kids actif
    const kidsBadge = page.locator('[data-mode="kids"], button:has-text("Kids")');
    if (await kidsBadge.isVisible()) {
      const isActive = await kidsBadge.getAttribute('data-active');
      if (isActive !== 'true') {
        await kidsBadge.click();
        await page.waitForTimeout(500);
      }
    }

    // 3. Clic "Ajouter à ma liste d'envies"
    const wishlistButton = page.locator('button:has-text("liste d\'envies"), button:has-text("wishlist")');
    await wishlistButton.click();

    // 4. Modal liste d'envies s'ouvre
    await expect(page.locator('[role="dialog"], .modal')).toBeVisible();

    // 5. Remplir infos enfant
    await page.fill('input[name="childName"]', 'Emma');

    // 6. Remplir email éducateur
    await page.fill('input[name="educatorEmail"]', 'educateur@test.fr');

    // 7. Message optionnel
    await page.fill('textarea[name="message"]', 'Emma adore les chevaux !');

    // 8. Valider
    await page.click('button:has-text("Envoyer")');

    // 9. Confirmation
    await expect(page.locator('text=/souhait.*enregistré|merci/i')).toBeVisible({ timeout: 5000 });
  });

  test('consultation liste d\'envies', async ({ page }) => {
    await page.goto('/envies');

    // Vérifier page liste d'envies charge
    await expect(page.locator('h1, h2')).toContainText(/envies|souhaits/i);

    // Si liste vide, vérifier message
    const emptyMessage = page.locator('text=/aucun.*séjour|liste.*vide/i');
    const hasItems = await page.locator('[data-testid="wishlist-item"]').count();

    if (hasItems === 0) {
      await expect(emptyMessage).toBeVisible();
    } else {
      // Vérifier qu'au moins un séjour est affiché
      await expect(page.locator('[data-testid="wishlist-item"]').first()).toBeVisible();
    }
  });
});
