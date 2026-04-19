# Audit sécurité — Flux dossier-enfant

**Date** : 2026-04-19
**Scanner alert** : 2 CRITICAL SSRF sur `useDossierEnfant.ts` (lignes 100 + 140)
**Mode** : Phase 1 read-only, aucune modification appliquée
**Scope audité** : 1 hook + 5 API routes + RLS + helper `verify-ownership`

---

## Section 1 — Hook `components/dossier-enfant/useDossierEnfant.ts`

### Imports & origine des valeurs

| Valeur | Source | Validation |
|---|---|---|
| `inscriptionId` | prop `UseDossierEnfant(inscriptionId, …)` | `validateUUID(inscriptionId)` via `UUID_RE.exec()` |
| `token` | prop `UseDossierEnfant(id, token, …)` | `validateUUID(token)` en mode référent uniquement |
| `staffMode.structureCode` | option objet | `encodeURIComponent()` avant insertion URL |

### Constructions d'URL

| Ligne | URL | Commentaire |
|---|---|---|
| 96-98 | `/api/dossier-enfant/${safeId}?token=${validateUUID(token)}` (réf.) | **Relative** — préfixée `/api/` |
| 96-97 | `/api/structure/${encodeURIComponent(code)}/inscriptions/${safeId}/dossier` (staff) | **Relative** — structureCode URL-encoded |
| 131-133 | Idem, PATCH body au lieu de query-token | **Relative** idem |

### Gestion d'erreurs

- `res.json().catch(() => ({}))` : parse body, fallback `{}`
- `throw new Error(body?.error?.message || 'Erreur de chargement')`
- Pas de leak de stack trace côté UI
- `setError((err as Error).message)` uniquement

### Verdict hook

- Validation UUID **double** (load + saveBloc)
- **Aucune URL externe** jamais construite
- **Aucun user-input host** — seuls `id`, `token`, `structureCode` (encodés/validés) entrent dans le path

---

## Section 2 — API routes `/api/dossier-enfant`

### Fichiers audités

```
app/api/dossier-enfant/[inscriptionId]/route.ts           (GET + PATCH)
app/api/dossier-enfant/[inscriptionId]/upload/route.ts    (GET + POST + DELETE)
app/api/dossier-enfant/[inscriptionId]/submit/route.ts    (POST)
app/api/dossier-enfant/[inscriptionId]/pdf/route.ts       (GET)
app/api/dossier-enfant/[inscriptionId]/pdf-email/route.ts (POST)
```

### Matrice sécurité

| Route | Méthode | Token validé | Ownership | auditLog | Service role | Size cap |
|---|---|---|---|---|---|---|
| `/[id]` | GET | `verifyOwnership` → `UUID_RE.test(token)` | ✓ source+target | ✓ Art.9 `read` | ✓ `getSupabaseAdmin()` | n/a |
| `/[id]` | PATCH | idem | ✓ source+target | ✓ Art.9 `update` | ✓ | `validateBase64Image(sig, {max: 500_000})` ligne 178 |
| `/[id]/upload` | POST | idem | ✓ source+target | ✓ `upload` | ✓ | `validateUploadSize({max: 5MB})` + magic bytes |
| `/[id]/upload` | GET | idem | ✓ source+target | ∅ lecture liste | ✓ | n/a |
| `/[id]/upload` | DELETE | idem | ✓ source+target + IDOR guard `startsWith(inscriptionId + '/')` | ✓ `delete` | ✓ | n/a |
| `/[id]/submit` | POST | idem | ✓ source+target | ✓ `submit` | ✓ | n/a |
| `/[id]/pdf` | GET | idem | ✓ source+target | ✓ `pdf` | ✓ | n/a |
| `/[id]/pdf-email` | POST | idem + `UUID_RE.test()` redoublé | ✓ source+target | ✓ email | ✓ | `AbortSignal.timeout(60000)` |

### `verifyOwnership()` — analyse détaillée (`lib/verify-ownership.ts`)

4 barrières de validation avant tout accès DB :

```
(1) UUID_RE.test(token)            → INVALID_TOKEN 400
(2) UUID_RE.test(inscriptionId)    → INVALID_ID    400
(3) fetch SOURCE by suivi_token    → NOT_FOUND 404 si absent/soft-deleted
    check suivi_token_expires_at   → TOKEN_EXPIRED 403 si dépassé
(4) fetch TARGET by id             → FORBIDDEN 403 si
    compare referent_email         → target.ref_email ≠ source.ref_email
```

**Point clé anti-IDOR** : étape 4 — la route charge **l'inscription cible par `id`** et vérifie que son `referent_email` correspond à celui du **token source**. Un attaquant avec token valide ne peut pas pivoter sur une autre inscription que celles de **son** référent.

**Comportement voulu** : un référent avec N enfants → son token donne accès à N dossiers. Ce n'est pas un IDOR, c'est le design (un référent = N enfants ASE).

---

## Section 3 — RLS Supabase

### `gd_inscriptions` et `gd_dossier_enfant`

Source : `sql/032_enable_rls_critical_tables.sql`

```sql
ALTER TABLE gd_inscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE gd_dossier_enfant  ENABLE ROW LEVEL SECURITY;
-- Pas de policy anon/authenticated = deny-by-default
-- service_role bypass RLS (intentionnel, documenté CLAUDE.md #11)
```

**État** : RLS activée, **zéro policy** → accès client bloqué. `service_role` bypasse RLS (toutes les routes API utilisent `getSupabaseAdmin()`).

**Conforme** CLAUDE.md règle #11 — pattern attendu, faux positif Supabase Advisors "no policies".

### `gd_inscriptions.suivi_token_expires_at`

Source : `sql/035_rgpd_compliance.sql`

- Colonne ajoutée avec default `now() + 30 days`
- Backfill sur tokens existants
- Vérifiée à chaque appel `verifyOwnership()` étape 3

---

## Section 4 — Findings

### SSRF (alertes scanner lignes 100 + 140)

**Verdict : FAUX POSITIF CONFIRMÉ**

Raisons :
- Les URLs passées à `fetch()` sont **strings commençant par `/api/...`**
- Les URLs relatives sont résolues contre `window.location.origin` côté browser
- L'attaquant ne contrôle **jamais** l'host (il n'est même pas dans le code)
- Seuls `inscriptionId` (UUID validé) et `token` (UUID validé) et `structureCode` (`encodeURIComponent`) entrent dans le path
- Le pattern `fetch(variable)` déclenche par défaut les scanners SAST sans analyse de contenu

Ce n'est pas un SSRF par définition — aucune requête sortante vers un host tiers n'est jamais émise depuis ce hook.

### IDOR

**Verdict : ABSENT**

Protection par double-fetch + comparaison `referent_email` dans `verifyOwnership()` (voir Section 2). Un attaquant :
- avec `token` valide A + `inscriptionId` d'un dossier B d'un autre référent → bloqué à l'étape 4 (FORBIDDEN 403)
- avec `token` invalide → bloqué à l'étape 1 ou 3
- avec `token` expiré → bloqué à l'étape 3 (TOKEN_EXPIRED 403)
- avec `storage_path` d'un autre dossier sur `/upload DELETE` → bloqué par IDOR guard ligne 288 (`startsWith(inscriptionId + '/')`)

### Token réutilisable

**Verdict : OUI — mais bordé RGPD**

Le `suivi_token` est persistant pendant 30 jours (CLAUDE.md règle #17). Réutilisable par design : le référent envoie le lien par email → il doit pouvoir revenir. Mais :

- TTL 30 jours (`suivi_token_expires_at`)
- Purge RGPD cron mensuel
- Soft-delete (`deleted_at IS NULL` filtre)
- Pas de révocation on-demand (dette connue CLAUDE.md)

### Leak info dans erreurs

**Verdict : Aucun leak exploitable**

- Erreurs structurées `{ error: { code, message } }` avec codes génériques
- `console.error` côté serveur (logs Vercel internes) — pas renvoyé au client
- `validateBase64Image`, `validateUploadSize` renvoient 413 avec message court sans détails internes

---

## Section 5 — Recommandations priorisées

### P0 — RIEN

Aucune vulnérabilité exploitable trouvée. Le code **est déjà sécurisé**.

### P1 — RIEN

Pas de défense profondeur manquante justifiée. `verifyOwnership` applique déjà 4 barrières. Ajouter plus serait de l'accumulation (règle utilisateur "plus jamais de rustine").

### P2 — Cosmétique / maintenabilité (optionnel)

| # | Action | Justification | Effort |
|---|---|---|---|
| P2.a | Commentaire de tête sur `useDossierEnfant.ts` documentant que les URLs sont relatives → SSRF faux positif | Calme les scanners futurs + explicite la décision | 2 min |
| P2.b | Extraire un helper `buildDossierUrl(id, token, staffCode)` | Centralise la construction URL (3 occurrences → 1) | 10 min |

Les 2 sont **optionnelles** — aucune ne corrige un défaut. P2.a relève de la documentation, P2.b du refacto DRY.

---

## Section 6 — Propositions de patch (NON appliqué)

### Patch P2.a — Documentation inline hook

**Fichier** : `components/dossier-enfant/useDossierEnfant.ts`
**Emplacement** : haut du fichier, avant `import`

```ts
'use client';

/**
 * NOTE SÉCURITÉ :
 * Les URLs passées à fetch() dans ce hook sont toutes RELATIVES (/api/...).
 * Elles sont résolues contre window.location.origin côté browser →
 * SSRF classique impossible par conception (aucun contrôle attaquant sur l'host).
 *
 * Les scanners SAST flaggent fetch(variable) par défaut : FAUX POSITIF.
 *
 * Protection IDOR côté serveur : verifyOwnership() dans lib/verify-ownership.ts
 * (double-fetch source/target + comparaison referent_email + check expiration token).
 * Audit complet : docs/audits/AUDIT_DOSSIER_ENFANT_2026-04-19.md
 */

import { useState, useEffect, useCallback, useRef } from 'react';
// ... reste inchangé
```

### Patch P2.b — Helper `buildDossierUrl` (optionnel)

**Fichier** : `components/dossier-enfant/useDossierEnfant.ts`
**Emplacement** : après `validateUUID`, avant `export interface DossierEnfant`

```ts
function buildDossierUrl(
  safeId: string,
  safeToken: string | null,
  staffCode?: string,
): string {
  if (staffCode) {
    return `/api/structure/${encodeURIComponent(staffCode)}/inscriptions/${safeId}/dossier`;
  }
  if (!safeToken) {
    throw new Error('Token requis en mode référent');
  }
  return `/api/dossier-enfant/${safeId}?token=${safeToken}`;
}
```

Usage `load()` :

```ts
const url = buildDossierUrl(safeId, validateUUID(token), staffMode?.structureCode);
const res = await fetch(url);
```

Usage `saveBloc()` :

```ts
const url = buildDossierUrl(safeId, null, staffMode?.structureCode);
// PATCH sans token dans URL (le token est dans body)
```

**NB** : pour le PATCH, la signature diverge — URL sans token même en mode référent (token dans body). Le helper doit être adapté ou dupliqué pour PATCH. Refacto non trivial — à ne faire que si gain maintenabilité confirmé.

---

## Section 7 — Blast radius estimé

### Fichiers qui seraient modifiés si P2.a appliqué

| Fichier | Lignes touchées | Risque régression |
|---|---|---|
| `components/dossier-enfant/useDossierEnfant.ts` | +15 (commentaire uniquement) | Nul (cosmétique) |

**Blast radius : 1 fichier.** Sous seuil CLAUDE.md (5 fichiers).

### Fichiers qui seraient modifiés si P2.b appliqué

| Fichier | Lignes touchées | Risque |
|---|---|---|
| `components/dossier-enfant/useDossierEnfant.ts` | ±30 (nouveau helper + 2-3 refs) | Faible — refacto ciblé hook, tests unitaires pilotent le comportement |

Aucun autre fichier consommateur du hook ne change (API callers côté React).

---

## Conclusion globale

**Le flux `dossier-enfant` est sécurisé.** Les 2 alertes SAST SSRF sont des faux positifs — aucun host externe n'est jamais construit, toutes les URLs sont relatives. L'IDOR est bloqué par `verifyOwnership()` avec 4 barrières (UUID regex, source fetch + expiration, target fetch + comparaison `referent_email`). RLS activée deny-by-default sur les 2 tables sensibles.

**Rien à corriger en P0/P1.**

Si le scanner doit être calmé, seul le patch P2.a (commentaire documentaire) est recommandé. Le patch P2.b (helper URL) est un refacto DRY optionnel — pas une correction de sécurité.

---

**Prêt pour décision utilisateur** :
- Option A : ne rien faire — code déjà safe, documenter le faux positif dans le backlog SAST
- Option B : appliquer P2.a seul (15 min, 0 risque)
- Option C : appliquer P2.a + P2.b (30 min, refacto mineur, tests Jest couvrent)

**Aucune modification appliquée dans cet audit.**
