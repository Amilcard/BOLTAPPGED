# Couverture tests — GED App

> Dernière mise à jour : 2026-04-15
> 41 suites · 391 tests · 300 passent (77 %) · 119 unitaires verts (Husky)

---

## Périmètres couverts

### 1. Authentification & autorisation

| Fichier | Scénarios | Statut |
|---|---|---|
| `unit/auth-middleware.test.ts` | `verifyAuth`, `requireAdmin`, `requireEditor` — token valide/invalide/expiré, rôles VIEWER/EDITOR/ADMIN | ✅ |
| `unit/middleware-config.test.ts` | Protection route `/admin` — redirect, bypass chemins publics | ✅ |
| `unit/middleware-auth-bypass.test.ts` | VIEWER sur `/admin`, EDITOR sur `/admin`, rôle falsifié, cookie absent, signature JWT invalide, VIEWER sur `/reserver` | ✅ |
| `api/auth-login.test.ts` | Login email/password — succès, mauvais mdp, compte inexistant, rate limiting, cookie httpOnly | ❌ pré-existant |
| `api/auth-2fa.test.ts` | Setup TOTP (401 sans JWT, QR code, secret non exposé), Confirm (code valide/invalide, 404 si non configuré), Verify (pendingToken manquant/expiré/sans flag, 2FA désactivée, code valide) | ❌ 7/13 pré-existants |

### 2. Paiement & Stripe

| Fichier | Scénarios | Statut |
|---|---|---|
| `api/webhook-stripe-edge-cases.test.ts` | `inscriptionId` absent → 200 skip, déjà `paid` → idempotent, `STRIPE_WEBHOOK_SECRET` absent → erreur, update Supabase KO → 500 retry | ✅ |
| `api/webhook-stripe.test.ts` | `payment_intent.succeeded` → paid, montant différent → amount_mismatch, event déjà traité → skip, `payment_failed` → failed | ❌ pré-existant |
| `api/payment-create-intent.test.ts` | Champs manquants → 400, inscription introuvable → 404, price = 0 → 400, price négatif → 400, création réussie → 200 + clientSecret, intent idempotent, race condition | ❌ pré-existant |
| `api/inscriptions-virement.test.ts` | Inscription virement, inscription chèque, validation montant | ❌ pré-existant |

### 3. Sécurité & RGPD

| Fichier | Scénarios | Statut |
|---|---|---|
| `api/security-ownership.test.ts` | IDOR sur `dossier-enfant` GET/PATCH/upload — mauvais propriétaire → 403, bon propriétaire → 200 | ✅ |
| `api/security-admin-access.test.ts` | `POST /merge` ADMIN only, `PATCH /link` EDITOR+, relance inscription, propositions tarifaires — contrôle rôles | ✅ |
| `api/security-role-escalation.test.ts` | VIEWER ne peut pas écrire sur 6 routes protégées | ✅ |
| `api/rls-security.test.ts` | Accès direct Supabase clé anon — tables sensibles bloquées (RLS) | ✅ |
| `api/structure-code-security.test.ts` | Code expiré → 401, code révoqué → 401, code inconnu → 401, délégation CDS via PATCH, délégation > 90 jours → 400 | ❌ 5 mocks à corriger |
| `unit/env-config.test.ts` | Zod : `SUPABASE_URL` absente/invalide, `STRIPE_SECRET_KEY` sans `sk_`, `NEXTAUTH_SECRET` trop court, tout valide → OK | ✅ |

### 4. Dossier enfant

| Fichier | Scénarios | Statut |
|---|---|---|
| `api/dossier-get.test.ts` | GET par inscriptionId — auth, ownership, données retournées | ✅ |
| `api/dossier-submit.test.ts` | Soumission complète — validation Zod, consentement parental, RGPD, anti-doublon | ✅ |
| `api/dossier-upload.test.ts` | Upload PJ — whitelist MIME, taille max, stockage, suppression, ownership | ✅ |
| `api/dossier-enfant.test.ts` | CRUD complet dossier — création, lecture, mise à jour | ✅ |

### 5. Inscriptions

| Fichier | Scénarios | Statut |
|---|---|---|
| `api/inscriptions.test.ts` | Validation Zod : sans consentement, email invalide, prix négatif, prix = 0 | ❌ pré-existant |
| `api/parcours-complet.test.ts` | Parcours E2E P1→P6b : inscription → dossier → soumission → upload → statut admin → badge retard → anti-doublon après annulation | ✅ |

### 6. Séjours

| Fichier | Scénarios | Statut |
|---|---|---|
| `api/admin-stays.test.ts` | GET liste, PUT mise à jour, DELETE, GET par slug — accès admin, validation | ✅ |
| `api/stays.test.ts` | API publique séjours (4 tests — skipped) | ⏭ skip |

### 7. Structures partenaires

| Fichier | Scénarios | Statut |
|---|---|---|
| `api/suivi-structure.test.ts` | PATCH suivi token/structure — ownership, attachement, détachement | ✅ |
| `api/suivi-token.test.ts` | GET/PATCH token suivi — lecture, mise à jour, sécurité | ✅ |
| `api/structures.test.ts` | Recherche par CP (validation, résultats, email masqué), vérification code (trop court, valide) | ❌ pré-existant |
| `api/structure-incidents.test.ts` | GET (rôles éducateur/secrétariat), POST (rôles, sans inscription_id, catégorie invalide, description courte), PATCH (statut resolu, statut invalide) | ❌ pré-existant |
| `api/structure-medical.test.ts` | GET compteur éducateur vs détail CDS, secrétariat refusé, POST rôles, sans event_type | ❌ pré-existant |
| `api/structure-calls-notes.test.ts` | Appels : lecture éducateur, création CDS, type parents sans accord, type invalide. Notes : lecture éducateur, création direction, sans inscription_id, contenu trop court | ❌ pré-existant |

### 8. Souhaits / Envies

| Fichier | Scénarios | Statut |
|---|---|---|
| `api/souhaits.test.ts` | POST souhait — email générique non structuré, doublon non traité, doublon déjà validé | ❌ pré-existant |
| `api/souhaits-kid.test.ts` | GET/POST souhaits enfant via kidToken | ❌ pré-existant |
| `api/educateur-souhait.test.ts` | GET/PATCH souhait éducateur via token | ✅ |

### 9. Utilisateurs admin

| Fichier | Scénarios | Statut |
|---|---|---|
| `api/admin-users.test.ts` | GET liste utilisateurs, POST création — auth, validation, doublons | ✅ |
| `api/admin-inscriptions-crud.test.ts` | GET liste, GET détail, PUT, DELETE — accès EDITOR/ADMIN | ❌ pré-existant |
| `api/admin-routes-gap.test.ts` | Stats admin, sessions séjour, prix session, notify-waitlist, dossier admin | ❌ pré-existant |

### 10. Composants UI

| Fichier | Scénarios | Statut |
|---|---|---|
| `unit/accessibility-axe.test.tsx` | jest-axe sur BottomNav (Pro/Kids/skeleton), DossierBadge (6 états), PaymentMethodSelector, AdminUIProvider — 0 violation WCAG | ✅ |
| `unit/admin-ui.test.tsx` | ConfirmDialog (message, boutons disabled async, Annuler), Toast (success/error), hook hors contexte | ✅ |
| `unit/bottom-nav.test.tsx` | Items Pro/Kids, masquage /admin, skeleton, isActive par route, badge wishlist (count/9+/Pro), navigation au clic | ✅ |
| `unit/dossier-badge.test.tsx` | null → état initial, 0/4, 2/4 (indicateurs colorés), 4/4 complet, gedSentAt → Envoyé, vaccins, pj_count | ✅ |
| `unit/payment-method-selector.test.tsx` | 3 options rendues (labels + délais), clic carte/virement/chèque → bon callback uniquement | ✅ |

### 11. Logique métier pure

| Fichier | Scénarios | Statut |
|---|---|---|
| `unit/metier-ged.test.ts` | `calculateGedPrice()`, `isGedCity()`, `calculateAgeAtDate()`, `validateChildAge()`, `getDurationDays()`, `mapDateToSeason()`, `generateSlug()` — 36 cas | ✅ |

---

## Ce qui n'est PAS couvert (périmètres manquants)

| Périmètre | Priorité | Notes |
|---|---|---|
| E2E Playwright — parcours inscription complet (navigateur réel) | Haute | Config Playwright présente, 0 test écrit |
| E2E Playwright — paiement Stripe (mode test) | Haute | Parcours critique non couvert en vrai navigateur |
| E2E Playwright — accès structure via code | Haute | 3 rôles (éducateur/CDS/directeur) non testés navigateur |
| Tests visuels / snapshot CSS | Moyenne | Charte graphique vérifiée manuellement seulement |
| Tests de charge / limites rate limiting | Faible | `gd_login_attempts` non soumis à charge réelle |
| Tests emails transactionnels (Resend) | Faible | `sendInscriptionConfirmation` etc. mockées en test |
| Crons (`expire-codes`, `rgpd-purge`, `health-checks`) | Faible | Routes créées, aucun test d'intégration |

---

## Infrastructure tests

| Outil | Rôle | État |
|---|---|---|
| **Jest** | Runner principal (unit + api) | ✅ configuré |
| **jest-axe** | Accessibilité WCAG sur composants | ✅ installé |
| **@testing-library/react** | Rendu composants | ✅ |
| **Husky pre-commit** | Bloque commit si `tests/unit` KO | ✅ (fix grep `|| true` inclus) |
| **GitHub Actions `bundle-check.yml`** | Build + seuils bundle (4,5 MB total, 600 KB/chunk) | ✅ |
| **GitHub Actions `typecheck.yml`** | `tsc --noEmit` sur push | ✅ |
| **GitHub Actions `eslint.yml`** | ESLint 0 warning sur push/PR | ✅ |
| **Playwright** | E2E navigateur | ⚠ config présente, 0 test écrit |
