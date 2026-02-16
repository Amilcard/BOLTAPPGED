# 🧪 TESTS AUTOMATISÉS - PROJET GED (Contexte Réel)

**Date:** 15 février 2026
**Projet:** GED - Réservation séjours vacances enfants 3-17 ans
**URL Production:** https://app.groupeetdecouverte.fr

---

## ⚠️ CLARIFICATION IMPORTANTE

Ce projet est **GED (Groupe & Découverte)**, PAS Flooow.

### Différences clés:
| Aspect | GED (ce projet) | Flooow (autre projet) |
|--------|-----------------|----------------------|
| **Âge cible** | 3-17 ans | 6-17 ans |
| **Aides financières** | ❌ AUCUNE | ✅ Oui (QF, QPV, mobilité) |
| **Quotient Familial** | ❌ Non utilisé | ✅ Utilisé |
| **Parcours** | Kids (wishlist) + Pro (réservation) | Smart Form + Catalogue |
| **Paiements** | Virement, Chèque, CB | Conventionné / Devis |
| **Tables BDD** | `gd_inscriptions`, `gd_stays` | `flooow_stays`, `smart_form_submissions` |

---

## 📦 STRUCTURE TESTS CRÉÉS

```
tests/
├── e2e/                          # Tests Playwright
│   ├── homepage.spec.ts          ✅ Affichage séjours CityCrunch
│   ├── reservation-virement.spec.ts ✅ Flux Pro avec virement
│   ├── reservation-kids.spec.ts  ✅ Flux Kids wishlist
│   ├── reservation-pro.spec.ts   ✅ Flux Pro complet
│   └── verify-db.spec.ts         ✅ Anti-régression base
│
├── api/                          # Tests API Jest
│   ├── inscriptions.test.ts      ✅ POST /api/inscriptions
│   └── stays.test.ts             ✅ GET /api/stays
│
└── unit/                         # Tests unitaires
    └── (à créer si besoin)
```

---

## 🎯 TESTS E2E (Playwright)

### Test 1: Homepage - Noms CityCrunch
**Fichier:** `tests/e2e/homepage.spec.ts`

**Objectif:** Vérifier que les noms CityCrunch (ex: ALPOO KIDS) sont affichés et que les anciens noms UFOVAL (ex: Croc' Marmotte) n'apparaissent pas.

**Vérifie:**
- ✅ ALPOO KIDS visible
- ✅ AZUR DIVE visible
- ✅ BRETAGNE OCEAN RIDE visible
- ✅ "Croc' Marmotte" absent (régression)
- ✅ Catégories (Ma Première Colo, Aventure, Sensations)
- ✅ Toggle Kids/Pro fonctionne
- ✅ Prix affichés

---

### Test 2: Parcours Pro - Réservation Virement
**Fichier:** `tests/e2e/reservation-virement.spec.ts`

**Objectif:** Tester le flux complet d'inscription d'une structure avec paiement par virement.

**Étapes:**
1. Accès séjour
2. Mode Pro actif
3. Clic "Réserver"
4. Sélection session (ex: 8 juillet 2026)
5. Sélection ville départ (ex: Paris)
6. Infos enfant (prénom, date naissance)
7. Infos structure (organisation, référent, email, tél)
8. Consentement RGPD
9. Choix "Virement bancaire"
10. Validation

**Vérifie:**
- ✅ Confirmation affichée
- ✅ Référence paiement générée: `PAY-YYYYMMDD-xxxxxxxx`
- ✅ Instructions virement affichées

---

### Test 3: Parcours Pro - Validation Âge
**Fichier:** `tests/e2e/reservation-pro.spec.ts`

**Objectif:** Vérifier le comportement quand un enfant est hors de la tranche d'âge du séjour.

**Cas testé:**
- Séjour ALPOO KIDS (6-8 ans)
- Enfant de 10 ans

**Comportement attendu:**
- ⚠️ Message d'avertissement non-bloquant (selon rapport tests)
- 📝 Si pas encore implémenté, test documente comportement actuel

---

### Test 4: Parcours Kids - Liste d'Envies
**Fichier:** `tests/e2e/reservation-kids.spec.ts`

**Objectif:** Tester le flux "liste d'envies" pour les enfants.

**Étapes:**
1. Accès séjour en mode Kids
2. Clic "Ajouter à ma liste d'envies"
3. Modal s'ouvre
4. Remplir nom enfant
5. Remplir email éducateur
6. Message optionnel
7. Valider

**Vérifie:**
- ✅ Modal fonctionne
- ✅ Souhait enregistré
- ✅ Page /envies accessible
- ✅ Liste affiche séjours ou message "vide"

---

### Test 5: Anti-Régression Base de Données
**Fichier:** `tests/e2e/verify-db.spec.ts`

**Objectif:** Vérifier qu'aucun nom UFOVAL n'est présent dans la base.

**Vérifie:**
- ✅ Page /verify-db accessible
- ✅ 24 séjours vérifiés
- ✅ 24 OK (marketing_title présent)
- ✅ 0 Dangers (régression)

---

## 🔌 TESTS API (Jest)

### Test API 1: GET /api/stays
**Fichier:** `tests/api/stays.test.ts`

**Objectif:** Vérifier que l'API retourne la liste des séjours avec les bons noms.

**Vérifie:**
- ✅ Status 200
- ✅ Array de séjours
- ✅ Champ `marketing_title` = "ALPOO KIDS"
- ✅ Pas de "Croc' Marmotte" dans `title`

---

### Test API 2: POST /api/inscriptions
**Fichier:** `tests/api/inscriptions.test.ts`

**Objectif:** Vérifier la création d'inscription Pro avec génération automatique de référence paiement.

**Payload:**
```json
{
  "staySlug": "alpoo-kids",
  "sessionDate": "2026-07-08",
  "cityDeparture": "Paris",
  "organisation": "Centre Social Test",
  "socialWorkerName": "Marie Dupont",
  "email": "marie@test.fr",
  "phone": "0612345678",
  "childFirstName": "Jules",
  "childBirthDate": "2018-03-15",
  "priceTotal": 629,
  "consent": true
}
```

**Vérifie:**
- ✅ Status 201
- ✅ `payment_reference` auto: `PAY-20260215-a1b2c3d4`
- ✅ `payment_status` = "pending_payment"
- ✅ `payment_method` = "transfer"

---

## 🚀 CONFIGURATION TESTS

### Playwright Config
**Fichier:** `playwright.config.ts`

**Configuration actuelle:**
```typescript
baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
webServer: {
  command: 'npm run dev',
  url: 'http://localhost:3000'
}
```

**Problème identifié:** Tests échouent car tentent de lancer serveur local alors que l'app est déployée sur Hostinger.

**Solution:**
```bash
# Option A: Tester en LOCAL
npm run dev  # Terminal 1
npm run test:e2e  # Terminal 2

# Option B: Tester en PRODUCTION
export PLAYWRIGHT_BASE_URL=https://app.groupeetdecouverte.fr
npm run test:e2e
```

---

## 📊 ÉTAT TESTS EXÉCUTÉS

**Date exécution:** 15 février 2026 16:19

**Résultat:** ❌ 39 tests échoués (timeout)

**Cause:** Playwright tente de lancer `npm run dev` automatiquement mais l'app n'est pas en local.

**Actions correctives:**
1. ✅ Modifier config Playwright pour pointer vers production
2. ✅ OU désactiver `webServer` dans playwright.config.ts
3. ✅ OU lancer app en local avant tests

---

## 🔧 COMMANDES TESTS

```bash
# Installer dépendances (déjà fait)
npm install -D @playwright/test jest @testing-library/react

# Installer navigateurs Playwright (déjà fait)
npx playwright install chromium

# Lancer tous les tests
npm test

# Tests E2E uniquement
npm run test:e2e

# Tests E2E avec UI
npm run test:e2e:ui

# Tests API uniquement
npm run test:api

# Tests unitaires
npm run test:unit

# Mode watch
npm run test:watch

# Coverage
npm run test:coverage
```

---

## ✅ PROCHAINES ÉTAPES

### Immédiat:
1. **Configurer tests pour production:**
   ```typescript
   // playwright.config.ts
   baseURL: 'https://app.groupeetdecouverte.fr',
   // Supprimer ou commenter webServer
   ```

2. **Relancer tests E2E:**
   ```bash
   npm run test:e2e
   ```

3. **Analyser résultats et corriger tests si nécessaire**

### Court terme:
4. Implémenter validation âge (avertissement non-bloquant)
5. Ajouter tests pour paiement Chèque
6. Ajouter tests pour paiement CB (Stripe)

### Moyen terme:
7. Tests admin (CRUD séjours, validation inscriptions)
8. Tests recherche + filtres
9. Tests intégration Supabase

---

## 📝 NOTES IMPORTANTES

### Ce qui est testé:
- ✅ Affichage noms CityCrunch (anti-régression)
- ✅ Parcours Pro complet (virement)
- ✅ Parcours Kids (wishlist)
- ✅ API inscriptions
- ✅ API séjours
- ✅ Page /verify-db

### Ce qui n'est PAS testé (volontairement):
- ❌ Aides financières (n'existent pas dans GED)
- ❌ Quotient Familial (non utilisé)
- ❌ Smart Form (projet Flooow uniquement)
- ❌ Gestion collectivités (projet Flooow uniquement)

### Migration BDD effectuée:
- ✅ Colonnes `payment_method`, `payment_status`, `payment_reference`
- ✅ Trigger auto-génération `payment_reference`
- ✅ Table `gd_inscriptions` (pas `registrations`)

---

**Documentation maintenue par:** Claude Sonnet 4.5
**Dernière mise à jour:** 15 février 2026
