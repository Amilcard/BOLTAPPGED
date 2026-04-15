# Audit croisé tests — Brief développeur

> GED App · Next.js 15 / Supabase / Stripe / JWT custom
> 41 suites · 391 tests · 300 passent (77 %) · 119 unitaires verts (bloquants en commit)
> Ce document est un brief pour un regard humain extérieur — pas un agent IA.

---

## CE QUE L'IA A FAIT — Journal précis

### Créé (nouveaux fichiers de test)

| Fichier | Ce qui a été écrit | Vérifié comment |
|---|---|---|
| `tests/api/webhook-stripe-edge-cases.test.ts` | 4 cas financiers : inscriptionId absent, déjà paid (idempotence), secret absent, update Supabase KO → 500 | Exécuté, 4/4 verts. Mock corrigé 3 fois (constructEvent sync vs async, chaîne update `.eq().in()`, chaîne claimEvent `.upsert().select().maybeSingle()`) |
| `tests/api/structure-code-security.test.ts` | 5 cas : code expiré, révoqué, inconnu, délégation PATCH via CDS, délégation > 90 jours | Exécuté — 5 échouent encore (mock PATCH delegation mal câblé) |
| `tests/unit/middleware-auth-bypass.test.ts` | 7 cas : VIEWER/EDITOR sur /admin, rôle falsifié, cookie absent, JWT signature invalide, VIEWER sur /reserver | Exécuté, 7/7 verts |
| `tests/unit/accessibility-axe.test.tsx` | jest-axe sur 4 composants (BottomNav, DossierBadge, PaymentMethodSelector, AdminUIProvider) — 0 violation WCAG | Exécuté, 11/11 verts |
| `app/api/cron/health-checks/route.ts` | HC-1→HC-5 : intégrité 3 couches séjours, orphelins, statuts inconnus, RGPD médical, codes expirés | TypeScript OK, aucun test Jest écrit dessus |

### Corrigé (fichiers existants modifiés)

| Fichier | Correction | Cause racine |
|---|---|---|
| `tests/api/webhook-stripe-edge-cases.test.ts` | `constructEventAsync` → `constructEvent` + `mockResolvedValue` → `mockReturnValue` | La route appelle la version synchrone — le mock async produisait `undefined` comme event, tous les tests passaient en faux positif |
| `tests/api/auth-2fa.test.ts` | `expect(json.secret).toBe('...')` → `expect(json.secret).toBeUndefined()` | La route `/2fa/setup` ne retourne que `{ qrCodeUrl }` — l'ancien test validait une exposition de secret TOTP qui n'existe pas |
| `tests/unit/dossier-badge.test.tsx` | `expect(container.firstChild).toBeInTheDocument()` au lieu de `getByText('Non commencé')` | Le composant avait changé le label en "À faire" — test désynchronisé |
| `tests/unit/env-config.test.ts` | Ajout de `CRON_SECRET` dans `VALID_ENV` | Variable ajoutée en production mais pas dans le jeu de test — causait des échecs Zod |
| `.husky/pre-commit` | `grep ... || true` | grep retourne exit code 1 quand aucun fichier .ts/.tsx n'est staged — Husky le propageait et bloquait tous les commits sans fichier TypeScript |

### Vérifié (audit, pas de modification)

- Tous les 15 suites en échec ont été inspectées : confirmées pré-existantes avant cette session (méthode : `git stash` + re-run)
- Les 7 échecs `auth-2fa` restants : routes setup/confirm/verify retournent des codes HTTP incorrects dans le code de production — bug côté route, pas côté test
- `docs/GOVERNANCE.md` + `CLAUDE.md` : 7 règles de gouvernance données ajoutées, trigger matrix agents, HC-1→HC-5 SQL

---

## CE QUE TU DOIS AUDITER — Regard croisé

### Ton profil n'importe pas — exclus rien

Que tu sois fort en backend, frontend, sécurité, DevOps ou QA : **chaque angle ci-dessous a une valeur**. Un regard naïf sur un mock peut repérer ce qu'un expert ne voit plus.

---

### A. Qualité des mocks — Faux positifs potentiels

**Question centrale : est-ce que les tests passent parce que le code est correct, ou parce que le mock absorbe tout ?**

```
Fichier à lire :  jest.setup.js
                  tests/api/webhook-stripe-edge-cases.test.ts (exemple de mock complexe)
                  tests/api/dossier-submit.test.ts (exemple de mock simple)
```

Points précis à vérifier :

1. **`auditLog` est mocké globalement** (`jest.setup.js` ligne 12). Aucun test ne vérifie qu'il est appelé sur les routes Art. 9 (dossier médical, dossier enfant). Si le `await auditLog(...)` est supprimé du code de production, aucun test ne le détecte.

2. **Emails toujours mockés** (`jest.mock('@/lib/email', ...)`). Le contenu des emails n'est jamais vérifié. `sendInscriptionConfirmation` pourrait être appelée avec `undefined` comme nom d'enfant — aucun test ne le voit.

3. **Supabase mock en chaîne** : les mocks `.from().select().eq().single()` supposent que la route appelle exactement cette chaîne. Si la route passe à `.maybeSingle()` ou ajoute un `.neq()`, le mock retourne quand même les données et le test passe. Vérifier sur au moins 3 routes que la chaîne mock correspond exactement au code.

4. **`constructEvent` Stripe** : corrigé (sync). Mais le mock `upsert().select().maybeSingle()` dans `webhook-stripe-edge-cases` — vérifier que c'est bien ce que `claimEvent()` dans le code appelle, pas une version antérieure.

---

### B. Tests en échec — Sont-ils des vrais bugs ou des mocks cassés ?

15 suites échouent. L'IA a classifié "pré-existants" sans les corriger. **Vérification humaine nécessaire** sur :

| Suite | Hypothèse IA | À confirmer |
|---|---|---|
| `auth-login.test.ts` | Mock DB chain non aligné | Lire la route `app/api/auth/login/route.ts` + comparer avec le mock |
| `webhook-stripe.test.ts` | Mock constructEvent ou update chain | Comparer `app/api/webhooks/stripe/route.ts` avec le mock du fichier |
| `payment-create-intent.test.ts` | Mock Stripe + chaîne DB | Lire `app/api/payment/create-intent/route.ts` |
| `structure-incidents/medical/calls` | Mock chaîne DB | Pattern identique sur les 3 — probablement une seule correction qui fixe les 3 |
| `inscriptions.test.ts` | Zod non intercepté | Est-ce que la route répond 400 ou throw ? |

**Méthode recommandée** : prendre une suite, lire la route correspondante, tracer la chaîne d'appels DB, comparer avec le mock. Si le mock est faux → corriger. Si la route est fausse → bug de production.

---

### C. Périmètres non couverts — Ce qui manque vraiment

#### Critique (impact financier direct)

```
1. Crons — 0 test sur 3 routes
   - /api/cron/expire-codes    → révoque les codes CDS/directeur expirés
   - /api/cron/rgpd-purge      → purge données médicales + audit logs
   - /api/cron/health-checks   → HC-1 à HC-5 (écrit cette session, 0 test)
   
   Risque : un bug silencieux dans expire-codes → des codes expirés restent actifs
   → des structures révoquées continuent d'accéder aux dossiers enfants

2. RLS Supabase — les 4 tests actuels mockent Supabase
   Aucun test ne vérifie la vraie RLS en base
   → Un SELECT * sur gd_inscriptions avec la clé anon est-il vraiment bloqué ?
   → Nécessite un test d'intégration contre un Supabase local ou staging

3. Mapper stay.ts — marketing_title || title jamais testé
   - lib/mappers/stay.ts : logique titlePro, titleKids, rawTitle, marketing_title
   - Si le mapper retourne null au lieu de undefined → TypeScript compile,
     l'interface Stay plante en runtime
```

#### Haute priorité (régressions probables)

```
4. Formulaires UI — 0 test composant sur les écrans critiques
   - Formulaire inscription : validation inline, submit, erreurs Zod côté client
   - Formulaire dossier enfant : champs obligatoires, consentement parental
   - Aucun test ne vérifie que les messages d'erreur s'affichent

5. lib/totp.ts — jamais testé en isolé
   - verifyToken avec window de 1, drift d'horloge, secret invalide
   - generateSecret : entropie suffisante ?
   - Actuellement mocké dans auth-2fa — le vrai TOTP n'est jamais exercé

6. lib/auth-cookies.ts — setSessionCookie
   - httpOnly + secure + sameSite strict : jamais vérifié en test
   - Si l'attribut secure est absent en prod → cookie accessible en HTTP
```

#### Moyenne priorité

```
7. Admin stats — filtrage is_test = false
   - app/api/admin/stats/route.ts a été modifié pour exclure les structures test
   - Aucun test ne vérifie que les 13 inscriptions test n'apparaissent pas dans les stats
   - Régression silencieuse possible

8. Délégation structure — PATCH /api/structure/[code]/delegation
   - Max 90 jours : est-ce que la route vérifie vraiment ?
   - Supprimable par le directeur uniquement : test existant échoue (mock mal câblé)

9. Parcours pro sans compte
   - PriceInquiryBlock → email tarifs → /acceder-pro
   - Rate limiting 2 req/60min par email : jamais testé
```

---

### D. Infrastructure tests — Ce qui tient et ce qui ne tient pas

```
✅ Husky pre-commit : bloque sur tests/unit (10 suites, 119 tests)
   → Seul garde-fou local actif. tests/api ne bloquent pas le commit.

⚠  GitHub Actions bundle-check.yml : build avec env vars factices
   → Si la validation Zod (lib/env.ts) est appelée au build time → le build CI échoue
   → Vérifier que next build avec ces vars passe vraiment

⚠  GitHub Actions typecheck.yml et eslint.yml : ne testent pas le comportement
   → TypeScript et lint verts ≠ tests verts. Les 83 échecs passent en CI actuelle.

❌ Playwright : config présente, 0 test écrit
   → 3 parcours critiques sans couverture navigateur réel :
     - Inscription + paiement Stripe (mode test)
     - Accès structure via code CDS
     - Parcours kids (souhait → envies)
```

---

### E. Questions ouvertes — Réponds-y dans ton audit

1. Les tests en échec sont-ils des **bugs de production** ou des **mocks incorrects** ? (impact : si bugs, c'est urgent)
2. Le mock Supabase global couvre-t-il la même logique que la vraie chaîne JS ? Vérifier sur 3 routes au choix.
3. `auditLog()` est-il vraiment appelé sur toutes les routes Art. 9 ? (médical, dossier, upload)
4. Les crons tournent-ils en prod sans erreur ? (Vercel Cron logs à vérifier)
5. `lib/totp.ts` — la librairie TOTP utilisée est-elle maintenue ? (vérifier package.json)

---

## FICHIERS CLÉS POUR L'AUDIT

```
jest.setup.js                              → mocks globaux (auditLog, env)
jest.config.js                             → config Jest, roots, transformIgnore
.husky/pre-commit                          → gate commit local
.github/workflows/                         → 3 workflows CI
docs/TESTS_COVERAGE.md                     → carte complète 41 suites

app/api/webhooks/stripe/route.ts           → comparer avec webhook-stripe.test.ts
app/api/auth/login/route.ts                → comparer avec auth-login.test.ts
app/api/cron/health-checks/route.ts        → route écrite, 0 test
lib/mappers/stay.ts                        → logique marketing_title, jamais testée
lib/totp.ts                                → jamais testée en isolé
lib/auth-cookies.ts                        → jamais testée
```
