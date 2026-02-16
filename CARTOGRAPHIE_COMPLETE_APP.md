# 🗺️ CARTOGRAPHIE COMPLÈTE DE L'APPLICATION

**Date:** 15 février 2026
**Objectif:** Identifier tous les écrans, parcours et points de test pour automatisation

---

## 📱 PAGES FRONT (17 pages)

### 🏠 Pages Publiques (8)
1. **Homepage** - `/`
   - Affichage catégories (Ma Première Colo, Aventure, Sensations)
   - Liste séjours avec noms CityCrunch
   - Prix minimum affichés
   - Toggle Kids/Pro

2. **Recherche** - `/recherche`
   - Filtres (thème, région, âge)
   - Liste résultats
   - Tri (prix, date)

3. **Page Séjour** - `/sejour/[slug]`
   - Détails séjour (titre, description, images)
   - Sessions disponibles
   - Prix par session
   - Villes de départ
   - Bouton "Réserver"
   - Bouton "Liste d'envies"

4. **Page Réservation** - `/sejour/[slug]/reserver`
   - Étape 1: Sélection session + ville
   - Étape 2: Infos enfant (validation âge)
   - Étape 3: Infos parent/référent
   - Étape 4: Choix paiement (Virement/Chèque/CB)
   - Étape 5: Confirmation + instructions

5. **Contact** - `/contact`
   - Formulaire contact

6. **Envies** - `/envies`
   - Liste d'envies (wishlist)

7. **Infos** - `/infos`
   - Page informations

8. **Liste Séjours** - `/sejours`
   - Vue liste complète

### 🔐 Pages Authentifiées (2)
9. **Login** - `/login`
   - Formulaire connexion
   - Email + password

10. **Espace Pro** - `/espace-pro`
    - Redirect vers `/sejours` (incomplet)

### 🛠️ Pages Admin (5)
11. **Dashboard Admin** - `/admin`
    - Vue d'ensemble stats

12. **Gestion Séjours** - `/admin/sejours`
    - CRUD séjours
    - Publication/dépublication

13. **Gestion Sessions** - `/admin/sessions`
    - CRUD sessions par séjour

14. **Gestion Users** - `/admin/users`
    - Liste utilisateurs
    - Rôles (USER/ADMIN/PARTNER)

15. **Gestion Demandes** - `/admin/demandes`
    - Inscriptions en attente
    - Validation/Refus

### 🔧 Pages Techniques (2)
16. **Debug DB** - `/debug-db`
    - Vérification connexion DB

17. **Verify DB** - `/verify-db`
    - Vérification anti-régression CityCrunch
    - 24 séjours avec marketing_title

---

## 🔌 ROUTES API (19 routes)

### 📚 API Publiques (4)
1. **GET /api/stays** - Liste séjours publics
2. **GET /api/stays/[slug]** - Détail séjour
3. **POST /api/bookings** - Créer réservation (ancien ?)
4. **POST /api/inscriptions** - Créer inscription Pro

### 💳 API Payment (2)
5. **POST /api/payment/create-intent** - Créer Stripe Intent
6. **POST /api/webhooks/stripe** - Webhook Stripe

### 🔐 API Auth (1)
7. **POST /api/auth/login** - Connexion

### 👔 API Pro (1)
8. **GET /api/pro/stays** - Séjours mode Pro

### 🛠️ API Admin (11)
9. **GET /api/admin/stays** - Liste séjours admin
10. **POST /api/admin/stays** - Créer séjour
11. **GET /api/admin/stays/[id]** - Détail séjour
12. **PUT /api/admin/stays/[id]** - Modifier séjour
13. **DELETE /api/admin/stays/[id]** - Supprimer séjour
14. **GET /api/admin/stays/slug/[slug]** - Séjour by slug
15. **GET /api/admin/stays/[id]/sessions** - Sessions d'un séjour
16. **POST /api/admin/stays/[id]/sessions** - Créer session
17. **GET /api/admin/users** - Liste users
18. **GET /api/admin/bookings** - Liste réservations
19. **GET /api/admin/stats** - Statistiques

---

## 🎯 PARCOURS UTILISATEURS CRITIQUES

### Parcours 1: FAMILLE - Réservation Virement
```
1. Homepage → Clic catégorie "Ma Première Colo"
2. Clic sur "ALPOO KIDS"
3. Page séjour → Vérifier titre "ALPOO KIDS" (pas "Croc' Marmotte")
4. Clic "Réserver"
5. Sélectionner session (ex: 8 juillet 2026)
6. Sélectionner ville départ (ex: Paris)
7. Remplir infos enfant (Prénom: "Test", Âge: 7 ans)
8. Validation âge OK (6-8 ans)
9. Remplir infos parent (Email: test@test.fr, Tél: 0612345678)
10. Choisir "Virement bancaire"
11. Vérifier instructions virement affichées
12. Vérifier numéro référence PAY-YYYYMMDD-xxxxxxxx
13. Vérifier données en DB gd_inscriptions
```

### Parcours 2: FAMILLE - Réservation Chèque
```
1-9. (Identique parcours 1)
10. Choisir "Chèque"
11. Vérifier instructions chèque affichées
12. Vérifier adresse postale GED
13. Vérifier référence paiement
```

### Parcours 3: FAMILLE - Liste d'envies
```
1. Homepage → Clic "AZUR DIVE & JET"
2. Page séjour → Clic "Ajouter à ma liste d'envies"
3. Modal liste d'envies → Remplir email
4. Vérifier confirmation
5. Aller sur /envies
6. Vérifier séjour présent
```

### Parcours 4: RECHERCHE - Filtres
```
1. Homepage → Clic "Rechercher"
2. Filtrer par thème: "Montagne"
3. Vérifier résultats filtrés
4. Filtrer par âge: 12-14 ans
5. Vérifier résultats mis à jour
6. Tri par prix croissant
7. Vérifier ordre
```

### Parcours 5: ADMIN - Gérer séjour
```
1. /login → Connexion admin
2. /admin → Dashboard
3. /admin/sejours → Liste séjours
4. Clic éditer "ALPOO KIDS"
5. Modifier titre (test)
6. Sauvegarder
7. Vérifier modification
8. Rétablir titre original
```

### Parcours 6: ADMIN - Valider inscription
```
1. /admin/demandes → Liste inscriptions
2. Voir inscription en attente
3. Clic "Valider"
4. Vérifier status → "confirmée"
5. Vérifier email envoyé (si configuré)
```

### Parcours 7: VÉRIFICATION - Anti-régression
```
1. /verify-db
2. Vérifier 24/24 séjours ✅ OK
3. Vérifier 0 ligne 🔴 rouge
4. Vérifier tous marketing_title présents
```

---

## 🧪 TESTS AUTOMATISÉS À CRÉER

### Tests E2E (End-to-End) - Playwright

#### Test 1: Homepage
```typescript
test('Homepage affiche noms CityCrunch', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('text=ALPOO KIDS')).toBeVisible();
  await expect(page.locator('text=AZUR DIVE & JET')).toBeVisible();
  await expect(page.locator('text=BRETAGNE OCEAN RIDE')).toBeVisible();
  await expect(page.locator('text=Croc\' Marmotte')).not.toBeVisible();
});
```

#### Test 2: Flux réservation Virement complet
```typescript
test('Réservation Virement bancaire complète', async ({ page }) => {
  // 1. Accès séjour
  await page.goto('/sejour/alpoo-kids');
  await expect(page.locator('h1:has-text("ALPOO KIDS")')).toBeVisible();

  // 2. Clic réserver
  await page.click('button:has-text("Réserver")');
  await expect(page).toHaveURL(/\/sejour\/alpoo-kids\/reserver/);

  // 3. Sélection session
  await page.click('[data-testid="session-8-juillet-2026"]');

  // 4. Sélection ville
  await page.selectOption('select[name="cityDeparture"]', 'Paris');

  // 5. Infos enfant
  await page.fill('input[name="childFirstName"]', 'TestEnfant');
  await page.fill('input[name="childBirthDate"]', '2019-01-01');

  // 6. Infos parent
  await page.fill('input[name="parentFirstName"]', 'TestParent');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="phone"]', '0612345678');

  // 7. Paiement
  await page.click('label:has-text("Virement bancaire")');
  await page.click('button:has-text("Valider")');

  // 8. Vérification confirmation
  await expect(page.locator('text=Instructions virement')).toBeVisible();
  await expect(page.locator('text=PAY-')).toBeVisible();
});
```

#### Test 3: Validation âge
```typescript
test('Validation âge enfant hors limites', async ({ page }) => {
  await page.goto('/sejour/alpoo-kids/reserver');

  // ALPOO KIDS = 6-8 ans
  // Test avec 4 ans → doit refuser
  await page.fill('input[name="childBirthDate"]', '2022-01-01');
  await page.blur('input[name="childBirthDate"]');

  await expect(page.locator('text=âge non éligible')).toBeVisible();
});
```

#### Test 4: Page vérification DB
```typescript
test('Page verify-db sans régression', async ({ page }) => {
  await page.goto('/verify-db');

  // Vérifier tableau affiché
  await expect(page.locator('table')).toBeVisible();

  // Vérifier stats
  const okCount = await page.locator('text=/\\d+ OK/').textContent();
  expect(okCount).toContain('24 OK');

  // Vérifier aucune régression
  const dangerCount = await page.locator('text=/\\d+ Dangers/').textContent();
  expect(dangerCount).toContain('0 Dangers');
});
```

### Tests API - Jest

#### Test API 1: GET /api/stays
```typescript
describe('GET /api/stays', () => {
  it('retourne liste séjours avec noms CityCrunch', async () => {
    const res = await fetch('/api/stays');
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toBeInstanceOf(Array);
    expect(data.length).toBeGreaterThan(0);

    const alpooKids = data.find(s => s.slug === 'alpoo-kids');
    expect(alpooKids.marketing_title).toBe('ALPOO KIDS');
    expect(alpooKids.title).not.toBe('Croc\' Marmotte');
  });
});
```

#### Test API 2: POST /api/inscriptions
```typescript
describe('POST /api/inscriptions', () => {
  it('crée inscription avec payment_reference auto', async () => {
    const payload = {
      staySlug: 'alpoo-kids',
      sessionDate: '2026-07-08',
      cityDeparture: 'Paris',
      organisation: 'Test Org',
      socialWorkerName: 'Test Worker',
      email: 'test@example.com',
      phone: '0612345678',
      childFirstName: 'Test',
      childBirthDate: '2019-01-01',
      priceTotal: 600,
      consent: true
    };

    const res = await fetch('/api/inscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.payment_reference).toMatch(/^PAY-\d{8}-[a-f0-9]{8}$/);
    expect(data.status).toBe('en_attente');
  });
});
```

### Tests Unitaires - lib/pricing.ts

```typescript
describe('lib/pricing', () => {
  describe('getPriceBreakdown', () => {
    it('calcule prix sans aide QF > 1400', () => {
      const result = getPriceBreakdown({
        basePrice: 600,
        cityExtra: 50,
        quotientFamilial: 1500,
        childAge: 7
      });

      expect(result.priceBase).toBe(600);
      expect(result.priceTransport).toBe(50);
      expect(result.aideMobilite).toBe(0);
      expect(result.aideQF).toBe(0);
      expect(result.priceTotal).toBe(650);
    });

    it('applique aide QF < 600', () => {
      const result = getPriceBreakdown({
        basePrice: 600,
        cityExtra: 50,
        quotientFamilial: 500,
        childAge: 7
      });

      expect(result.aideQF).toBeGreaterThan(0);
      expect(result.priceTotal).toBeLessThan(650);
    });
  });
});
```

---

## 📦 STRUCTURE TESTS À CRÉER

```
tests/
├── e2e/                          # Tests Playwright
│   ├── homepage.spec.ts
│   ├── sejour-detail.spec.ts
│   ├── reservation-virement.spec.ts
│   ├── reservation-cheque.spec.ts
│   ├── wishlist.spec.ts
│   ├── recherche.spec.ts
│   ├── admin-login.spec.ts
│   ├── admin-sejours.spec.ts
│   ├── verify-db.spec.ts
│   └── anti-regression.spec.ts
│
├── api/                          # Tests API Jest
│   ├── stays.test.ts
│   ├── inscriptions.test.ts
│   ├── payment.test.ts
│   ├── auth.test.ts
│   └── admin.test.ts
│
├── unit/                         # Tests unitaires
│   ├── pricing.test.ts          (existant)
│   ├── utils.test.ts
│   └── validation.test.ts
│
└── integration/                  # Tests intégration
    ├── supabase.test.ts
    └── booking-flow.test.ts
```

---

## 🎯 PRIORITÉS TESTS

### P0 - CRITIQUE (À faire MAINTENANT)
1. ✅ Test E2E: Homepage noms CityCrunch
2. ✅ Test E2E: Flux réservation Virement complet
3. ✅ Test E2E: Page /verify-db anti-régression
4. ✅ Test API: POST /api/inscriptions
5. ✅ Test Unit: lib/pricing calculs aides

### P1 - IMPORTANT (Cette semaine)
6. Test E2E: Flux réservation Chèque
7. Test E2E: Validation âge enfant
8. Test API: GET /api/stays
9. Test API: Webhook Stripe
10. Test Unit: Validation Zod

### P2 - AMÉLIORATION (Ce mois)
11. Test E2E: Admin CRUD séjours
12. Test E2E: Recherche + filtres
13. Test E2E: Liste d'envies
14. Tests intégration Supabase

---

## 🚀 COMMANDES POUR LANCER

### Installation
```bash
# Playwright (E2E)
npm install -D @playwright/test
npx playwright install

# Jest (Unit + API)
npm install -D jest @testing-library/react @testing-library/jest-dom
npm install -D @types/jest ts-jest
```

### Exécution
```bash
# Tests E2E
npm run test:e2e

# Tests unitaires
npm run test:unit

# Tests API
npm run test:api

# Tous les tests
npm test

# Mode watch (dev)
npm run test:watch

# Coverage
npm run test:coverage
```

---

**Prêt à créer les tests automatisés ?** 🧪
