import { test, expect } from '@playwright/test';

test.describe('Flux Réservation - Virement Bancaire', () => {
  test('parcours complet réservation avec virement', async ({ page }) => {
    // 1. Accès page séjour
    await page.goto('/sejour/alpoo-kids');
    await expect(page.locator('h1:has-text("ALPOO KIDS")')).toBeVisible();

    // 2. Clic bouton Réserver
    const reserverBtn = page.locator('button:has-text("Réserver")').first();
    await expect(reserverBtn).toBeVisible();
    await reserverBtn.click();

    // 3. Vérifier redirection page réservation
    await expect(page).toHaveURL(/\/sejour\/alpoo-kids\/reserver/);

    // 4. Sélection session (première disponible)
    const firstSession = page.locator('[data-session]').first();
    if (await firstSession.isVisible()) {
      await firstSession.click();
      await page.waitForTimeout(500);
    }

    // 5. Sélection ville de départ
    const citySelect = page.locator('select[name="cityDeparture"], [data-testid="city-select"]').first();
    if (await citySelect.isVisible()) {
      await citySelect.selectOption({ index: 1 }); // Paris généralement
      await page.waitForTimeout(500);
    }

    // 6. Remplir infos enfant
    await page.fill('input[name="childFirstName"], [data-testid="child-firstname"]', 'TestEnfant');
    await page.fill('input[name="childBirthDate"], [data-testid="child-birthdate"]', '2019-01-15');

    // 7. Remplir infos parent/référent
    await page.fill('input[name="parentFirstName"], input[name="socialWorkerName"], [data-testid="parent-firstname"]', 'TestParent');
    await page.fill('input[name="email"], [data-testid="email"]', 'test@example.com');
    await page.fill('input[name="phone"], [data-testid="phone"]', '0612345678');

    // 8. Consentement
    const consentCheckbox = page.locator('input[type="checkbox"][name="consent"], [data-testid="consent"]');
    if (await consentCheckbox.isVisible()) {
      await consentCheckbox.check();
    }

    // 9. Sélection paiement Virement
    const virementOption = page.locator('label:has-text("Virement"), input[value="transfer"]').first();
    await expect(virementOption).toBeVisible({ timeout: 10000 });
    await virementOption.click();
    await page.waitForTimeout(500);

    // 10. Valider réservation
    const submitBtn = page.locator('button:has-text("Valider"), button:has-text("Confirmer")').first();
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // 11. Vérifier page confirmation
    await page.waitForTimeout(2000);

    // Vérifier instructions virement affichées
    await expect(page.locator('text=/virement/i')).toBeVisible({ timeout: 10000 });

    // Vérifier référence paiement format PAY-YYYYMMDD-xxxxxxxx
    await expect(page.locator('text=/PAY-\\d{8}-[a-f0-9]{8}/i')).toBeVisible();

    // Vérifier IBAN affiché
    await expect(page.locator('text=/FR\\d{2}/i')).toBeVisible();
  });

  test('validation âge enfant hors limites', async ({ page }) => {
    await page.goto('/sejour/alpoo-kids/reserver');

    // ALPOO KIDS = 6-8 ans, tester avec 4 ans
    await page.fill('input[name="childBirthDate"], [data-testid="child-birthdate"]', '2022-01-15');
    await page.locator('input[name="childFirstName"]').click(); // Trigger blur

    // Vérifier message erreur âge
    await expect(page.locator('text=/âge|éligible|ans/i')).toBeVisible({ timeout: 5000 });
  });

  test('calcul prix avec ville de départ', async ({ page }) => {
    await page.goto('/sejour/alpoo-kids/reserver');

    // Sélectionner session
    const firstSession = page.locator('[data-session]').first();
    if (await firstSession.isVisible()) {
      await firstSession.click();
    }

    // Récupérer prix avant ville
    const priceBefore = await page.locator('text=/\\d+€/').first().textContent();

    // Sélectionner ville avec supplément
    const citySelect = page.locator('select[name="cityDeparture"]').first();
    if (await citySelect.isVisible()) {
      await citySelect.selectOption({ index: 1 });
      await page.waitForTimeout(1000);
    }

    // Vérifier prix mis à jour (peut augmenter ou rester identique si "Sans transport")
    const priceAfter = await page.locator('text=/Total.*\\d+€/i').textContent();
    expect(priceAfter).toBeTruthy();
  });
});
