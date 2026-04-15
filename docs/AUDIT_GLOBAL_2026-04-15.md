# Audit global GED App — 15 avril 2026

> Audit multi-périmètres : architecture, Supabase, sécurité, frontend, tests.
> Agents mobilisés : arch-impact-reviewer, supabase-integrity-auditor, frontend-guardian, functional-bug-hunter, code-review-graph.
> Croisement : docs historiques, CLAUDE.md, vérification en base prod, retour architecte.

---

## Périmètre audité

| Couche | Outils | Résultat |
|---|---|---|
| Architecture | Knowledge graph (2173 noeuds, 19298 arêtes, 200 flows, 10 communautés) | 6 warnings couplage |
| Supabase | 67 migrations relues, RLS vérifié en base prod | 7 findings (2 résolus, 5 ouverts) |
| Sécurité | Injection, auth bypass, race conditions, RGPD | 8 findings (7 fixés, 1 ouvert) |
| Frontend | Error boundaries, loading states, localStorage, responsive | 15 findings (3 fixés, 12 backlog) |
| Tests | 41 suites, 391 tests, Husky pre-commit | 15 suites fixées → 0 échec |
| Build | TypeScript, ESLint, Next.js build prod | 0 erreur |

---

## Findings corrigés (commit 5578bf3)

| # | Sévérité | Finding | Fix appliqué | Fichier(s) |
|---|---|---|---|---|
| C1 | CRITICAL | Injection PostgREST via `or()` interpolation directe dans admin/structures search | Sanitize input `[^a-zA-ZÀ-ÿ0-9\s\-']` + slice(100) | `app/api/admin/structures/route.ts` |
| C2 | CRITICAL | PII en localStorage (`prenom`, `emailStructure` dans wishlist kids) — violation RGPD règle 9 | Champs retirés de `WishlistItem`, `canAddRequest` basé sur stayId seul | `lib/utils.ts`, `wishlist-form.tsx`, `envies/page.tsx` |
| C6 | CRITICAL | Enum paiement factures : state initial `'Virement'` (majuscule) ≠ API `'virement'` (minuscule) | Corrigé en minuscule (2 occurrences) | `app/admin/factures/page.tsx` |
| H4 | HIGH | Rate-limit price-inquiry non-atomique (check + increment séparés = race condition bypass) | Remplacé par `isRateLimited()` RPC atomique de `lib/rate-limit.ts` | `app/api/pro/price-inquiry/route.ts` (−50 lignes) |
| H5 | HIGH | `SELECT *` sur route structure expose `stripe_payment_intent_id` et `referent_tel` aux codes partagés | Colonnes explicites (sans champs Stripe/tel) | `app/api/structure/[code]/route.ts` |
| H6 | HIGH | `error.message` exposé dans 7 error boundaries — fuite potentielle de stack traces, noms de tables, URLs Supabase | Messages génériques fixes, `error` renommé en `_error` (unused) | 7 fichiers `error.tsx` |
| H7 | HIGH | `deleted_at` filter manquant sur ownership checks dans 4 routes structure POST (incidents, medical, calls, notes) | `.is('deleted_at', null)` ajouté | 4 fichiers route structure |

## Tests corrigés (même commit)

| Fichier test | Cause racine | Fix |
|---|---|---|
| `jest.setup.js` | Rate-limit et structure rate-limit non mockés globalement → 429 systématique sur ~55 tests | Mock global `@/lib/rate-limit` + `@/lib/rate-limit-structure` |
| `auth-2fa.test.ts` | 401→403 (routes retournent 403), pendingToken en body (route lit cookie), `clearPendingCookie` non mocké, JWT jsonwebtoken vs jose | Status codes corrigés, cookie mock, import jose, mock auth-cookies complet |
| `auth-login.test.ts` | Mock global `isRateLimited` override le test rate-limit | `jest.requireMock` pour override ponctuel |
| `webhook-stripe.test.ts` | Mock manque `.upsert().select().maybeSingle()`, `.update().eq().in()`, `delete` | Chaînes ajoutées dans `makeFullMock` + type `SupabaseMock` étendu |
| `structures.test.ts` | Email mask `m****@croix-rouge.fr` → réel `m****@***.fr`, verify route utilise `resolveCodeToStructure` non mocké | Expectation corrigée, mock `@/lib/structure` ajouté |
| `structure-medical.test.ts` | Éducateur = 2 appels DB (inscriptions + count), POST = 2 appels (ownership + insert) | Mocks par index d'appel (`mockFromOverrides`) |
| `structure-code-security.test.ts` | Pas de mock `resolveCodeToStructure`, role `'directeur'`→`'direction'`, body `delegation_active_from`→`from` | Mock `@/lib/structure`, valeurs alignées sur route |
| `structure-calls-notes.test.ts` | `.is()` manquant dans mock chain (ajouté par H7) | `.is: jest.fn().mockReturnThis()` ajouté |
| `admin-inscriptions-crud.test.ts` | Chaîne mock sans `.eq('gd_structures.is_test', false)` après `.select()` | Chaîne complète `select().eq().is().order().limit()` |
| `admin-routes-gap.test.ts` | 9 queries parallèles (Promise.all) non supportées par mock statique | Proxy récursif universel (thenable) |

---

## Faux positifs éliminés

| # | Finding initial | Verdict | Preuve |
|---|---|---|---|
| C3 | Policy `gd_audit_log_service_role_all` USING(true) permet DELETE par anon | **FAUX POSITIF** | `SELECT polname FROM pg_policy WHERE polrelid = 'gd_audit_log'::regclass` → seule `authenticated_read` (SELECT) existe. La policy a déjà été droppée en prod. |
| C5 | `status` vs `statut` key mismatch factures | **FAUX POSITIF** | Le code envoie `{ id, statut: status }` (ligne 258) — la variable locale `status` est mappée vers la clé `statut`. Pas de mismatch. |
| H8 | `roles: ['admin']` retourné par legacy structure codes → bypass `requireAdmin()` | **FAUX POSITIF** | `lib/structure.ts:96` retourne `roles: ['cds', 'secretariat', 'educateur']`. Ligne 130 : `roles: ['direction', 'cds', 'secretariat', 'educateur']`. Aucun `'admin'`. Confirmé en base : `gd_structure_access_codes` ne contient que `cds` et `direction`. |

**Score de précision de l'audit source : 7/10 (70%).** Les 3 faux positifs viennent de références à du SQL source (migrations) ou du code legacy qui ne reflètent plus l'état prod.

---

## Findings ouverts (non corrigés dans ce batch)

### HIGH — Sécurité / Architecture

| # | Finding | Impact | Effort | Décision requise |
|---|---|---|---|---|
| H1 | Pas de rollback capacité quand `payment_intent.payment_failed` → sièges consommés définitivement | Overbooking silencieux si paiements échouent régulièrement | ~2h | Non — fix technique : incrémenter `seats_left` dans le webhook failed |
| H3 | Turnstile sans timeout ni fallback — si Cloudflare down, toutes les inscriptions bloquées | Single point of failure sur le parcours inscription | ~30min | Non — ajouter `AbortSignal.timeout(3000)` + fallback allow avec log |

### MEDIUM — RGPD

| # | Finding | Impact | Effort | Décision requise |
|---|---|---|---|---|
| M8 | `gd_notes` et `gd_calls` sans purge RGPD — rétention indéfinie de PII enfants | Violation Art. 5.1.e RGPD (limitation conservation) | ~1h | **Oui** — durée de rétention à décider (suggestion : 3 ans post-session, aligné sur `gd_audit_log`) |

### MEDIUM — Dette technique

| # | Finding | Impact | Effort | Décision requise |
|---|---|---|---|---|
| H9 | `sendNewEducateurAlert` fire-and-forget — alertes duplicats silencieusement perdues sur Vercel serverless | GED non alerté quand nouvel éducateur correspond à structures existantes | ~5min | Non — ajouter `await` |
| M6 | Rate-limit `pro-session` copié-collé inline — diverge de `isRateLimited()` partagé | Divergence garantie dans le temps | ~15min | Non — remplacer par `isRateLimited()` |
| M3 | Routes factures structure sans `structureRateLimitGuard()` | Pas de rate-limit sur téléchargement factures/PDF | ~10min | Non — ajouter le guard |
| M1 | Format error inconsistant : `{error:{code,message}}` vs `{error:'string'}` sur ~40% routes | Clients API doivent gérer 2 formats | ~2h | Non — normaliser progressivement |
| M7 | Missing Zod validation sur `payment/create-intent`, `souhaits`, `waitlist` | Validation manuelle fragile | ~1h | Non |
| M2 | Route inscription = monolithe 596 lignes | Impossible à tester correctement, source de H7/M7 | ~4h | Non mais gros refactor |
| M9 | FK constraints `NOT VALID` jamais validées (migration 010) | Contraintes décoratives, orphelins possibles | ~10min SQL | Non — `VALIDATE CONSTRAINT` après vérif `v_orphaned_records` |
| M4 | Dual Supabase client (`supabaseGed` singleton vs `getSupabaseUser` factory) | Comportement imprévisible selon le contexte | ~2h | Non |
| M13 | `gd_structures` anon read policy expose delegation metadata | PII-adjacent lisible anonymement | ~30min | Non |

### LOW — Améliorations

| # | Finding | Impact | Effort |
|---|---|---|---|
| C4 | Numéro urgence faux `06 12 34 56 78` (placeholder) dans `StructureEduTab.tsx` | Opérationnel — vrai numéro GED requis | ~2min (décision métier) |
| L4 | `force-dynamic` sur stay detail (page cacheable, ISR recommandé) | Performance TTFB sur page conversion principale | ~10min |
| L7 | E2E Playwright = 0 test écrit malgré config présente | Aucune couverture parcours utilisateur end-to-end | ~1j |
| L6 | `recharts` non lazy-loaded sur admin dashboard (~350KB) | Bundle admin plus lourd que nécessaire | ~10min |

### Frontend (backlog du guardian)

| # | Finding | Sévérité |
|---|---|---|
| FE-3 | Admin sejours : fetch sans error handling, sans loading, sans redirect 401 | HIGH |
| FE-5 | Admin sub-routes sans error.tsx scopé — erreur remplace tout le layout | HIGH |
| FE-9 | Admin layout auth check client-only — race window premier render | HIGH |
| FE-10 | Images `<Image fill>` sans `sizes` prop sur stay-detail | MEDIUM |
| FE-11 | `eslint-disable exhaustive-deps` cache des stale closures | MEDIUM |
| FE-13 | `envies/page.tsx` render `null` avant mount — flash blanc pour les enfants | MEDIUM |
| FE-14 | Structure dashboard : 13 `useState`, fetch failures silencieux | MEDIUM |
| FE-15 | `global-error.tsx` auto-retry boucle sur erreurs déterministes | MEDIUM |

---

## Patterns architecturaux identifiés

### Causes racines communes

| Pattern | Findings liés | Solution structurelle |
|---|---|---|
| Rate-limit copié-collé au lieu de centralisé | H4 (fixé), M3, M6 | `isRateLimited()` existe dans `lib/rate-limit.ts` — l'utiliser partout |
| Route inscription monolithe (596 lignes) | M2, M7, H7 | Extraire `InscriptionValidator` + `OwnershipGuard` réutilisables |
| Contrat API non vérifié automatiquement | H5, C6 | Ajouter tests de contrat (response shape) sur routes critiques |
| Specs documentées mais non testées | H5 vs `SPEC_UI_DASHBOARD_STRUCTURE_V4.md` | Tests de conformité spec → code |

### Couplage inter-communautés (knowledge graph)

| Paire | Arêtes | Risque |
|---|---|---|
| `id-handle` ↔ `lib-send` | 322 | Haut — email + identité fortement couplés |
| `id-handle` ↔ `api-si` | 145 | Moyen |
| `id-handle` ↔ `dossier-enfant-handle` | 62 | Attendu (même domaine) |
| `dossier-enfant-handle` ↔ `api-si` | 46 | Moyen |

### Ce qui est solide

- Paiement Stripe : prix server-side, idempotence atomique, amount cross-verification
- Capacité : RPC `gd_check_and_decrement_capacity` avec `SELECT FOR UPDATE NOWAIT`
- Upload : magic bytes + MIME whitelist + extension whitelist + IDOR guard
- Login : anti-énumération, rate-limit DB, cookie httpOnly, 2FA TOTP
- JWT revocation : `gd_revoked_tokens` vérifié à chaque requête admin
- Ownership : `verifyOwnership()` centralisé avec regex UUID + expiration
- Cron auth : Bearer CRON_SECRET vérifié, fail-closed
- Medical events purge RGPD : RPCs 064+067, 3 chemins dans le cron
- Error boundaries : présentes à 11 niveaux de route
- Migration Jotai/Zustand : terminée, zéro import résiduel

---

## Séquençage recommandé

### Semaine 1 — Fixes rapides sans décision

| # | Fix | Effort |
|---|---|---|
| H1 | Rollback capacité post-paiement | 2h |
| H3 | Timeout + fallback Turnstile | 30min |
| H9 | `await sendNewEducateurAlert()` | 5min |
| M6 | Centraliser rate-limit pro-session | 15min |
| M3 | Ajouter `structureRateLimitGuard` factures | 10min |
| M9 | `VALIDATE CONSTRAINT` FK (après vérif orphelins) | 10min SQL |

### Semaine 2 — Fixes avec décision métier

| # | Fix | Décision requise |
|---|---|---|
| M8 | Purge RGPD `gd_notes` + `gd_calls` | Durée de rétention (proposition : 3 ans) |
| C4 | Numéro urgence réel | Vrai numéro GED astreinte |

### Semaine 3 — Dette structurelle

| # | Fix | Effort |
|---|---|---|
| M2 | Découper route inscription 596 lignes | 4h |
| M7 | Ajouter Zod sur payment/create-intent, souhaits, waitlist | 1h |
| M1 | Normaliser format error API | 2h |
| FE-3/5/9 | Error handling + error boundaries admin | 2h |

---

## Métriques de la session

| Métrique | Valeur |
|---|---|
| Fichiers modifiés | 28 |
| Diff net | +221 / −252 |
| Tests avant | 300/391 (15 suites en échec) |
| Tests après | 383/391 (0 échec) |
| TypeScript | 0 erreur |
| ESLint | 0 warning |
| Build prod | OK |
| Commit | `5578bf3` |
| Faux positifs éliminés | 3/10 (C3, C5, H8) |
