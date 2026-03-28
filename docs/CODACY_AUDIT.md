# AUDIT CODACY — BOLTAPPGED (`main`) — 28/03/2026

> **Chemin local du projet :** `/Users/laidhamoudi/Dev/GED_APP`
> **Repo GitHub :** `https://github.com/Amilcard/BOLTAPPGED`
> **Dashboard Codacy :** `https://app.codacy.com/gh/Amilcard/BOLTAPPGED/dashboard`
> **Ce fichier est destiné à Claude Code** pour vérification et correction des points listés ci-dessous.

---

## MÉTRIQUES GLOBALES

| Métrique | Valeur | Objectif |
|---|---|---|
| Grade global | **C** | A ou B |
| Issues totales | **1 337** | — |
| Issues / kLoC | **50.034** | ≤ 20 |
| Duplication | **15%** | < 5% |
| Complexité | **0%** | ✅ Bon |
| Coverage | **non configuré** | > 70% |
| Branche `main` protégée | **Non** | Oui |
| Fichier `.eslintrc` | **Absent** | Requis |
| Outils actifs Codacy | 12 / 22 | — |

---

## RÉPARTITION DES 1 337 ISSUES

| Catégorie | Total |
|---|---|
| Code style | 666 |
| Error prone | 456 |
| Best practice | 121 |
| Security | 69 |
| Compatibility | 25 |

---

## 🔴 PRIORITÉ 1 — SÉCURITÉ CRITIQUE

### 1.1 Dépendances vulnérables (`package-lock.json`)

| Package | Version actuelle | CVE / GHSA | Mise à jour requise |
|---|---|---|---|
| `next` | 14.2.35 | GHSA-h25m-26qc-wcjf (DoS RSC) | ≥ 15.0.8 |
| `next` | 14.2.35 | CVE-2026-27980 (disk cache) | ≥ 16.1.7 |
| `next` | 14.2.35 | CVE-2026-29057 (HTTP smuggling) | ≥ 15.5.13 |
| `next` | 14.2.35 | CVE-2025-59471 (DoS image optimizer) | ≥ 15.5.10 |
| `fast-xml-parser` | 5.3.6 | CVE-2026-33036 (entity expansion) | ≥ 5.5.6 |
| `fast-xml-parser` | 5.3.6 | CVE-2026-27942 (stack overflow DoS) | ≥ 5.3.8 |
| `serialize-javascript` | 6.0.2 | GHSA-5c6j-r48x-rmvq (RCE RegExp) | ≥ 7.0.3 |

**Action :** `npm update next fast-xml-parser serialize-javascript` + `npm audit fix`

### 1.2 Secrets hardcodés (corrigé aujourd'hui — à auditer)

Commit `45ae06e` : `fix(security): remove all hardcoded secrets — resolve 31 SonarCloud BLOCKERs`

**Vérifier :**
- Aucun secret résiduel dans `git log` (`git log -S "sk_live"`, `git log -S "sk_test"`, `git log -S "service_role"`)
- Fichier `.env` absent du repo (`.gitignore` correct)
- Variables d'environnement correctement définies sur Vercel

### 1.3 Injections d'objet (Object Injection Sink)

| Fichier | Ligne | Type |
|---|---|---|
| `components/home-carousels.tsx` | 89 | Generic Object Injection |
| `config/premium-themes.ts` | 313–314 | Generic Object Injection |
| `scripts/audit_pricing_integrity.js` | 59–60 | Generic Object Injection |
| `n8n-patches/UFOVAL_COMPLETUDE_EXTRACT_FIX_v2026_03.js` | 161 | Generic Object Injection |
| `scripts/upload-pdf-sejours.mjs` | 105 | Variable Assigned to Object Injection |
| `n8n-patches/UFOVAL_COMPLETUDE_EXTRACT_FIX_v2026_03.js` | 89 | Variable Assigned to Object Injection |
| `scripts/audit_pricing_integrity.js` | 71 | Function Call Object Injection |

### 1.4 Accès fichiers non sécurisés (chemins non littéraux)

| Fichier | Ligne | Fonction |
|---|---|---|
| `scripts/audit_coherence_table.js` | 19, 21 | `existsSync`, `readFileSync` |
| `scripts/audit_graphic_full.js` | 16, 21 | `existsSync`, `readFileSync` |
| `scripts/upload-pdf-sejours.mjs` | 119 | `readFileSync` |
| `app/api/dossier-enfant/[inscriptionId]/pdf/route.ts` | 107 | `readFile` |

### 1.5 Autres vulnérabilités

| Fichier | Ligne | Type |
|---|---|---|
| `scripts/audit_graphic_full.js` | 32 | Unsafe Regular Expression (ReDoS) |
| (2 fichiers) | — | XSS via `location.href` direct |

---

## 🔴 PRIORITÉ 2 — ABSENCE DE TESTS

**Aucun rapport de coverage n'est envoyé à Codacy.**

Flux critiques sans aucun test :

- `components/booking-flow.tsx` — tunnel de réservation complet
- `app/api/payment/create-intent/route.ts` — création PaymentIntent Stripe
- `app/api/webhooks/stripe/route.ts` — webhook Stripe (paiements)
- `app/api/dossier-enfant/` — dossier enfant (données sensibles)
- `middleware.ts` + `app/api/auth/` — authentification

**Action :** Mettre en place Jest/Vitest + envoyer rapports via `CODACY_PROJECT_TOKEN`

---

## 🟠 PRIORITÉ 3 — ROBUSTESSE TYPESCRIPT (456 issues)

### 3.1 Non-null assertions `!` sur variables d'environnement

Risque : crash brutal si variable absente en prod.

| Fichier | Variable |
|---|---|
| `patches-securite-financiere/stripe-webhook_route.ts` (l.6, 34) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| `patches-securite-financiere/create-intent_route.ts` (l.11) | `SUPABASE_SERVICE_ROLE_KEY` |
| `app/api/webhooks/stripe/route.ts` (l.17) | `SUPABASE_SERVICE_ROLE_KEY` |
| Toutes les routes API | `NEXT_PUBLIC_SUPABASE_URL` |

**Fix global :** Créer `lib/env.ts` avec validation `zod` au démarrage.

### 3.2 `as any` à remplacer par `as unknown` (79 occurrences — Quick Fix disponible)

Fichiers principaux :
- `app/sejour/[id]/stay-detail.tsx` (5 occurrences, lignes 96, 175, 403, 457, 476)
- `components/booking-flow.tsx` (ligne 133)
- `app/api/webhooks/stripe/route.ts` (lignes 44, 166)
- `app/api/payment/create-intent/route.ts` (ligne 103)

### 3.3 Promesses non gérées

| Fichier | Ligne | Fix |
|---|---|---|
| `app/suivi/[token]/page.tsx` | 496 | Ajouter `void` |
| `app/admin/demandes/[id]/page.tsx` | 93 | Ajouter `void` |
| `components/dossier-enfant/useDossierEnfant.ts` | 68 | Ajouter `void` |
| `components/booking-flow.tsx` | 108 | `onSubmit` async non géré |

### 3.4 Divers

- `n8n-patches/UFOVAL_COMPLETUDE_EXTRACT_FIX_v2026_03.js` ligne 108 : `$input` non défini (variable n8n non reconnue par ESLint — à ignorer ou à déclarer en global)
- `components/dossier-enfant/DossierEnfantPanel.tsx` ligne 269 : conditionnel inutile
- `app/admin/propositions/page.tsx` ligne 672 : valeur toujours truthy
- `config/premium-themes.ts` ligne 309 : optional chain inutile

---

## 🟠 PRIORITÉ 4 — DUPLICATION (15%)

### Fichiers les plus dupliqués

| Fichier | Clones |
|---|---|
| `app/api/dossier-enfant/[inscriptionId]/upload/route.ts` | 14 |
| `app/api/webhooks/stripe/route.ts` | 9 |
| `patches-securite-financiere/stripe-webhook_route.ts` | 9 |
| `components/dossier-enfant/FicheSanitaireForm.tsx` | 13 |
| `components/dossier-enfant/BulletinComplementForm.tsx` | 10 |
| `app/sejour/[id]/stay-detail.tsx` | 10 |
| `app/admin/users/page.tsx` | 7 |

### Refactorisations recommandées

1. **Création client Supabase** : dupliquée dans toutes les routes API → factoriser dans `lib/supabase-server.ts`
2. **Formulaires dossier enfant** : pattern `onChange={e => update('field', e.target.value)}` répété → créer `<ControlledInput>` ou hook `useFormField`
3. **Gestion d'erreurs API** : try/catch identique dans chaque route → middleware ou wrapper `withAuth(handler)`

---

## 🟠 PRIORITÉ 5 — COMPATIBILITÉ SQL

Fichiers SQL avec syntaxes incompatibles PostgreSQL/Supabase :

| Fichier | Problème |
|---|---|
| `sql/010_remove_stripe_lyra_migration.sql` (multiples lignes) | `RAISE NOTICE` hors bloc PL/pgSQL |
| `sql/CORRECTION_SESSIONS_8_SEJOURS_UFOVAL.sql` (l.43, 128) | `RAISE NOTICE` hors bloc PL/pgSQL |
| `prisma/migrations/20260126140858_add_ingestion_fields/migration.sql` (l.2, 3, 40, 41) | `PRAGMA` (SQLite uniquement — incompatible PostgreSQL) |

---

## 🟡 PRIORITÉ 6 — CONFIGURATION À METTRE EN PLACE

### 6.1 Créer `.codacy.yml` à la racine (réduire le bruit métrique)

~300–400 issues viennent de fichiers non-code scannés par erreur.

```yaml
# .codacy.yml
exclude_paths:
  - ".agent/**"
    - ".claude/**"
      - "docs/**"
        - "sql/REFERENCE_*.sql"
          - "sql/GUIDE_*.md"
            - "sql/GRILLE_*.sql"
              - "sql/AUDIT_*.sql"
                - "sql/VISUALISATION_*.sql"
                  - "n8n-patches/GUIDE_*.md"
                    - "AUDIT_N8N_VPS.md"
                      - "DIAGNOSTIC.md"
                        - "README-INSTALLATION.md"
                          - "REVIEW_ESPACE_PRO_ARCHITECTURE.md"
                          ```

                          Impact estimé : grade passerait de C à B.

                          ### 6.2 Créer `.eslintrc.js` adapté Next.js/TypeScript

                          Codacy signale l'absence de fichier ESLint. Sans lui, il utilise des règles génériques inadaptées.

                          ### 6.3 Protéger la branche `main` sur GitHub

                          Settings → Branches → Add rule → `main` :
                          - Require pull request reviews before merging
                          - Require status checks to pass
                          - Block direct pushes

                          ### 6.4 Configurer la coverage

                          ```bash
                          # Dans CI (GitHub Actions) :
                          npx jest --coverage --coverageReporters=lcov
                          bash <(curl -Ls https://coverage.codacy.com/get.sh) report -r coverage/lcov.info
                          ```

                          ---

                          ## FICHIERS LES PLUS PROBLÉMATIQUES (top 10 code source)

                          | Rang | Fichier | Issues | Clones |
                          |---|---|---|---|
                          | 1 | `components/booking-flow.tsx` | 50 | 0 |
                          | 2 | `components/dossier-enfant/FicheSanitaireForm.tsx` | 44 | 13 |
                          | 3 | `app/sejour/[id]/stay-detail.tsx` | 42 | 10 |
                          | 4 | `app/admin/propositions/page.tsx` | 29 | 6 |
                          | 5 | `components/dossier-enfant/BulletinComplementForm.tsx` | 27 | 10 |
                          | 6 | `components/dossier-enfant/FicheLiaisonJeuneForm.tsx` | 23 | 8 |
                          | 7 | `app/admin/sejours/page.tsx` | 22 | 4 |
                          | 8 | `app/suivi/[token]/page.tsx` | 17 | 0 |
                          | 9 | `app/admin/demandes/page.tsx` | 16 | 1 |
                          | 10 | `app/admin/demandes/[id]/page.tsx` | 15 | 1 |

                          ---

                          ## CONTEXTE COMMITS (cadence récente)

                          - **+80 commits en 10 jours** sur `main` — projet en phase finale de stabilisation
                          - Auteur principal : **LAID** (avec merges HAMOUDI LAID)
                          - Corrections récentes significatives :
                            - `fix(security): remove all hardcoded secrets` (31 BLOCKERs SonarCloud) — il y a 3h
                              - `fix(auth): middleware jose, verifyAuth cookie fallback` — il y a 24min
                                - `fix(reliability): localeCompare sort()` — il y a 1h
                                  - `feat(rgpd): renforcement conformité RGPD` — il y a 3 jours
                                    - `test(api): suite parcours complet P1→P6` — il y a 3 jours

                                    ---

                                    ## CHECKLIST DE VÉRIFICATION POUR CLAUDE CODE

                                    - [ ] `npm audit` — lister toutes les vulnérabilités actives
                                    - [ ] Mettre à jour `next`, `fast-xml-parser`, `serialize-javascript`
                                    - [ ] Auditer l'historique git pour résidus de secrets (`git log -S "sk_"`)
                                    - [ ] Corriger les Object Injection Sinks (7 occurrences)
                                    - [ ] Corriger les accès fichiers non sécurisés (4 fichiers)
                                    - [ ] Créer `lib/env.ts` avec validation zod des variables d'environnement
                                    - [ ] Remplacer tous les `as any` par `as unknown` (Quick Fix Codacy disponible)
                                    - [ ] Corriger les promesses non gérées (4 fichiers)
                                    - [ ] Créer `.codacy.yml` pour exclure les fichiers non-code
                                    - [ ] Créer `.eslintrc.js` adapté au projet
                                    - [ ] Factoriser `createClient(supabase)` dans `lib/supabase-server.ts`
                                    - [ ] Refactoriser les formulaires dossier enfant (duplication)
                                    - [ ] Corriger les migrations SQL (`PRAGMA` PostgreSQL-incompatible)
                                    - [ ] Protéger la branche `main` sur GitHub
                                    - [ ] Mettre en place Jest + envoyer coverage à Codacy
                                    
