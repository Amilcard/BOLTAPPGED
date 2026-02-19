# 📋 ÉTAT DES LIEUX COMPLET - PROJET GED APP

**Date:** 15 février 2026 18:00
**Projet:** GED (Groupe & Découverte) - Réservation séjours vacances
**URL Production:** https://app.groupeetdecouverte.fr
**VPS:** Hostinger srv1307641 (root@srv1307641:~/BOLTAPPGED)

---

## ⚠️ CONTEXTE CRITIQUE

### CE PROJET EST GED, PAS FLOOOW

**CONFUSION MAJEURE DÉTECTÉE:**
- ❌ 8 skills "Flooow" présents dans l'environnement (anthropic-skills:flooow-*)
- ❌ Ces skills NE SONT PAS ce projet
- ❌ 12 fichiers JSON "flooow" présents dans le dossier GED (à clarifier avec utilisateur)
- ✅ Le code actif est 100% GED (vérifié dans app/, components/, lib/)

### PROJET RÉEL: GED (Groupe & Découverte)

| Aspect | Valeur |
|--------|--------|
| **Public cible** | Familles + Structures sociales |
| **Âge enfants** | 3-17 ans |
| **Offre** | Réservation séjours vacances |
| **Aides financières** | ❌ AUCUNE (contrairement à Flooow) |
| **Quotient Familial** | ❌ NON utilisé |
| **Paiements** | Virement, Chèque, CB (Stripe en cours) |
| **Tables BDD** | `gd_inscriptions`, `gd_stays`, `gd_sessions` |
| **Noms séjours** | CityCrunch (ex: ALPOO KIDS, AZUR DIVE) |
| **Anciens noms** | UFOVAL (ex: Croc' Marmotte) ← À ÉVITER |

---

## ✅ FAIT - Déploiement et Infrastructure

### 1. Application Déployée sur VPS Hostinger
**Status:** ✅ OPÉRATIONNEL

**Détails:**
- Container Docker: `ged-app-container` (port 3000)
- Traefik reverse proxy: HTTPS automatique
- Build réussi: "Ready in 444ms"
- URL: https://app.groupeetdecouverte.fr
- Certificat SSL: Auto-renouvelé par Traefik

**Fichiers clés:**
```
~/BOLTAPPGED/
├── Dockerfile (modifié avec ARG pour Supabase)
├── docker-compose.yml
├── .env (SUPABASE_URL, ANON_KEY)
└── traefik/ (config reverse proxy)
```

**Commandes déploiement:**
```bash
# Build avec secrets
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
  -t ged-app .

# Lancement
docker-compose up -d
```

### 2. Base de Données Supabase
**Status:** ✅ CONFIGURÉE

**Tables principales:**
- `gd_stays` (24 séjours avec marketing_title CityCrunch)
- `gd_sessions` (dates et villes de départ)
- `gd_inscriptions` (réservations Pro)
- `gd_bookings` (réservations Kids - à clarifier usage)

**Migration 009 appliquée (15 février 2026):**
```sql
-- Colonnes paiement ajoutées
ALTER TABLE gd_inscriptions ADD COLUMN:
  - payment_method (stripe/transfer/check)
  - payment_status (pending_payment/paid/failed)
  - payment_reference (PAY-YYYYMMDD-xxxxxxxx)
  - stripe_payment_intent_id
  - payment_validated_at

-- Trigger auto-génération payment_reference
CREATE TRIGGER set_payment_reference
  BEFORE INSERT ON gd_inscriptions
  EXECUTE FUNCTION generate_payment_reference();
```

**Connexion:**
- URL: `https://[project].supabase.co`
- Anon Key: Configurée dans .env
- Service Role Key: Pour opérations admin

### 3. Corrections Anti-Régression CityCrunch
**Status:** ✅ APPLIQUÉES

**Problème résolu:**
- UFOVAL = anciens noms (Croc' Marmotte, BREIZH PONEY)
- CityCrunch = nouveaux noms (ALPOO KIDS, AZUR DIVE, etc.)

**Actions effectuées:**
- ✅ Page /verify-db créée (monitoring 24 séjours)
- ✅ Hiérarchie titres vérifiée: `marketing_title > title_kids > title`
- ✅ Base de données: 24/24 séjours ont `marketing_title` CityCrunch
- ✅ Frontend: Affiche toujours `marketing_title` en priorité

**Fichier critique:**
```typescript
// app/sejour/[id]/stay-detail.tsx (lignes 86-112)
const displayTitle = stay?.marketingTitle || stay?.titleKids || stay?.title;
```

### 4. Configuration Next.js Corrigée
**Status:** ✅ FONCTIONNEL

**Problème résolu:** Build timeout local (3min) à cause de Supabase imports top-level

**Correction appliquée:**
- ✅ `export const dynamic = 'force-dynamic'` ajouté sur 16 pages
- ✅ `next.config.js`: `output: 'standalone'` par défaut
- ✅ Dockerfile: ARG/ENV pour Supabase pendant build

**Pages avec dynamic export:**
```
app/admin/page.tsx
app/admin/layout.tsx
app/admin/sejours/page.tsx
app/admin/sessions/page.tsx
app/admin/users/page.tsx
app/admin/demandes/page.tsx
(+ 10 autres pages déjà configurées)
```

---

## 🚧 EN COURS - Tests Automatisés

### Infrastructure Tests Créée (15 février 2026)
**Status:** ⚠️ INSTALLÉE MAIS NON EXÉCUTÉE

**Dépendances installées:**
- ✅ Playwright v1.58.2 (E2E)
- ✅ Jest v30.2.0 (Unit/API)
- ✅ @testing-library/react, jest-dom
- ✅ Chromium browser (180 MB)

**Fichiers de configuration:**
```
playwright.config.ts (baseURL: localhost:3000)
jest.config.js
jest.setup.js
```

**Tests créés (8 fichiers):**
```
tests/
├── e2e/
│   ├── homepage.spec.ts (noms CityCrunch)
│   ├── reservation-virement.spec.ts (flux Pro virement)
│   ├── reservation-pro.spec.ts (flux Pro complet)
│   ├── reservation-kids.spec.ts (wishlist)
│   └── verify-db.spec.ts (anti-régression BDD)
├── api/
│   ├── inscriptions.test.ts (POST /api/inscriptions)
│   └── stays.test.ts (GET /api/stays)
```

**Scripts npm ajoutés:**
```json
"test": "npm run test:unit && npm run test:e2e",
"test:e2e": "playwright test",
"test:api": "jest --testMatch='**/tests/api/**/*.test.ts'"
```

### Tentative Exécution Tests (15 février 2026 16:19)
**Résultat:** ❌ 39 TESTS ÉCHOUÉS (timeout)

**Cause:** Config Playwright tente de lancer `npm run dev` automatiquement

**Problème:** App déployée sur Hostinger, pas en local

**Solution à appliquer:**
```typescript
// playwright.config.ts
baseURL: 'https://app.groupeetdecouverte.fr',
// Commenter ou supprimer webServer
```

---

## ❌ PAS FAIT - Fonctionnalités Manquantes

### 1. Validation Âge Enfant
**Status:** ❌ NON IMPLÉMENTÉE

**Problème identifié (Rapport 15/02/2026):**
- Enfant hors limites d'âge (ex: 3 ans pour séjour 6-8 ans)
- ❌ Aucun message d'avertissement
- ❌ Aucun blocage
- ✅ Calcul âge fonctionne (affiche "3 ans")

**Impact:** Inscriptions invalides possibles

**Correction proposée:**
```typescript
// booking-modal.tsx après ligne 568
// Ajouter message non-anxiogène si hors limites
{isOutOfRange && (
  <div className="mt-2 p-3 bg-amber-50 border border-amber-200">
    <p>Ce séjour est conçu pour les {minAge}-{maxAge} ans</p>
    <p className="text-xs">Notre équipe vérifiera que le séjour peut s'adapter.</p>
  </div>
)}
```

**Effort:** 30 minutes

### 2. Système Email
**Status:** ❌ NON CONFIGURÉ

**Problème:** Aucun email automatique envoyé après réservation

**Emails manquants:**
- ❌ Email GED (inscriptions@groupeetdecouverte.fr)
- ❌ Email confirmation référent structure
- ❌ Email éducateur (parcours Kids)

**À configurer:**
- Service: Resend, SendGrid, ou SMTP
- Templates: Confirmation, instructions paiement
- Variables env: SMTP credentials

**Effort:** 2-4 heures

### 3. Affichage Modes de Paiement
**Status:** ❌ NON AFFICHÉ

**Problème:** Aucune mention des modes de paiement dans le formulaire

**Attendu:**
- ✅ Section "Mode de paiement" dans récapitulatif
- ✅ Options: Virement bancaire, Chèque, CB
- ✅ Instructions affichées après validation

**Correction proposée:**
```typescript
// booking-modal.tsx Step 5 (confirmation)
<div className="mt-4">
  <h5>Mode de paiement</h5>
  <div>Virement bancaire</div>
  <div>Chèque</div>
  <div>Paiement CB (lien sécurisé)</div>
</div>
```

**Effort:** 1 heure

### 4. Stripe Phase 4 (Paiement CB)
**Status:** ⚠️ PARTIELLEMENT INTÉGRÉ

**État actuel:**
- ✅ Package `stripe` installé
- ✅ Routes API créées: `/api/payment/create-intent`, `/api/webhooks/stripe`
- ❌ Non configuré (clés API manquantes)
- ❌ Non testé

**À faire:**
- Obtenir clés Stripe (test + prod)
- Configurer webhook Stripe
- Tester flux complet CB

**Effort:** 4-8 heures

### 5. Espace Pro Complet
**Status:** ❌ INCOMPLET

**État actuel:**
- ✅ Route `/espace-pro` existe
- ❌ Redirect vers `/sejours` (pas d'interface dédiée)
- ❌ Pas de dashboard structure

**Fonctionnalités manquantes:**
- Historique inscriptions structure
- Suivi statuts paiement
- Documents à télécharger
- Gestion multi-enfants

**Effort:** 2-3 jours

---

## 🔴 FRAGILITÉS CRITIQUES

### 1. Absence Monitoring Production
**Gravité:** 🔴 CRITIQUE

**Problème:**
- ❌ Pas de Sentry / monitoring erreurs
- ❌ Pas de logs centralisés
- ❌ Pas d'alertes si app down

**Impact:** Impossible de détecter bugs en production

**Solution:** Intégrer Sentry + Uptime monitoring

### 2. Absence Tests Automatisés Actifs
**Gravité:** 🔴 HAUTE

**Problème:**
- ✅ Tests créés mais ❌ jamais exécutés
- ❌ Pas de CI/CD
- ❌ Risque régression à chaque modif

**Impact:** Modifications peuvent casser l'app sans détection

**Solution:** Exécuter tests + CI GitHub Actions

### 3. Build Local Timeout (3 minutes)
**Gravité:** 🟡 MOYENNE

**Problème:**
- Supabase client instancié au top-level (`lib/supabaseGed.ts`)
- Next.js parse tous les imports → timeout

**Workaround actuel:** Build sur VPS uniquement

**Solution long terme:** Lazy-load Supabase clients

### 4. Sécurité API Routes
**Gravité:** 🟡 MOYENNE

**Problème:**
- ❌ Pas de rate limiting
- ❌ Pas de validation Zod stricte partout
- ⚠️ Certaines routes admin sans auth forte

**Impact:** Vulnérabilité abus API

**Solution:** Ajouter middleware rate-limit + Zod

### 5. Gestion Erreurs Basique
**Gravité:** 🟡 MOYENNE

**Problème:**
- try/catch basiques
- Messages erreurs génériques
- Pas de retry logic

**Impact:** UX dégradée si erreur réseau/BDD

**Solution:** Error boundaries React + retry exponential

---

## 📂 FICHIERS ET DOSSIERS CLÉS

### Structure Projet
```
GED_APP/
├── app/                      # Pages Next.js 14 (App Router)
│   ├── page.tsx             # Homepage
│   ├── sejour/[slug]/       # Page séjour + réservation
│   ├── admin/               # Interface admin
│   ├── verify-db/           # Anti-régression CityCrunch
│   └── api/                 # Routes API
│       ├── stays/           # GET séjours
│       ├── inscriptions/    # POST réservation Pro
│       ├── bookings/        # POST réservation Kids
│       └── payment/         # Stripe
│
├── components/
│   ├── booking-modal.tsx    # Modal réservation (CRITIQUE)
│   ├── wishlist-modal.tsx   # Modal liste d'envies Kids
│   └── ui/                  # Composants shadcn/ui
│
├── lib/
│   ├── supabaseGed.ts       # Client Supabase (FRAGILE - top-level)
│   ├── pricing.ts           # Calculs prix + transport
│   └── utils.ts             # Utilitaires
│
├── prisma/
│   ├── schema.prisma        # Schéma BDD
│   └── migrations/          # Migrations SQL
│
├── tests/                   # Tests (créés, non exécutés)
│   ├── e2e/                 # Playwright
│   └── api/                 # Jest
│
├── sql/
│   └── 009_add_payment_columns.sql  # Migration paiements (appliquée)
│
├── Dockerfile               # Docker multi-stage (modifié pour Supabase)
├── docker-compose.yml       # Orchestration
├── next.config.js           # Config Next.js
├── playwright.config.ts     # Config tests E2E
├── jest.config.js           # Config tests unitaires
└── package.json             # Dépendances + scripts
```

### Fichiers Documentation Projet
```
✅ CARTOGRAPHIE_COMPLETE_APP.md (17 pages, 19 API, 7 parcours)
✅ RAPPORT_TESTS_VALIDATION_PAIEMENTS_2026-02-15.md
✅ RAPPORT_ANTI_REGRESSION_FINAL.md
✅ ETAT_DES_LIEUX_UFOVAL_CITYCRUNCH_2026-02-15.md
✅ TESTS_GED_PROJET_REEL.md
✅ NETTOYAGE_FLOOOW.md (analyse confusion Flooow)
✅ ETAT_LIEUX_COMPLET_GED_2026-02-15.md (CE FICHIER)

❓ README_INTEGRATION_COMPLETE.md (FLOOOW - à clarifier)
❓ business_logic_rules.json (FLOOOW - à clarifier)
❓ 12 fichiers n8n-flooow-*.json (FLOOOW - à clarifier)
```

---

## 🎯 PARCOURS UTILISATEURS TESTÉS

### Parcours 1: Homepage → Séjour
**Status:** ✅ FONCTIONNEL

**Étapes:**
1. Homepage affiche 24 séjours CityCrunch
2. Catégories: Ma Première Colo, Aventure, Sensations
3. Clic séjour → Page détail
4. Affiche titre CityCrunch (pas UFOVAL)
5. Sessions + villes départ
6. Prix calculé selon ville

### Parcours 2: Réservation Pro
**Status:** ⚠️ FONCTIONNEL (emails manquants)

**Étapes:**
1. Mode Pro actif
2. Clic "Réserver"
3. Sélection session + ville
4. Infos enfant (prénom, date naissance)
5. ⚠️ Validation âge manquante
6. Infos structure (organisation, référent, email, tél)
7. Consentement RGPD
8. ⚠️ Choix paiement non affiché
9. Validation → Enregistrement DB
10. ✅ `payment_reference` généré: PAY-20260215-a1b2c3d4
11. ❌ Email non envoyé

### Parcours 3: Liste d'Envies Kids
**Status:** ⚠️ FONCTIONNEL (emails manquants)

**Étapes:**
1. Mode Kids actif
2. Clic "Ajouter à ma liste d'envies"
3. Modal s'ouvre
4. Remplir nom enfant + email éducateur
5. Message optionnel
6. Validation → Enregistrement
7. ❌ Email éducateur non envoyé

### Parcours 4: Admin - Gestion Séjours
**Status:** ✅ FONCTIONNEL

**Étapes:**
1. Login admin
2. Dashboard /admin
3. /admin/sejours → Liste séjours
4. CRUD séjours (Create, Read, Update, Delete)
5. Gestion sessions par séjour

---

## 🔌 API ROUTES ÉTAT

### API Publiques
| Route | Méthode | Status | Usage |
|-------|---------|--------|-------|
| `/api/stays` | GET | ✅ OK | Liste séjours publics |
| `/api/stays/[slug]` | GET | ✅ OK | Détail séjour |
| `/api/inscriptions` | POST | ✅ OK | Inscription Pro |
| `/api/bookings` | POST | ✅ OK | Réservation Kids |

### API Paiement
| Route | Méthode | Status | Usage |
|-------|---------|--------|-------|
| `/api/payment/create-intent` | POST | ⚠️ CODE PRÉSENT | Stripe (non configuré) |
| `/api/webhooks/stripe` | POST | ⚠️ CODE PRÉSENT | Webhook (non configuré) |

### API Admin
| Route | Méthode | Status | Usage |
|-------|---------|--------|-------|
| `/api/admin/stays` | GET/POST | ✅ OK | CRUD séjours |
| `/api/admin/users` | GET | ✅ OK | Liste users |
| `/api/admin/bookings` | GET | ✅ OK | Liste réservations |
| `/api/admin/stats` | GET | ✅ OK | Statistiques |

---

## 🛠️ COMMANDES ESSENTIELLES

### Développement Local
```bash
# Installation
npm install

# Dev local (⚠️ timeout 3min si Supabase top-level)
npm run dev

# Build local (déconseillé, utiliser VPS)
npm run build
```

### Tests
```bash
# Installer dépendances (déjà fait)
npm install -D @playwright/test jest
npx playwright install chromium

# Lancer tests E2E (⚠️ config à ajuster pour production)
npm run test:e2e

# Lancer tests API
npm run test:api

# Tous les tests
npm test
```

### Déploiement VPS (Hostinger)
```bash
# SSH
ssh root@srv1307641.your-server.com

# Accès dossier
cd ~/BOLTAPPGED

# Build image
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
  -t ged-app .

# Redémarrer
docker-compose down
docker-compose up -d

# Logs
docker logs -f ged-app-container

# Vérifier status
curl https://app.groupeetdecouverte.fr
```

### Base de Données Supabase
```bash
# Connexion SQL Editor
# → https://supabase.com/dashboard/project/[project-id]/sql

# Vérifier séjours CityCrunch
SELECT slug, marketing_title, title
FROM gd_stays
ORDER BY slug;

# Vérifier inscriptions récentes
SELECT id, payment_reference, payment_status, created_at
FROM gd_inscriptions
ORDER BY created_at DESC
LIMIT 10;
```

---

## 📊 MÉTRIQUES CLÉS

### Base de Données
- **24 séjours** avec `marketing_title` CityCrunch
- **0 régression** UFOVAL détectée
- **1 table** inscriptions: `gd_inscriptions`
- **Colonnes paiement:** payment_method, payment_status, payment_reference

### Application
- **17 pages** publiques + admin
- **19 routes API** (4 publiques, 2 paiement, 13 admin)
- **7 parcours** utilisateurs identifiés
- **8 tests** créés (0 exécutés)

### Infrastructure
- **1 VPS** Hostinger
- **1 container** Docker
- **1 reverse proxy** Traefik (HTTPS auto)
- **Uptime:** Non monitoré

---

## ⚠️ RISQUES IDENTIFIÉS

### Risque 1: Confusion Flooow/GED
**Probabilité:** 🔴 HAUTE
**Impact:** 🔴 CRITIQUE

**Symptômes:**
- 8 skills "Flooow" présents (anthropic-skills:flooow-*)
- 12 fichiers JSON "flooow" dans dossier GED
- Documentation mixte

**Conséquence:** IA peut générer code Flooow au lieu de GED

**Mitigation:**
- ✅ Document NETTOYAGE_FLOOOW.md créé
- ⚠️ Attente clarification utilisateur sur fichiers JSON

### Risque 2: Régression UFOVAL
**Probabilité:** 🟡 MOYENNE
**Impact:** 🔴 HAUTE

**Symptômes:**
- Base contient `title` (UFOVAL) ET `marketing_title` (CityCrunch)
- Code doit TOUJOURS afficher `marketing_title` en priorité

**Conséquence:** Affichage anciens noms si code modifié

**Mitigation:**
- ✅ Page /verify-db monitoring 24 séjours
- ✅ Hiérarchie titres codée: `marketingTitle > titleKids > title`
- ⚠️ Aucun test automatisé actif

### Risque 3: Absence Tests CI/CD
**Probabilité:** 🔴 HAUTE
**Impact:** 🔴 HAUTE

**Symptômes:**
- Tests créés mais jamais exécutés
- Pas de CI/CD GitHub Actions
- Modifications sans validation auto

**Conséquence:** Bugs en production non détectés

**Mitigation:**
- ⚠️ Configurer tests pour prod
- ⚠️ Intégrer CI/CD

### Risque 4: Données Client Non Protégées
**Probabilité:** 🟡 MOYENNE
**Impact:** 🔴 CRITIQUE

**Symptômes:**
- Pas de chiffrement côté client
- Pas de rate limiting API
- Logs peuvent contenir données sensibles

**Conséquence:** Fuite données RGPD

**Mitigation:**
- ⚠️ Audit sécurité à faire
- ⚠️ Rate limiting API
- ⚠️ Anonymisation logs

---

## 🎯 PRIORITÉS PROCHAINES ACTIONS

### P0 - URGENT (avant production)
1. **Clarifier fichiers Flooow** (12 JSON) - Supprimer ou garder ?
2. **Exécuter tests E2E** sur production (https://app.groupeetdecouverte.fr)
3. **Ajouter validation âge** (30 min)
4. **Afficher modes paiement** (1h)

### P1 - IMPORTANT (cette semaine)
5. **Configurer emails** (Resend/SendGrid) - 2-4h
6. **Monitoring production** (Sentry) - 2h
7. **Tests automatisés CI/CD** (GitHub Actions) - 4h
8. **Rate limiting API** - 2h

### P2 - AMÉLIORATION (ce mois)
9. **Stripe Phase 4** (paiement CB) - 1 jour
10. **Espace Pro complet** - 2-3 jours
11. **Lazy-load Supabase** (fix timeout build local) - 4h
12. **Audit sécurité** - 1 jour

---

## 📝 NOTES POUR IA SUIVANTE

### Contexte Essentiel
1. **CE PROJET EST GED, PAS FLOOOW**
2. Pas d'aides financières (contrairement à Flooow)
3. Âge: 3-17 ans (pas 6-17 ans comme Flooow)
4. Tables BDD: `gd_*` (pas `flooow_*`)
5. URL prod: https://app.groupeetdecouverte.fr

### Commandes À NE PAS LANCER
❌ `npm run dev` (timeout 3min local)
❌ Modifications `lib/supabaseGed.ts` (fragile)
❌ Suppression fichiers sans confirmation utilisateur

### Commandes Sûres
✅ Lecture fichiers (Read tool)
✅ Grep/recherche code
✅ Modifications components/ (React)
✅ Modifications app/api/ (routes API)
✅ Tests (après config pour prod)

### Fichiers Références Critiques
```
✅ CARTOGRAPHIE_COMPLETE_APP.md (structure app)
✅ RAPPORT_ANTI_REGRESSION_FINAL.md (CityCrunch vs UFOVAL)
✅ TESTS_GED_PROJET_REEL.md (tests adaptés GED)
✅ ETAT_LIEUX_COMPLET_GED_2026-02-15.md (CE FICHIER)
```

### Questions Non Résolues
1. **Fichiers Flooow:** 12 JSON à supprimer ou garder ?
2. **Tests prod:** Config Playwright pour https://app.groupeetdecouverte.fr ?
3. **Stripe:** Clés API disponibles ?
4. **Emails:** Service préféré (Resend/SendGrid/SMTP) ?

---

## 🚨 MODE TRAVAIL DEMANDÉ

### ÉCONOMIE TOKENS
- ✅ Lire docs existantes avant d'agir
- ✅ Grep/search au lieu de Read complet
- ✅ Modifications ciblées (Edit tool, pas Write)
- ❌ Ne pas réécrire code existant fonctionnel

### SANS RÉGRESSION
- ✅ Toujours vérifier hiérarchie titres: `marketingTitle > titleKids > title`
- ✅ Ne jamais afficher noms UFOVAL (Croc' Marmotte, etc.)
- ✅ Tester sur /verify-db avant/après modif
- ❌ Ne pas toucher logique calcul prix sans tests

### SANS EFFET CASCADE
- ✅ Modifications isolées (1 fichier à la fois)
- ✅ Vérifier imports avant modif
- ✅ Tester localement si possible
- ❌ Ne pas refactoriser sans demande explicite

---

**Document créé pour:** Passation IA suivante
**Dernière mise à jour:** 15 février 2026 18:00
**Prochaine action attendue:** Clarification fichiers Flooow + exécution tests
