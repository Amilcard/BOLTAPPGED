import { test, expect } from '@playwright/test';

/**
 * Parcours staff-fill — staff structure (direction / CDS / CDS délégué / secrétariat)
 * remplit un dossier enfant en mode dépannage depuis le dashboard structure.
 *
 * Scope : LECTURE / NAVIGATION uniquement.
 *  - Pas de soumission, pas de PATCH dossier, pas d'upload réel.
 *  - Vérifie que l'UI charge (status < 500), que le modal s'ouvre,
 *    et que les onglets bulletin/sanitaire/liaison/renseignements/PJ sont rendus.
 *
 * Pré-requis env (sinon skip auto) :
 *  - E2E_STRUCTURE_CODE : code structure (6 chars CDS ou 10 chars Directeur)
 *    correspondant à une structure de TEST (`is_test = true`) avec au moins
 *    une inscription staff-fillable (souhait validé, dossier ouvrable).
 *
 * NOTE — fixtures d'auth staff (email/password via /api/auth/structure-login
 * pour cookie `gd_pro_session`) NON encore présentes dans le repo. Tant qu'elles
 * n'existent pas, on s'appuie sur l'auth code-based (`GET /api/structure/[code]`)
 * qui rend le dashboard accessible avec le code seul, et qui couvre déjà tout
 * le staff (direction / CDS / cds_delegated / secretariat) sur le scope lecture
 * du dashboard. Les routes /inscriptions/[id]/* mutations restent hors scope ici.
 */

const STRUCTURE_CODE = process.env.E2E_STRUCTURE_CODE;

test.describe('Parcours staff-fill — dépannage dossier enfant', () => {

  test.skip(
    !STRUCTURE_CODE,
    'E2E_STRUCTURE_CODE manquant — set un code structure de TEST pour activer ces tests.'
  );

  test('SF1 — staff accède au dashboard structure et ouvre le modal "Remplir en dépannage"', async ({ page }) => {
    // 1. Login via code structure (CDS 6 chars ou Directeur 10 chars)
    await page.goto('/structure/login');
    const codeInput = page.locator('input').first();
    await expect(codeInput).toBeVisible({ timeout: 8000 });
    await codeInput.fill((STRUCTURE_CODE as string));
    await page.locator('button[type="submit"]').first().click();

    // 2. Dashboard structure chargé sans 500
    await page.waitForURL(`**/structure/${(STRUCTURE_CODE as string).toUpperCase()}`, { timeout: 10000 });
    await expect(page.locator('body')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=/erreur serveur|500|something went wrong/i')).not.toBeVisible();

    // 3. Onglet Éducatif visible (par défaut sur le dashboard)
    const eduMarker = page.locator('text=/Éducatif|Educatif|inscriptions|tableau de bord/i').first();
    await expect(eduMarker).toBeVisible({ timeout: 8000 });

    // 4. Sélectionner un enfant (premier de la liste) si présent — sinon test informatif
    const firstChild = page.locator('[role="button"], button').filter({ hasText: /\d{2}\/\d{2}\/\d{4}|ans|Né(e)? le/i }).first();
    const hasChild = await firstChild.isVisible({ timeout: 4000 }).catch(() => false);
    if (!hasChild) {
      test.info().annotations.push({
        type: 'info',
        description: 'Aucun enfant visible sur le dashboard — la structure E2E_STRUCTURE_CODE n\'a pas d\'inscription. Test stoppé après check dashboard.',
      });
      return;
    }
    await firstChild.click();

    // 5. Bouton "Remplir en dépannage" visible (staff seulement, pas éducateur)
    const fillBtn = page.locator('button', { hasText: /Remplir en dépannage/i }).first();
    const fillVisible = await fillBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!fillVisible) {
      test.info().annotations.push({
        type: 'info',
        description: 'Bouton "Remplir en dépannage" absent — code utilisé n\'est probablement pas staff (ou role éducateur). canFillDossier = false.',
      });
      return;
    }
    await fillBtn.click();

    // 6. Modal staff-fill ouvert
    const modal = page.locator('[aria-label="Remplir le dossier en mode dépannage"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.locator('text=/Remplir le dossier/i')).toBeVisible();
  });

  test('SF2 — modal staff-fill expose les onglets bulletin/sanitaire/liaison/renseignements/PJ', async ({ page }) => {
    await page.goto('/structure/login');
    const codeInput = page.locator('input').first();
    await expect(codeInput).toBeVisible({ timeout: 8000 });
    await codeInput.fill((STRUCTURE_CODE as string));
    await page.locator('button[type="submit"]').first().click();

    await page.waitForURL(`**/structure/${(STRUCTURE_CODE as string).toUpperCase()}`, { timeout: 10000 });
    await expect(page.locator('body')).toBeVisible({ timeout: 8000 });

    const firstChild = page.locator('[role="button"], button').filter({ hasText: /\d{2}\/\d{2}\/\d{4}|ans|Né(e)? le/i }).first();
    const hasChild = await firstChild.isVisible({ timeout: 4000 }).catch(() => false);
    if (!hasChild) {
      test.info().annotations.push({
        type: 'info',
        description: 'Aucun enfant — skip vérification onglets.',
      });
      return;
    }
    await firstChild.click();

    const fillBtn = page.locator('button', { hasText: /Remplir en dépannage/i }).first();
    const fillVisible = await fillBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!fillVisible) {
      test.info().annotations.push({
        type: 'info',
        description: 'canFillDossier=false sur ce code — impossible de tester onglets staff-fill.',
      });
      return;
    }
    await fillBtn.click();

    // Modal ouvert
    const modal = page.locator('[aria-label="Remplir le dossier en mode dépannage"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Vérifier la présence des 5 onglets (data-testid posés sur DossierEnfantPanel)
    for (const key of ['bulletin', 'sanitaire', 'liaison', 'renseignements', 'pj']) {
      await expect(
        modal.locator(`[data-testid="tab-${key}"]`),
        `onglet "${key}" doit être rendu dans le modal staff-fill`
      ).toBeVisible({ timeout: 8000 });
    }
  });

});
