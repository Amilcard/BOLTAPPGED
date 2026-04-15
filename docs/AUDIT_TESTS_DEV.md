# Audit tests — Brief dev critique

> Contexte : GED App — Next.js 15 / Supabase / Stripe / JWT custom
> 41 suites · 391 tests · 300 passent · 15 suites en échec (pré-existants)
> Stack test : Jest + @testing-library/react + jest-axe + Playwright (0 test E2E écrit)

---

## 1. INSTRUCTION DEV — Séquence de travail

**Avant tout : charge les compétences adaptées, dans l'ordre.**

```
# Étape 1 — Cartographie rapide (< 5 min)
Lis ce fichier + docs/TESTS_COVERAGE.md + .husky/pre-commit

# Étape 2 — Charge les compétences (outils, agents, skills)
Identifie toi-même quelles compétences sont pertinentes parmi :
  - functional-bug-hunter     → bugs silencieux, états invalides, edge cases
  - supabase-integrity-auditor → RLS, migrations, intégrité données
  - security-review            → auth, JWT, ownership, injection
  - workflow-integration-reviewer → Stripe webhook, n8n, crons
  - ux-ui-reviewer             → accessibilité, composants
  - arch-impact-reviewer       → couplage, blast radius
  - deploy-safety-reviewer     → risques pré-prod

# Étape 3 — Critique + gaps (ce document)
# Étape 4 — Ajuste : désactive ce qui ne s'applique pas, charge ce qui manque
```

---

## 2. CRITIQUE DES TESTS EXISTANTS — Points à vérifier

### 2.1 Mocks trop permissifs (risque : faux positifs)

| Zone | Observation | À vérifier |
|---|---|---|
| Supabase mock global | `mockFrom` retourne des chaînes fixes — ne reflète pas le comportement réel des joins/RLS | Les tests passent-ils parce que la logique est correcte ou parce que le mock absorbe tout ? |
| `constructEvent` Stripe | Mock synchrone — OK après correction. Mais le mock `upsert().select().maybeSingle()` est fragile si la route change | Vérifier que la chaîne mock suit exactement le code de `app/api/webhooks/stripe/route.ts` |
| Email mocks | `jest.mock('@/lib/email', ...)` — aucun test ne vérifie le contenu des emails envoyés | Si `sendInscriptionConfirmation` est appelé avec les mauvaises données, aucun test ne le détecte |
| `auditLog` mock global | Toujours `jest.fn().mockResolvedValue(undefined)` — jamais vérifié qu'il est appelé | Routes Art. 9 (medical, dossier) : `auditLog` est-il vraiment appelé dans le code ? |

### 2.2 Couverture partielle sur les périmètres critiques

| Périmètre | Statut | Risque |
|---|---|---|
| Stripe webhook — 15 suites en échec dont `webhook-stripe.test.ts` | ❌ | Perte financière silencieuse si les transitions d'état sont cassées |
| `payment-create-intent` — 8/9 tests échouent | ❌ | Intent à 0€, race condition, idempotence non vérifiés en CI |
| Auth 2FA — 7/13 échecs | ❌ | Bypass 2FA possible si les routes retournent des codes incorrects |
| Codes structure (CDS/directeur/délégation) | ❌ 5 mocks | Délégation > 90 jours non bloquée si le mock est mal câblé |
| RLS Supabase | 4 tests seulement | Les tests mockent Supabase — RLS n'est **jamais** testée en conditions réelles |

### 2.3 Tests unitaires — ce qui manque dans les composants UI

| Composant | Couvert | Non couvert |
|---|---|---|
| `DossierBadge` | 7 états visuels + axe | Clic, interaction, events |
| `BottomNav` | Items, routes, badge, clic | Comportement offline, hydration SSR |
| `AdminUIProvider` | Dialog + Toast | Toast auto-masquage (timer) non testé |
| `PaymentMethodSelector` | 3 clics | État disabled pendant chargement |
| Formulaires (inscription, dossier, souhait) | **0 test composant** | Validation inline, messages d'erreur, UX submit |

### 2.4 Logique métier non testée

| Fonction / module | Fichier source | Test existant |
|---|---|---|
| `mappers/stay.ts` — `marketing_title || title` | `lib/mappers/stay.ts` | ❌ aucun |
| `verifyOwnership()` | `lib/verify-ownership.ts` | Couvert indirectement via security-ownership |
| `lib/auth-cookies.ts` — `setSessionCookie` | `lib/auth-cookies.ts` | Mocké, jamais testé directement |
| `lib/totp.ts` — `verifyToken`, `generateSecret` | `lib/totp.ts` | Mocké dans auth-2fa, jamais testé en isolé |
| `lib/env.ts` — `getServerEnv` | `lib/env.ts` | ✅ couvert |
| Crons (`expire-codes`, `rgpd-purge`, `health-checks`) | `app/api/cron/*/route.ts` | ❌ aucun |

---

## 3. PÉRIMÈTRES NON COUVERTS — Priorisation

### Critique (impact financier ou sécurité)

```
[ ] Stripe webhook nominal — webhook-stripe.test.ts en échec
    → 4 scénarios : paid, amount_mismatch, skip idempotent, failed
    → Risque : transactions non enregistrées en DB

[ ] Auth login complet — auth-login.test.ts en échec
    → JWT non posé, cookie absent, rate limiting non bloquant
    → Risque : authentification bypassable

[ ] 2FA verify/confirm — 7 scénarios en échec
    → Risque : second facteur non vérifié en CI

[ ] RLS en conditions réelles
    → Les 4 tests actuels mockent Supabase — ils ne testent PAS la vraie RLS
    → Seul un test d'intégration avec Supabase réel peut valider ça
```

### Haute priorité (régressions probables)

```
[ ] Formulaires UI — 0 test composant sur les écrans principaux
    → Inscription, dossier enfant, souhait : validation inline, submit, erreurs

[ ] Crons — 3 routes sans test
    → expire-codes : logique révocation CDS + directeur + access_codes
    → rgpd-purge : purge données médicales + audit logs
    → health-checks : HC-1→HC-5 retournent le bon statut

[ ] mapper/stay.ts — marketing_title, titlePro, titleKids, rawTitle
    → Logique d'affichage du nom GED vs UFOVAL jamais testée unitairement
```

### Moyenne priorité

```
[ ] lib/totp.ts — verifyToken avec window, drift, secret invalide
[ ] lib/auth-cookies.ts — httpOnly, secure, sameSite sur cookie posé
[ ] Delegation structure — PATCH /api/structure/[code]/delegation
    → max 90 jours, suppression, directeur uniquement
[ ] Admin stats — filtrage is_test = false (13 inscriptions test)
    → Régression possible si le filtre saute
```

### Faible priorité (confort / CI)

```
[ ] E2E Playwright — 3 parcours critiques (inscription → paiement → dossier)
[ ] Snapshot tests composants UI (charte graphique token validation)
[ ] Test de charge rate limiting (gd_login_attempts)
[ ] Emails transactionnels — contenu HTML vérifié
```

---

## 4. COMPÉTENCES À ACTIVER — Décision dev

**Lis la liste ci-dessous. Active uniquement ce qui correspond aux gaps que tu veux traiter.**

| Compétence | Active si tu travailles sur... |
|---|---|
| `functional-bug-hunter` | Corriger les 15 suites en échec, trouver les edge cases silencieux |
| `workflow-integration-reviewer` | Stripe webhook, crons, idempotence paiement |
| `security-review` | Auth 2FA, JWT, codes structure, RLS |
| `supabase-integrity-auditor` | RLS réelle, migrations, intégrité FK |
| `ux-ui-reviewer` | Tests composants formulaires, accessibilité |
| `arch-impact-reviewer` | Si tu proposes de refactorer les mocks ou la structure de tests |
| `deploy-safety-reviewer` | Avant de pousser des corrections en prod |

**Ne pas activer en parallèle :** `security-review` + `supabase-integrity-auditor` sur le même périmètre — ils se chevauchent. Choisis l'un ou l'autre selon que le risque est applicatif (auth) ou données (RLS).

---

## 5. FICHIERS DE RÉFÉRENCE

```
docs/TESTS_COVERAGE.md          — carte complète des 41 suites
docs/GOVERNANCE.md              — règles données + trigger matrix agents
CLAUDE.md                       — règles sécurité, RGPD, architecture
tests/api/webhook-stripe-edge-cases.test.ts — exemple de mock Supabase correct
tests/unit/env-config.test.ts   — exemple d'isolation jest.resetModules()
jest.setup.js                   — mocks globaux (auditLog, env)
.husky/pre-commit               — gate CI local (unit only)
```
