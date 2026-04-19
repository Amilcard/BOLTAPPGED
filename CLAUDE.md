# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## ⛔ RÈGLE #0 — LECTURE OBLIGATOIRE ET ACTIONNABLE AVANT CHAQUE TÂCHE

**NE FAIS AUCUN CHANGEMENT TANT QUE TU N'ES PAS À 95 % DE CONFIANCE.**
**POSE-MOI DES QUESTIONS DE SUIVI À CET EFFET.**

Cette règle **prime sur toutes les autres** règles de ce document. Elle s'applique à toute tâche — fix, feature, refacto, migration, audit, génération doc, création DB, commit, push.

### Protocole obligatoire en début de tâche

Avant toute écriture de code, de fichier, de migration, ou commande modifiant quoi que ce soit :

1. **Auto-évalue ta confiance** sur une échelle 0-100 % :
   - Ai-je tous les éléments pour agir ?
   - Ai-je compris l'intent métier, pas juste la demande littérale ?
   - Les contraintes (sécurité, RGPD, backward-compat) sont-elles claires ?
   - Le blast radius est-il connu et acceptable ?
   - Suis-je capable de justifier chaque ligne que je vais écrire ?
   - Y a-t-il des ambigüités ou des hypothèses non validées ?

2. **Si confiance < 95 %** → STOP. Pose des questions de clarification. N'invente pas. Ne comble pas les vides par hypothèse. N'écris pas de code "pour voir".

3. **Si confiance ≥ 95 %** → annonce ton plan en 3-5 lignes avant d'agir, et exécute.

### Formats de questions à privilégier

- Questions fermées (oui/non ou A/B/C) plutôt qu'ouvertes
- Regrouper 2-5 questions en un seul message, jamais à la chaîne
- Donner le **coût** de chaque option (temps, risque, réversibilité)
- Proposer un défaut quand c'est sensé

### Ce qui compte comme "pas 95 %"

- Ambigüité sur le périmètre ("corrige ce bug" → quel bug exactement ?)
- Intent métier non explicite ("fais propre" → quel critère de "propre" ?)
- Choix technique avec plusieurs options viables aux conséquences différentes
- Données/IDs/paths/credentials manquants pour exécuter
- Pas d'accès à la bonne documentation ou au bon contexte
- Tests échouants dont la cause racine n'est pas ouverte et lue
- Changement qui touche auth, paiement, RGPD, données mineurs, prod

### Anti-patterns interdits

- ❌ "Je vais essayer et si ça casse on reverra" → non, poser la question avant
- ❌ "Par défaut je suppose que…" → non, demander explicitement
- ❌ Écrire du code "placeholder" pour avancer → non, clarifier le vrai besoin
- ❌ Conclusion de triage sans avoir ouvert les traces/logs individuels
- ❌ Merge ou push sans validation cross-review quand le déclencheur CLAUDE.md s'applique

### Corollaire

Le coût d'une question qui perd 2 minutes est toujours inférieur au coût d'un changement inapproprié qui demande un revert, un rollback Vercel, ou pire un incident RGPD. **Préfère toujours demander.**

---

## ⛔ RÈGLE #0 bis — ÉVALUATION MCP OBLIGATOIRE AU DÉMARRAGE DE CHAQUE TÂCHE

**À chaque nouvelle tâche, évalue quels serveurs MCP / plugins sont réellement utiles. Désactive (ou ignore) ceux qui ne servent pas.**

### Pourquoi

Chaque serveur MCP connecté charge sa liste d'outils dans le contexte = tokens consommés en pure perte si non utilisé. Sur GED_APP, les MCPs disponibles incluent : Airtable, Canva, Gamma, Gmail, Google Calendar, Netlify, Stripe, Supabase, data-gouv-fr, fetch, flooow-filesystem, ged-filesystem, git, Vercel plugin. **Rarement plus de 2-3 sont pertinents pour une tâche donnée.**

### Protocole obligatoire au début de chaque tâche

1. **Liste mentale** : quels MCPs sont loadés en contexte ?
2. **Intersecte avec le besoin réel** : pour CETTE tâche, quels outils MCP sont utiles ? (souvent : `git`, parfois `ged-filesystem` ou `Supabase`, rarement plus)
3. **Annonce explicitement** dans ta réponse d'ouverture : "MCP utiles pour cette tâche : X, Y. Je n'utiliserai pas les autres."
4. **Si un MCP inutilisé pèse lourd** (Airtable, Canva, Gamma souvent), **recommande à l'utilisateur de le désactiver** dans `.mcp.json` ou les settings pour la durée de la session.

### Tableau de pertinence MCP par type de tâche (GED_APP)

| Type de tâche | MCPs utiles | MCPs à désactiver |
|---|---|---|
| Fix de bug code | `git`, `ged-filesystem` | tous les autres |
| Migration Supabase / RLS | `Supabase` MCP, `git` | tous les autres |
| Audit sécurité / triage tests | `git`, `ged-filesystem` | tous les autres |
| Déploiement Vercel / config | Vercel plugin, `git` | tous les autres |
| Lead / CRM / prospect | Airtable, Gmail | tous les autres |
| Génération doc / brief | aucun MCP nécessaire | tous |
| Création UI / design | aucun MCP nécessaire (Read/Edit natifs suffisent) | tous |

### Anti-patterns interdits

- ❌ Charger tous les MCPs au démarrage "au cas où"
- ❌ Invoquer un MCP quand Read/Edit/Bash natifs suffisent
- ❌ Utiliser `ged-filesystem` pour une opération que Read/Write font déjà
- ❌ Passer par Airtable MCP pour une lecture de fichier local

### Exception

Les MCPs système (git, filesystem du repo courant) peuvent rester actifs par défaut — ils sont utilisés sur presque toutes les tâches.

---

## Project Overview

**Groupe & Découverte (GED)** is an educational stay management platform for children aged 3-17. It connects social workers (professionals) with families and children to organize educational vacations during school holidays.

### Key Architecture

- **Framework**: Next.js 15 + React 19 with App Router (server components)
- **Database**: PostgreSQL via Supabase (direct JS client, no ORM)
- **Authentication**: Custom JWT-based auth (not NextAuth) with role-based access
- **Styling**: Tailwind CSS with Radix UI primitives

### Dual Mode Interface

The application serves two distinct audiences:
- **Kids mode** (`mode === 'kids'`): Simplified interface for children/parents (public access)
- **Pro mode** (`mode === 'pro'`): Professional interface for social workers (requires authentication)

## Development Commands

```bash
# Install dependencies (required: legacy peer deps)
npm install --legacy-peer-deps

# Development server
npm run dev

# Build for production
npm run build

# Run production server
npm start

# Linting
npm run lint

# Database: Supabase (PostgreSQL) — schema managed via sql/*.sql migrations
# Execute migrations manually in Supabase SQL Editor
```

## Supabase
- Project ID : voir .env.local (ne pas committer)
- URL : voir NEXT_PUBLIC_SUPABASE_URL dans .env.local
- Dashboard : https://supabase.com/dashboard (projet GED)
- Client : JS direct, no ORM, no Prisma

## Tables critiques (Supabase)
- gd_souhaits (choix_mode, statut, enfant_id, session_id)
- gd_inscriptions (statut, souhait_id, dossier_id)
- gd_stay_sessions (session_id, stay_id, capacity)
- gd_dossier_enfant, gd_structures, gd_stays
- gd_stay_themes, gd_session_prices, gd_waitlist
- gd_login_attempts — rate limiting IP (login + structure + délégation + price-inquiry)
- gd_incidents — incidents séjour (5 catégories, 3 gravités, statut ouvert/en_cours/resolu)
- gd_medical_events — événements médicaux Art. 9 RGPD (table séparée, purge 3 mois)
- gd_calls — appels significatifs (5 types, sens, interlocuteur, accord parents)
- gd_notes — notes par enfant (non éditables, traçabilité RGPD)
- Vues : v_activity_with_sessions, v_orphaned_records

## Cookie `gd_pro_session` — 2 formes coexistantes

Deux routes émettent ce cookie :

1. **`POST /api/auth/structure-login`** (email + password, TTL 8h) — payload complet : `{role, type, email, structureCode, structureRole, structureId, structureName, jti}`
2. **`POST /api/auth/pro-session`** (email + code structure, TTL 30min) — idem post-2026-04. Tokens émis avant peuvent ne pas inclure `structureRole`/`structureId` ; le fallback de `verifyProSession` les résout depuis `structureCode` via `resolveCodeToStructure()`.

**Règle** : toute modification de `ProSessionPayload` doit rester compatible avec les 2 flux + fallback legacy. Ne jamais ajouter un champ obligatoire sans backfill simultané dans les 2 routes.

**Révocation** : `gd_revoked_tokens` lu par `verifyProSession`. Route `/api/structure/[code]/team/[memberId]/revoke` désactive la ligne ; révocation immédiate du JWT actif = dette post-MVP (item #3 plan architecte 2026-04-17).

## Rôles structure — matrice d'accès routes

| Route | direction | cds | cds_delegated | secretariat | educateur |
|---|---|---|---|---|---|
| `GET /team` | ✓ | ✗ | ✓ | ✗ | ✗ |
| `POST /invite` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `POST /team/[id]/revoke` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `POST /team/[id]/reinvite` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `PATCH /delegation` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `PATCH /settings` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `PATCH /inscriptions/[id]/dossier` | ✓ | ✓ | ✓ | ✓ | ✗ |
| `GET  /inscriptions/[id]/dossier` | ✓ | ✓ | ✓ | ✓ | ✗ |
| `POST /inscriptions/[id]/submit` | ✓ | ✓ | ✓ | ✓ | ✗ |
| `POST /inscriptions/[id]/upload` (multipart) | ✓ | ✓ | ✓ | ✓ | ✗ |
| `DELETE /inscriptions/[id]/upload` | ✓ | ✓ | ✓ | ✓ | ✗ |
| `GET  /inscriptions/[id]/pdf?type=` | ✓ | ✓ | ✓ | ✓ | ✗ |
| `POST /inscriptions/[id]/pdf-email` | ✓ | ✓ | ✓ | ✓ | ✗ |

Routes staff `inscriptions/[id]/*` (ajoutées 2026-04-19, décision produit option 2) :
staff structure = mandataire légitime de l'éducateur absent. Peut remplir, compléter,
télécharger PDF, uploader PJ, envoyer le dossier à la GED. Le référent reçoit les
emails de confirmation avec BCC du staff qui a agi (preuve d'envoi + traçabilité).
Éducateur exclu — il utilise `/suivi/[token]` via suivi_token natif.

Scope = `requireInscriptionInStructure` (structure_id only, pas de scope referent_email)
car tout le staff voit toute la structure. RGPD Art. 9 auditLog obligatoire avec
metadata `actor_role` + `context: staff_<action>_dossier|doc|pdf`.

**`cds_delegated` accès write ops** : exclu sur routes `/team`, `/invite`, `/delegation`, `/settings` (risque récursion délégation + verrou regex 10-chars — un CDS délégué a un code personnel, pas un code 10-chars). Analyse 2026-04-17.

**INCLUS** sur routes dossier enfant (`/inscriptions/[id]/*`) depuis 2026-04-19 : use case dépannage légitime quand CDS + direction + secrétariat absents simultanément. Scope structure via `requireInscriptionInStructure` (pas de récursion possible sur ces actions).

## Règle OBLIGATOIRE — Consultation multi-agents avant intervention

**Cette règle DOIT être appliquée avant tout fix / refacto / feature touchant plus qu'un commentaire ou une ligne cosmétique.** Elle existe pour éviter les erreurs d'analyse en surface et les effets cascade non détectés (caller non identifié, enum rate un call-site, rate-limit dual rend un parcours unusable, etc.).

### Déclencheurs — protocole obligatoire

- Signalement externe : Codacy, Sentry, Vercel logs, CI rouge, PR review
- Demande fix sécurité / régression / RGPD
- Modification touchant >1 fichier OU zone critique : `auth`, DB, `factures`, `inscriptions`, `dossier_enfant`, `souhaits`, `gd_structure_access_codes`
- Toute dette architecte / migration SQL / refacto transversal
- Toute nouvelle route API ou endpoint sensible

### Protocole obligatoire (ordre)

| Étape | Agent/Skill | Déclenche si |
|---|---|---|
| 1. **Analyse impact** | `arch-impact-reviewer` | TOUJOURS pour les déclencheurs ci-dessus |
| 2. **Vérif DB** | `supabase-integrity-auditor` + MCP Supabase | migration, RLS, schéma, advisors |
| 3. **Sécurité / RGPD** | skill `security-review` + agent `functional-bug-hunter` | auth, credentials, PII, données mineurs |
| 4. **UI** | agent `ux-ui-reviewer` | nouvel écran, modal, parcours |
| 5. **Workflow / intégration** | `workflow-integration-reviewer` | webhook, email, n8n, multi-system |
| 6. **Exécution** | worker `general-purpose` + skill `test-driven-development` | TDD strict, commits atomiques |
| 7. **Cross-review final** | `arch-impact-reviewer` + `deploy-safety-reviewer` | avant chaque push prod |

### Parallélisation

Utiliser la skill `dispatching-parallel-agents` dès que 2+ analyses ou workers sont indépendants. Les agents doivent être briefés de façon auto-suffisante (ils n'héritent pas du contexte de la session).

### Interdictions

- JAMAIS de fix inline directement sans passer par `arch-impact-reviewer` si le déclencheur est coché, **sauf** :
  - 1 seule ligne cosmétique (typo, commentaire) documentée dans le commit
  - Réversion de régression déjà identifiée par un agent précédent
- JAMAIS accepter un plan d'agent sans double-verification : l'architecte liste les risques ET un second agent valide (supabase-integrity-auditor, functional-bug-hunter, etc. selon domaine)
- JAMAIS push sans `npx tsc --noEmit` + suite Jest verte (hors pré-existants documentés)
- JAMAIS réutiliser un résumé de session précédente comme vérité — toujours vérifier par git log / MCP / grep direct

### Objectif

Mobiliser des angles d'analyse différents (architecture, DB, runtime, UX, sécurité) avant d'écrire du code. Les workers exécutent, les reviewers valident. Personne n'est son propre juge.

### Application concrète — check rapide avant toute action

```
[ ] Déclencheur coché ? → protocole obligatoire
[ ] arch-impact-reviewer lancé pour l'analyse ?
[ ] Workers briefés self-contained avec diffs AVANT/APRÈS exacts ?
[ ] tsc + jest verts avant commit ?
[ ] Cross-review final lancé avant push prod ?
[ ] Rollback SHA noté avant multi-fichier ?
```

## Règle ABSOLUE — Prelude anti-pièges OBLIGATOIRE sur chaque tâche

**Chaque tâche, chaque agent, chaque intervention DOIT commencer par ce prelude.** Zéro exception. Cette règle existe car des audits scopés ont laissé passer 6 P1 en prod (audit 2026-04-18 : educator-invite auth bypass, medical Art.9 sans scope educateur, proposition email avant update, factures sans auditLog, pdf-email timeout silencieux, signature DoS).

### Prelude obligatoire — 7 checks AVANT toute écriture de code

```
[1] CONSULTATION DOC : lire CLAUDE.md § concerné + docs/*.md référencés + route voisine existante
[2] GREP TRANSVERSAL : chercher le pattern sur TOUTE l'app, pas le scope feature
    → `grep -rn "require(Editor|Admin|Auth)" app/api | grep -v "await require"`
    → `grep -rn "supabase.*\.(update|insert|delete)" | vérifier auditLog dans ±10 lignes`
    → `grep -rn "req.json()" | vérifier validator sizé dans ±5 lignes`
[3] RESOURCE OWNERSHIP : si la route mute une ressource scopée (educateur, CDS), vérifier filtre `referent_email` / owner_id — pas juste role-auth
[4] ORDRE SIDE-EFFECTS : UPDATE-avant-email ? auditLog avant return ? try/catch sur await ?
[5] SIZE CAPS : tout req.json() > 100KB potentiel → validator explicite (base64 img, upload, signature)
[6] COUVERTURE auditLog : table PII mutée → grep auditLog dans la route. Table hors liste connue (factures, stay_sessions, etc.) = suspect.
[7] RUNTIME FAILURES : timeout fetch interne ? DoS payload ? race retry ? → tests d'intégration requis si oui
```

### Briefing obligatoire des agents

**Tout dispatch d'agent (Task/Agent tool) DOIT contenir dans le prompt :**

```
AVANT TOUTE MODIFICATION, exécute le prelude CLAUDE.md § "Prelude anti-pièges" :
1. Lis CLAUDE.md sections concernées
2. Grep transversal sur l'app entière (pas le scope feature)
3. Vérifie resource-ownership si mutation scopée
4. Vérifie ordre UPDATE/side-effect
5. Vérifie size caps sur req.json()
6. Vérifie auditLog couverture
7. Identifie runtime failures (timeout, DoS, race)

Rapporte findings AVANT d'écrire du code.
```

### Patterns à imposer dans le code (réponse structurelle aux pièges)

| Piège | Pattern obligatoire | Fichier |
|---|---|---|
| Role-auth ≠ resource-ownership | `requireResourceOwnership({resolved, resource, ownerField})` | `lib/resource-guard.ts` (à créer) |
| await manquant sur requireEditor/Admin | ESLint rule `require-await-auth` + grep pre-commit | `.eslintrc` + `scripts/security-sweep.sh` |
| Mutation sans auditLog | Matrice couverture versionnée + grep CI | `docs/audit-coverage.md` |
| req.json() sans cap | `validateBase64Image({max})` / `validateUploadSize({max})` | `lib/validators.ts` |
| Email avant UPDATE | Règle : UPDATE DB → side-effect (email/PDF/webhook) → auditLog | Review workflow-integration-reviewer systématique |
| Fetch interne timeout | Merger route interne + route externe OU job async | Architecture decision record |

### Tables PII — liste à jour OBLIGATOIRE (2026-04-18)

Toute mutation sur ces tables DOIT appeler `auditLog()` :
`gd_inscriptions`, `gd_dossier_enfant`, `gd_propositions_tarifaires`, `gd_factures`, `gd_suivi_incidents`, `gd_suivi_medical`, `gd_suivi_calls`, `gd_suivi_notes`, `gd_structure_access_codes`, `gd_educateur_emails`, `gd_stay_sessions` (si affecte dossier), `gd_souhaits`.

**Ajout d'une nouvelle table PII** = ligne ajoutée ici dans la même PR, sinon merge bloqué.

### Couverture workflow — reviewer systématique

`workflow-integration-reviewer` obligatoire sur :
- Tout flow email + update DB (proposition, facture, invitation, relance)
- Tout cron + side-effect externe (purge, relance)
- Tout upload + génération dérivée (signature, PDF, exports)

### Specs métier tardives — règle

Si l'utilisateur articule un intent nouveau en cours de session (ex. "secrétariat remplit dossier") :
- OU la route correspondante est créée dans la même session
- OU documentée dans `docs/BACKLOG_ROUTES_MANQUANTES.md` avec owner + deadline + scope auth

**Jamais** laisser un intent métier formulé mourir sans trace.

### Post-mortem vague — obligatoire

Après chaque vague terminée : 10 min pour lister ce que la vague n'a PAS couvert → `docs/BACKLOG_AUDIT.md` avec priorité. Règle : jamais 2 vagues consécutives sans traiter 1 item du backlog.

## Danger zones — INTERDICTIONS ABSOLUES
- JAMAIS de DELETE FROM sans WHERE explicite validé
- JAMAIS de TRUNCATE sur aucune table
- JAMAIS de UPDATE sans WHERE
- Données ASE = enfants protégés — toute modification en masse interdite
- Supabase project ID actif : voir .env.local — jamais committer l'ID en clair

## Règles de gouvernance données — OBLIGATOIRES

### RÈGLE 1 — Jamais de création directe de séjour
Un séjour dans `gd_stays` ne se crée JAMAIS par INSERT direct. Pipeline obligatoire :
1. Le séjour existe sur UFOVAL avec une URL
2. Le workflow n8n le scrape et crée la fiche
3. On ajoute `marketing_title`, `title_pro`, `title_kids`, `location_region`
4. `published = true` SEULEMENT quand tout est rempli

Le trigger `trg_check_stay_publish` bloque toute publication si `source_url`, `marketing_title` ou `location_region` est manquant.
Un index unique sur `source_url` (séjours publiés) empêche les doublons.

### RÈGLE 2 — Noms GED ≠ Slugs UFOVAL
- **Slug UFOVAL** = identifiant technique, FK partout → NE JAMAIS MODIFIER
- **Nom GED** = `marketing_title` → affiché aux éducateurs et dans les emails

Si un agent a besoin de créer un "nouveau séjour" GED, vérifier d'abord :
```sql
SELECT slug, marketing_title, source_url FROM gd_stays WHERE published = true ORDER BY slug;
```

### RÈGLE 3 — Données test vs production
`gd_structures.is_test` distingue les structures test des réelles.
- Toute structure créée pour des tests doit avoir `is_test = true`
- `v_inscriptions_production` filtre automatiquement les inscriptions test (`is_test = false AND deleted_at IS NULL`)
- Stats, exports et dashboards → utiliser cette vue, pas `gd_inscriptions` directement
- Les routes admin utilisent `gd_structures!inner(is_test)` + `.eq('gd_structures.is_test', false)` pour exclure les tests

### RÈGLE 4 — Suppression de sessions interdite sans trace
Le trigger `trg_log_session_delete` enregistre toute suppression dans `gd_session_deletion_log`.
Aucun DELETE sur `gd_stay_sessions` ne passe silencieusement.
```sql
SELECT * FROM gd_session_deletion_log ORDER BY deleted_at DESC LIMIT 20;
```

### RÈGLE 5 — Cohérence des 3 couches obligatoire
Un séjour publiable doit avoir ses 3 couches complètes :
- `gd_stays` — fiche avec `source_url`, `marketing_title`, `location_region`
- `gd_stay_sessions` — au moins 1 session avec dates
- `gd_session_prices` — prix par ville pour chaque session

Un séjour publié avec 0 session → invisible pour les éducateurs (alerte à traiter).
```sql
SELECT s.slug, s.marketing_title,
  (SELECT COUNT(*) FROM gd_stay_sessions ss WHERE ss.stay_slug = s.slug) as sessions,
  (SELECT COUNT(*) FROM gd_session_prices sp WHERE sp.stay_slug = s.slug) as prix
FROM gd_stays s WHERE s.published = true ORDER BY sessions ASC;
```

### RÈGLE 6 — Workflows n8n : rôles séparés, pas de substitution IA

| Workflow | Rôle | Fréquence |
|---|---|---|
| PHASE3 Sessions & Prix Sync | Crée les sessions depuis UFOVAL | Manuel |
| 01 UFOVAL is_full SESSIONS v4 | Met à jour is_full | Toutes les 6h |
| VERIFICATION COMPLETUDE | Audit complet + export | Manuel |

Un agent IA ne doit JAMAIS remplacer ce que fait un workflow n8n. Si des sessions manquent → relancer le workflow, pas créer à la main (sauf urgence documentée).

### RÈGLE 7 — Propositions tarifaires : structure réelle obligatoire
Avant d'insérer dans `gd_propositions_tarifaires` :
- Vérifier que la structure a `is_test = false`
- Vérifier que `sejour_slug` pointe vers un séjour publié avec sessions
- Renseigner `session_start` et `session_end` correspondant à une session existante

## Database & Models

### Tables principales (Supabase)
- gd_stays — séjours éducatifs (slug unique, published, period, sourceUrl)
- gd_stay_sessions — sessions par séjour (dates, capacité, seat tracking)
- gd_session_prices — tarifs par session (priceFrom, promo)
- gd_inscriptions — inscriptions professionnels (statut, souhait_id, dossier_id)
- gd_souhaits — souhaits kids (choix_mode, statut, enfant_id, session_id)
- gd_dossier_enfant — dossiers enfants ASE
- gd_structures — structures partenaires (ASE, MECS, foyers)
  - code (6 chars, CDS) + code_directeur (10 chars) + expiration + révocation
  - delegation_active_from / delegation_active_until (TIMESTAMPTZ) — migration 040
  - rgpd_accepted_at + rgpd_accepted_by
- gd_waitlist, gd_wishes, gd_admin_2fa, gd_audit_log
- smart_form_submissions — leads price-inquiry + request-access (fail-silently)

### Champs importants gd_stays
- Ingestion : sourceUrl, sourcePdfPath, importedAt, lastSyncAt, sourceManual
- UFOVAL : contentKids (JSON), departureCity, educationalOption
- Pricing : priceFrom (base), complété par prix UFOVAL sessions
- Metadata : themes (JSON array), programme (JSON array)

### Patterns clés
- JSON fields : caster via `as string[]`
- Slug : unique en DB, URLs publiques
- Sessions à venir : filter `startDate: { gte: new Date() }`
- Cascade : gd_stay_sessions supprimées si gd_stays supprimé

## API Architecture

### Route Structure by Access Level

**Public (no auth):**
- `/api/stays` - Stay listings (prices **excluded**)
- `/api/stays/[slug]` - Individual stay details (prices excluded)
- `/api/auth/login` - JWT token generation

**Professional (JWT auth required):**
- `/api/pro/stays` - Stay listings **with** pricing
- `/api/pro/stays/[slug]` - Individual stay with pricing
- `/api/bookings` - Booking CRUD

**Pro sans compte (public, rate-limited):**
- `POST /api/pro/price-inquiry` - Demande de tarifs (prénom + structure + email) → email immédiat
- `POST /api/pro/request-access` - Demande accès professionnel → email confirmation + alerte GED

**Structure (code-based, no JWT):**
- `GET /api/structure/[code]` - Dashboard structure (CDS 6 chars ou Directeur 10 chars)
- `POST /api/structure/[code]` - Accepter engagement RGPD
- `PATCH /api/structure/[code]/delegation` - Directeur uniquement : définir/supprimer délégation CDS
- `PATCH /api/structure/[code]/settings` - Directeur uniquement : modifier email contact
- `GET/POST /api/structure/[code]/incidents` - Incidents séjour (direction/CDS écrivent, éducateur lit)
- `GET/POST /api/structure/[code]/medical` - Événements médicaux Art. 9 (éducateur = compteur seul)
- `GET/POST /api/structure/[code]/calls` - Appels significatifs (direction/CDS écrivent, éducateur lit)
- `GET/POST /api/structure/[code]/notes` - Notes par enfant (direction/CDS écrivent, non éditables)

**Admin (JWT + role check):**
- `/api/admin/stays` - Full CRUD operations
- `/api/admin/sessions` - Session management
- `/api/admin/bookings` - Booking oversight
- `/api/admin/users` - User management
- `/api/admin/stats` - Analytics
- `GET /api/admin/structures/[id]/audit-log` - Audit accès codes structure

**Cron (CRON_SECRET Bearer):**
- `GET /api/cron/expire-codes` - Révocation codes CDS + Directeur expirés (0 2 * * *)
- `GET /api/cron/rgpd-purge` - Purge données RGPD (0 3 1 * *)

**UFOVAL Enrichment:**
- `/api/ufoval-enrichment` - Returns merged UFOVAL data from `out/ufoval/ufoval_enrichment_full.json`

### Authentication Pattern

```typescript
import { verifyAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  const auth = verifyAuth(request);
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentification requise' } },
      { status: 401 }
    );
  }
  // ... protected logic
}
```

### Security Rules

- **Price visibility**: Prices are **never** included in public API responses
- **JWT storage**: Client stores token in `localStorage`
- **Role-based UI**: Admin-only menu items hidden based on user role

## UFOVAL Integration

UFOVAL is an external provider for educational stay data. The integration follows this pipeline:

### Data Pipeline

1. **Extract sessions** (`scripts/ufoval/extract-sessions.ts`):
   - Input: `out/ufoval/rewrite_ready_for_supabase.json`
   - Output: `out/ufoval/ufoval_sessions.json`
   - Extracts dates, prices (base + promo), duration from HTML

2. **Extract departures** (`scripts/ufoval/extract-departures-and-prices.ts`):
   - Input: `out/ufoval/rewrite_ready_for_supabase.json`
   - Output: `out/ufoval/ufoval_departures_prices.json`
   - Extracts departure cities and transport supplements

3. **Merge** (`scripts/ufoval/merge-departures-and-sessions.js`):
   - Combines sessions + departures
   - Output: `out/ufoval/ufoval_enrichment_full.json`
   - **SAFE**: No DB write, JSON output only

4. **API endpoint** (`app/api/ufoval-enrichment/route.ts`):
   - Serves merged JSON to frontend
   - Frontend matches by `sourceUrl`

### Frontend Integration (Pro mode)

In `app/sejour/[id]/stay-detail.tsx`:
- Fetches enrichment data on mount (Pro mode only)
- Displays session prices with promo discounts
- Shows departure cities with transport supplements
- Calculates minimum session price for display

**Price display logic:**
1. Try UFOVAL session prices (prefer `promo_price_eur`, fallback to `base_price_eur`)
2. Fallback to `stay.priceFrom` from database
3. If both missing, show "Tarif communiqué aux professionnels"

## Intégrations

### Resend (emails transactionnels)
- Domaine vérifié : groupeetdecouverte.fr
- FROM : noreply@groupeetdecouverte.fr
- Fichiers clés : lib/email.ts, routes notify-waitlist, pdf-email
- Fonctions email disponibles :
  - `sendPriceInquiryToEducateur()` — tarifs pro par email (sans compte)
  - `sendPriceInquiryAlertGED()` — alerte interne nouvelle demande tarifs
  - `sendProAccessConfirmation()` — confirmation demande accès pro (/acceder-pro)
  - `sendProAccessAlertGED()` — alerte interne nouvelle demande accès pro

### Stripe (paiement)
- Modes : carte, virement, chèque
- Fichiers clés : webhook, payment/create-intent, inscriptions
- Vars : voir .env.example

### URLs
- App prod : app.groupeetdecouverte.fr
- Site vitrine : www.groupeetdecouverte.fr (Hostinger)
- Vercel project : boltappged (compte gedapp)

### Sécurité — points de vigilance
- Auth middleware : risque bypass — maintenir verrouillé
- Routes admin : risque mass-assignment — toujours vérifier
- RLS Supabase : gd_inscriptions, gd_wishes, smart_form_submissions, notification_queue, payment_status_logs — sensibles
- RGPD : données enfants ASE — protection maximale
- Secrets : jamais de fallback hardcodé en prod

## Charte graphique — OBLIGATOIRE

**Avant toute modification UI/UX, consulter `docs/CHARTE_GRAPHIQUE.md`.**

Regles cles (le doc complet fait reference) :
- **Secondary (#de7356 terracotta) = CTA/boutons d'action** — primary (#2a383f) = titres/texte seulement
- **Composants shadcn obligatoires** : `<Button>`, `<Input>`, `<Select>`, `<Badge>`, `<Tabs>`, `<Skeleton>` — zero inline
- **Zero hex hardcode** hors palette — tout passe par les tokens Tailwind
- **Cartes** : `rounded-brand` + `shadow-card` — pas de `rounded-xl` ou `shadow` generique
- **Focus ring unique** : `ring-secondary` (terracotta) partout
- **Accessibilite** : `role="alert"` sur erreurs, labels sur inputs, tap targets 44px, `aria-hidden` sur decoratif
- **Typo back-office** : echelle reduite (text-2xl max) — pas les tailles vitrine (text-5xl)
- **Checklist avant merge** : voir section 15 du doc

## Important Conventions

### File Organization

```
app/
├── api/              # API routes (grouped by domain: admin/pro/public/cron/structure)
├── admin/            # Admin dashboard pages
├── acceder-pro/      # Formulaire demande accès pro (sans compte JWT)
├── espace-pro/       # Professional interface
├── envies/           # Wishlist (kids mode)
├── login/            # Login contextuel : ?context=pro → "Espace professionnel"
├── sejour/[id]/      # Stay detail pages (public + pro + PriceInquiryBlock)
└── structure/[code]/ # Dashboard structure (CDS/Directeur, code-based, no JWT)
```

### TypeScript Patterns

- **Type casting for JSON fields**: `stay.programme as string[]`
- **Optional fields**: `(stay as any).departureCity || null`
- **Date handling**: `.toISOString()` for API responses

### Component Patterns

- **Server components** by default (App Router)
- **'use client'** only when needed (interactivity, hooks)
- **Radix UI** for accessible primitives
- **Lucide React** for icons

## State Management

- ~~Jotai~~ : supprimé (10 avril 2026, zéro import)
- ~~Zustand~~ : supprimé (10 avril 2026, zéro import)
- **Local storage**: Wishlist persistence, JWT token

## Common Gotchas

1. **Price exclusion**: Always check if endpoint is public before including `priceFrom`
2. **Session dates**: Use `startDate: { gte: new Date() }` for upcoming sessions only
3. **Slug uniqueness**: `slug` is unique in DB, used for public URLs
4. **UFOVAL URL matching**: Normalize trailing slashes when matching `sourceUrl`
5. **Image optimization**: Next.js `<Image>` requires absolute URLs or configured domains

## Testing Data

**Test Accounts:**
- Admin: `admin@gd.fr` / `Admin123!`
- Pro: `pro@gd.fr` / `Pro123!`

## Environment Variables
Voir `.env.example` pour la liste complète.
Variables requises : Supabase (3), NextAuth (2), Stripe (3), Resend (2), Build (1).
Ne jamais committer .env.local ni les vraies clés.

## Troubleshooting

**Dependencies fail to install:**
```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

## Règles de travail

**Branche unique : `main`** — Vercel déploie automatiquement depuis `main`. Ne pas créer de branches, ne pas ouvrir de PR sauf cas exceptionnel.

Vérifier TypeScript avant chaque push : `npx tsc --noEmit`

### Règle anti-divergence (OBLIGATOIRE)

Avant tout travail, vérifier la synchronisation local/remote :
```bash
git fetch origin && git log origin/main..main --oneline && git log main..origin/main --oneline
```
- Si le local est **en retard** → `git pull --ff-only` avant de commencer
- Si le local est **en avance** → pusher d'abord ou demander confirmation
- Si **divergence** (commits des deux côtés) → STOP, alerter l'utilisateur, ne rien faire
- **Après chaque commit** → `git push origin main` immédiatement
- **Ne jamais accumuler** de commits locaux sans les pusher

## Règles de correction

- Diff minimal — ne toucher qu'aux fichiers strictement nécessaires
- Pas de refactor large sans demande explicite
- Non-régression prioritaire
- Commit + push uniquement si le fix est sûr

## Règles sécurité & RGPD — GED App

1. **JAMAIS `console.log` avec PII** — email, nom, prénom, token, données médicales interdits dans les logs. IDs et refs seulement.
2. **`gd_dossier_enfant` → `verifyOwnership()` obligatoire** — pas de guard inline. Centralisation dans `lib/verify-ownership.ts`.
3. **Données Art. 9 → `auditLog()` obligatoire** — sur chaque read/write de `gd_dossier_enfant`, `fiche_sanitaire`, `documents_joints`, Y COMPRIS côté admin.
4. **Collecte données → mention RGPD avant soumission** — bloc informatif + lien `/confidentialite` requis avant tout champ nominatif (inscription, souhait, dossier).
5. **Consentement parental < 15 ans = double vérification** — front (conditionnel) ET back (Zod + guard serveur). Tracer dans `parental_consent_at` + `parental_consent_version`.
6. **Tokens = UUIDs opaques** — jamais nom, email, ID enfant dans les tokens ou URLs publiques.
7. **Exports/listes admin = colonnes minimales** — exclure `fiche_sanitaire`, `fiche_liaison_jeune`, `documents_joints` des SELECT liste. Accès détail uniquement via route spécifique avec auditLog.
8. **Routes admin = `requireEditor` minimum** — jamais `verifyAuth` seul (inclut VIEWER). `requireAdmin` pour les actions destructives.
9. **localStorage = zéro PII** — UUID opaques acceptables, jamais email/nom/données personnelles.
10. **Upload = whitelist MIME + extensions + magic bytes** — toujours vérifier le contenu réel du fichier, pas le MIME déclaré.
11. **RLS actif sur toutes les tables contenant PII** — `gd_inscriptions`, `gd_dossier_enfant`, `gd_propositions_tarifaires` = service_role only. Jamais d'accès anon. **Pattern : RLS activé + zéro policy = accès client bloqué, service_role bypass RLS → correct et intentionnel.** L'alerte Supabase "no policies" sur ces tables est un faux positif à ignorer.
12. **Incident données → `docs/PROCEDURE_VIOLATION_DONNEES.md`** — délai CNIL : 72h. Protocole complet documenté.
13. **Purge RGPD automatique** — audit logs 12 mois, données médicales 3 mois post-séjour. Cron actif et testé.
14. **Session cookie = httpOnly + secure + sameSite strict** — jamais de JWT dans le body de réponse ni dans localStorage.
15. **Toute route admin accédant à des données nominatives doit appeler `auditLog()`** — même en lecture seule.
16. **Réassurance front obligatoire sur chaque écran collectant ou affichant des données** — qui voit quoi, pourquoi on collecte, combien de temps on garde.
17. **Multi-codes structure** — éducateur (suivi_token), CDS (6 chars, toute la structure), directeur (10 chars, tout + gestion codes). Expiration + révocation automatique (cron quotidien).
18. **Délégation directeur→CDS** — `delegation_active_from` / `delegation_active_until` en DB. Max 90 jours. Le CDS délégué voit le code CDS. Supprimable à tout moment par le directeur.
19. **Parcours pro sans compte** — `PriceInquiryBlock` sur la fiche séjour (formulaire inline) → email tarifs → CTA `/acceder-pro`. Ne jamais rediriger vers `/login` sans `?context=pro` depuis un parcours éducateur.
20. **`/acceder-pro`** — page publique, rate-limitée (2 req/60min par email). Envoie 2 emails (confirmation + alerte GED) + sauvegarde lead dans `smart_form_submissions`.

## Token efficiency — PERMANENT, AUTO, NO EXCEPTION
- Tables/listes > prose. Zéro filler. Zéro restatement. Zéro trailing summary.
- Shortest accurate answer wins.
- Ne jamais rescanner des dossiers déjà lus ou exclus de la tâche.
- Ne scanner que les fichiers/dossiers strictement concernés par la tâche.
- Réutiliser les résultats de scan dans la session — ne pas relancer.
- Auto-exclude : node_modules/, .next/, .git/, out/, fichiers générés, caches.
- Si la tâche ne concerne qu'un sous-dossier, ne pas explorer l'arbre complet.
- Adapter au profil utilisateur : business owner non-dev pilotant des projets full-stack via IA → réponses niveau senior tech, zéro pédagogie non sollicitée.
