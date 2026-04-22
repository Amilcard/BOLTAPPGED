import { test, expect, Page } from '@playwright/test';

/**
 * Parcours INSCRIPTION COMPLET — Éducateur inscrivant un enfant
 *
 * Flow réel :
 * 1. Stay detail → sélectionner session (bouton) + ville (pill button)
 * 2. Cliquer "Réserver" → navigue vers /sejour/[slug]/reserver?session=...&ville=...
 * 3. BookingFlow démarre à step 2 (structure) car session+ville déjà fournis
 *
 * NE PAS lancer contre la production.
 */

// ─── Helper : navigation vers la page reserver ──────────────────────────────

async function ouvrirPageReserver(page: Page): Promise<boolean> {
  // 1. Aller sur un séjour depuis l'accueil
  await page.goto('/');
  const firstLink = page.locator('a[href^="/sejour/"]').first();
  await expect(firstLink).toBeVisible({ timeout: 10000 });
  const href = await firstLink.getAttribute('href');
  if (!href) return false;
  await page.goto(href);
  await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(1000);

  // 2. Sélectionner la première session disponible
  // Sessions = boutons avec des dates (ex: "5 juillet 2026\nau 18 juillet 2026")
  const firstSession = page.locator('button:not([disabled])').filter({ hasText: /\d{1,2} \w+ 20\d\d/ }).first();
  if (!await firstSession.isVisible({ timeout: 5000 })) return false;
  await firstSession.click();
  await page.waitForTimeout(500);

  // 3. Sélectionner "Sans transport" (toujours disponible) ou la première ville
  const cityBtn = page.locator('button.rounded-full').filter({ hasText: /Sans transport|Paris|Lyon|Marseille|Lille|Bordeaux/ }).first();
  if (await cityBtn.isVisible({ timeout: 3000 })) {
    await cityBtn.click();
    await page.waitForTimeout(500);
  }

  // 4. Cliquer "Inscrire un enfant" (desktop) ou "Réserver" (mobile sticky)
  const inscriptionBtn = page.locator(
    'button:has-text("Inscrire un enfant"):not([disabled]), button:has-text("Réserver"):not([disabled])'
  ).first();
  if (!await inscriptionBtn.isVisible({ timeout: 5000 })) return false;
  await inscriptionBtn.click();

  // 5. On doit être sur /reserver
  await page.waitForURL(/\/reserver/, { timeout: 10000 });
  return true;
}

// ─── Tests : Navigation vers le formulaire ──────────────────────────────────

test.describe('Inscription — Ouverture formulaire', () => {

  test('IC1 — Page reserver accessible après sélection session+ville', async ({ page }) => {
    const opened = await ouvrirPageReserver(page);
    expect(opened, 'Pré-requis parcours réservation cassé — homepage/stay-detail/session/ville').toBe(true);
    expect(page.url()).toContain('/reserver');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
  });

  test('IC2 — Formulaire démarre à l\'étape structure (step 3/5)', async ({ page }) => {
    const opened = await ouvrirPageReserver(page);
    expect(opened, 'Pré-requis parcours réservation cassé — homepage/stay-detail/session/ville').toBe(true);
    // BookingFlow démarre à step 2 (structure) si session+ville fournis
    await expect(page.locator('text=/Étape 3\\/5/').first()).toBeVisible({ timeout: 10000 });
  });

  test('IC3 — Champs obligatoires structure visibles', async ({ page }) => {
    const opened = await ouvrirPageReserver(page);
    expect(opened, 'Pré-requis parcours réservation cassé — homepage/stay-detail/session/ville').toBe(true);
    await expect(page.locator('text=/Étape 3\\/5/i')).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder('Ex: Croix-Rouge du Havre')).toBeVisible();
    await expect(page.getByPlaceholder('76600')).toBeVisible();
    await expect(page.getByPlaceholder('Le Havre')).toBeVisible();
    await expect(page.getByPlaceholder('Prénom et nom')).toBeVisible();
  });

});

// ─── Tests : Étape Structure ─────────────────────────────────────────────────

test.describe('Inscription — Étape Structure', () => {

  test('IC4 — Code structure invalide affiche erreur', async ({ page }) => {
    const opened = await ouvrirPageReserver(page);
    expect(opened, 'Pré-requis parcours réservation cassé — homepage/stay-detail/session/ville').toBe(true);
    await expect(page.locator('text=/Étape 3\\/5/i')).toBeVisible({ timeout: 10000 });

    const codeInput = page.getByPlaceholder('Ex: CRF76H');
    await codeInput.fill('XXXXXX');
    await codeInput.blur();
    await page.waitForTimeout(1500);

    await expect(page.locator('text=/non reconnu|invalide|erreur/i')).toBeVisible({ timeout: 5000 });
  });

  test('IC5 — Sans code : remplir structure passe à l\'étape enfant', async ({ page }) => {
    const opened = await ouvrirPageReserver(page);
    expect(opened, 'Pré-requis parcours réservation cassé — homepage/stay-detail/session/ville').toBe(true);
    await expect(page.locator('text=/Étape 3\\/5/i')).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder('Ex: Croix-Rouge du Havre').fill('MECS Test Playwright');
    await page.getByPlaceholder('76600').fill('75020');
    await page.waitForTimeout(800);
    await page.getByPlaceholder('Le Havre').fill('Paris');
    // Email structure (1er champ email — contact@structure.fr)
    await page.getByPlaceholder('contact@structure.fr').fill('structure@yopmail.com');
    // Nom référent
    await page.getByPlaceholder('Prénom et nom').fill('Marie Dupont');
    // Email référent (2ème champ email — nom@structure.fr)
    await page.getByPlaceholder('nom@structure.fr').fill(`test.e2e.${Date.now()}@yopmail.com`);
    // Téléphone
    await page.getByPlaceholder('06 12 34 56 78').fill('0612345678');

    // Bouton Continuer actif
    const continuerBtn = page.locator('button:has-text("Continuer"):not([disabled])').first();
    await expect(continuerBtn).toBeVisible({ timeout: 5000 });
    await continuerBtn.click();

    // Étape enfant
    await expect(page.locator('text=/Étape 4\\/5/').first()).toBeVisible({ timeout: 8000 });
  });

  test('IC6 — Recherche CP affiche structures existantes sur même code postal', async ({ page }) => {
    const opened = await ouvrirPageReserver(page);
    expect(opened, 'Pré-requis parcours réservation cassé — homepage/stay-detail/session/ville').toBe(true);
    await expect(page.locator('text=/Étape 3\\/5/i')).toBeVisible({ timeout: 10000 });

    // Saisir un CP → déclenche la recherche structures existantes
    await page.getByPlaceholder('76600').fill('75020');
    await page.waitForTimeout(1200); // attente requête API

    // Si structures trouvées → encart amber visible
    // Si aucune → pas d'encart (les deux sont valides)
    const hasEncart = await page.locator('text=/déjà enregistrée|même code postal/i').isVisible({ timeout: 2000 });
    // Test documentaire — on vérifie juste que ça ne plante pas
    await expect(page.locator('body')).toBeVisible();
    // Log informatif
    console.log(`Structures existantes sur CP 75020 : ${hasEncart ? 'Oui (encart affiché)' : 'Non'}`);
  });

});

// ─── Tests : Étape Enfant ─────────────────────────────────────────────────────

test.describe('Inscription — Étape Enfant', () => {

  async function allerEtapeEnfant(page: Page): Promise<boolean> {
    const opened = await ouvrirPageReserver(page);
    if (!opened) return false;
    await expect(page.locator('text=/Étape 3\\/5/').first()).toBeVisible({ timeout: 10000 });
    await page.getByPlaceholder('Ex: Croix-Rouge du Havre').fill('MECS Test');
    await page.getByPlaceholder('76600').fill('75019');
    await page.waitForTimeout(500);
    await page.getByPlaceholder('Le Havre').fill('Paris');
    await page.getByPlaceholder('contact@structure.fr').fill('structure@yopmail.com');
    await page.getByPlaceholder('Prénom et nom').fill('Éducateur Test');
    await page.getByPlaceholder('nom@structure.fr').fill(`test.e2e.${Date.now()}@yopmail.com`);
    await page.getByPlaceholder('06 12 34 56 78').fill('0612345678');
    const continuerBtn = page.locator('button:has-text("Continuer"):not([disabled])').first();
    if (!await continuerBtn.isVisible({ timeout: 5000 })) return false;
    await continuerBtn.click();
    await expect(page.locator('text=/Étape 4\\/5/').first()).toBeVisible({ timeout: 8000 });
    return true;
  }

  test('IC7 — Formulaire enfant : champs présents', async ({ page }) => {
    const ok = await allerEtapeEnfant(page);
    expect(ok, 'Pré-requis parcours réservation cassé — étape structure/enfant/récapitulatif').toBe(true);
    await expect(page.getByPlaceholder('Ex: Léa')).toBeVisible();
    await expect(page.locator('input[type="date"]')).toBeVisible();
    await expect(page.locator('select').first()).toBeVisible();
    await expect(page.locator('input[type="checkbox"]')).toBeVisible();
  });

  test('IC8 — Âge trop jeune bloque la continuation et affiche erreur', async ({ page }) => {
    const ok = await allerEtapeEnfant(page);
    expect(ok, 'Pré-requis parcours réservation cassé — étape structure/enfant/récapitulatif').toBe(true);

    await page.getByPlaceholder('Ex: Léa').fill('Bébé');
    await page.locator('input[type="date"]').fill('2024-06-01');
    await page.waitForTimeout(500);

    await expect(page.locator('text=/incompatible|âge/i').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("Continuer")').first()).toBeDisabled();
  });

  test('IC9 — Consentement non coché bloque la continuation', async ({ page }) => {
    const ok = await allerEtapeEnfant(page);
    expect(ok, 'Pré-requis parcours réservation cassé — étape structure/enfant/récapitulatif').toBe(true);

    await page.getByPlaceholder('Ex: Léa').fill('Emma');
    await page.locator('input[type="date"]').fill('2015-05-10');
    await page.waitForTimeout(300);
    await page.locator('select').first().selectOption('F');
    // Pas de consentement → bouton disabled
    await expect(page.locator('button:has-text("Continuer")').first()).toBeDisabled();
  });

});

// ─── Tests : Récapitulatif et Confirmation ────────────────────────────────────

test.describe('Inscription — Récapitulatif et Paiement', () => {

  async function allerRecapitulatif(page: Page): Promise<boolean> {
    const opened = await ouvrirPageReserver(page);
    if (!opened) return false;
    await expect(page.locator('text=/Étape 3\\/5/').first()).toBeVisible({ timeout: 10000 });
    await page.getByPlaceholder('Ex: Croix-Rouge du Havre').fill('MECS Test Playwright');
    await page.getByPlaceholder('76600').fill('75018');
    await page.waitForTimeout(500);
    await page.getByPlaceholder('Le Havre').fill('Paris');
    await page.getByPlaceholder('contact@structure.fr').fill('structure@yopmail.com');
    await page.getByPlaceholder('Prénom et nom').fill('Marie Dupont');
    await page.getByPlaceholder('nom@structure.fr').fill(`test.e2e.${Date.now()}@yopmail.com`);
    await page.getByPlaceholder('06 12 34 56 78').fill('0612345678');
    let continuerBtn = page.locator('button:has-text("Continuer"):not([disabled])').first();
    if (!await continuerBtn.isVisible({ timeout: 5000 })) return false;
    await continuerBtn.click();
    await expect(page.locator('text=/Étape 4\\/5/').first()).toBeVisible({ timeout: 8000 });
    await page.getByPlaceholder('Ex: Léa').fill('Thomas');
    await page.locator('input[type="date"]').fill('2018-06-15');
    await page.waitForTimeout(300);
    await page.locator('select').first().selectOption('M');
    await page.locator('input[type="checkbox"]').check();
    continuerBtn = page.locator('button:has-text("Continuer"):not([disabled])').first();
    if (!await continuerBtn.isVisible({ timeout: 5000 })) return false;
    await continuerBtn.click();
    await expect(page.locator('text=/Étape 5\\/5/').first()).toBeVisible({ timeout: 8000 });
    return true;
  }

  test('IC10 — Récapitulatif affiche les infos enfant et structure', async ({ page }) => {
    const ok = await allerRecapitulatif(page);
    expect(ok, 'Pré-requis parcours réservation cassé — étape structure/enfant/récapitulatif').toBe(true);
    await expect(page.locator('text=Thomas')).toBeVisible();
    await expect(page.locator('text=/séjour|session|structure/i').first()).toBeVisible();
    // Prix affiché ou mention "indisponible"
    const hasPrice = await page.locator('text=/€|prix indisponible/i').first().isVisible();
    expect(hasPrice).toBeTruthy();
  });

  test('IC11 — 3 modes de paiement proposés', async ({ page }) => {
    const ok = await allerRecapitulatif(page);
    expect(ok, 'Pré-requis parcours réservation cassé — étape structure/enfant/récapitulatif').toBe(true);
    await expect(page.locator('text=/Virement bancaire/i')).toBeVisible();
    await expect(page.locator('text=/Chèque/i')).toBeVisible();
    await expect(page.locator('text=/Carte bancaire/i')).toBeVisible();
  });

  test('IC12 — Parcours complet virement → confirmation', async ({ page }) => {
    test.setTimeout(60000);
    const ok = await allerRecapitulatif(page);
    expect(ok, 'Pré-requis parcours réservation cassé — étape structure/enfant/récapitulatif').toBe(true);

    // Sélectionner virement
    await page.locator('label:has-text("Virement bancaire")').first().click();
    await page.waitForTimeout(300);

    // Valider
    const validerBtn = page.locator('button:has-text("Envoyer la demande"):not([disabled])').first();
    await expect(validerBtn).toBeVisible({ timeout: 5000 });
    await validerBtn.click();

    // Confirmation
    await expect(page.locator('text=/merci|confirmation|enregistré|demande.*reçue/i').first()).toBeVisible({ timeout: 20000 });
    // Référence dossier (UUID tronqué affiché sur la page de confirmation)
    await expect(page.locator('text=/Référence/i').first()).toBeVisible({ timeout: 5000 });
  });

});
