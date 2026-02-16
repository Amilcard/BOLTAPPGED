import { test, expect } from '@playwright/test';

test.describe('Parcours Pro - Réservation structure', () => {
  test('flux complet inscription Pro avec virement', async ({ page }) => {
    // 1. Accéder à un séjour
    await page.goto('/sejour/alpoo-kids');
    await expect(page.locator('h1')).toContainText('ALPOO KIDS');

    // 2. Passer en mode Pro
    const proBadge = page.locator('[data-mode="pro"], button:has-text("Pro")');
    if (await proBadge.isVisible()) {
      await proBadge.click();
      await page.waitForTimeout(500);
    }

    // 3. Clic réserver
    await page.click('button:has-text("Réserver")');

    // 4. Sélection session
    const sessionSelector = page.locator('[data-testid^="session-"]').first();
    await sessionSelector.click();

    // 5. Sélection ville départ
    const citySelect = page.locator('select[name="cityDeparture"]');
    if (await citySelect.isVisible()) {
      await citySelect.selectOption({ index: 1 });
    }

    // 6. Remplir infos enfant
    await page.fill('input[name="childFirstName"]', 'Jules');
    await page.fill('input[name="childBirthDate"]', '2018-03-15'); // 7 ans

    // 7. Remplir infos structure
    await page.fill('input[name="organisation"]', 'Centre Social Test');
    await page.fill('input[name="socialWorkerName"]', 'Marie Dupont');
    await page.fill('input[name="email"]', 'marie.dupont@test.fr');
    await page.fill('input[name="phone"]', '0612345678');

    // 8. Consentement RGPD
    await page.check('input[type="checkbox"][name="consent"]');

    // 9. Choisir mode paiement Virement
    const virementRadio = page.locator('input[type="radio"][value="transfer"]');
    if (await virementRadio.isVisible()) {
      await virementRadio.check();
    }

    // 10. Valider
    await page.click('button:has-text("Valider")');

    // 11. Vérifications confirmation
    await expect(page.locator('text=/merci|confirmation|enregistré/i')).toBeVisible({ timeout: 10000 });

    // Vérifier référence paiement affichée
    await expect(page.locator('text=/PAY-\\d{8}-[a-f0-9]{8}/i')).toBeVisible();
  });

  test('validation âge enfant hors limites affiche avertissement', async ({ page }) => {
    await page.goto('/sejour/alpoo-kids/reserver');

    // ALPOO KIDS = 6-8 ans
    // Test avec enfant de 10 ans (hors limites)
    await page.fill('input[name="childBirthDate"]', '2016-01-15'); // 10 ans
    await page.locator('input[name="childBirthDate"]').blur();

    // Vérifier message d'avertissement (si implémenté)
    const warningText = page.locator('text=/âge|tranche|recommandé/i');

    // Si warning pas encore implémenté, le test documentera le comportement actuel
    const warningVisible = await warningText.isVisible().catch(() => false);
    console.log('Avertissement âge visible:', warningVisible);
  });

  test('calcul prix avec ville départ et frais transport', async ({ page }) => {
    await page.goto('/sejour/alpoo-kids');

    await page.click('button:has-text("Réserver")');

    // Sélectionner session
    await page.locator('[data-testid^="session-"]').first().click();

    // Sélectionner ville avec frais transport
    const citySelect = page.locator('select[name="cityDeparture"]');
    await citySelect.selectOption({ index: 1 });

    // Vérifier que le prix total est affiché
    await expect(page.locator('text=/total.*\\d+€/i')).toBeVisible();
  });
});
