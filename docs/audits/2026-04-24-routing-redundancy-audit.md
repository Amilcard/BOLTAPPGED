# Audit cartographie routes API + redondances

**Date** : 2026-04-24
**Scope** : `app/api/**/route.ts` (97 routes inventoriées)
**Déclenchement** : Analyse de complexité couche routage — hypothèse "routes trop imbriquées ou guards qui se contredisent".
**Mode** : Rapport only, aucun fichier modifié.
**Auteur** : arch-impact-reviewer (audit déterministe, lecture seule)

---

## Résumé exécutif

- **Pas de complexité pathologique** détectée. La profondeur max est 6 niveaux, justifiée par les scopes RLS/ownership.
- **Vraie dette identifiée** : 6 paires miroirs SSRF côté admin = **14 fichiers pour 7 opérations métier**. Origine : décision sécurité passée (URL littérale côté client).
- **1 potentielle divergence de guard** à vérifier (G2) : `/admin/stays/[id]` DELETE pourrait utiliser `requireEditor` au lieu de `requireAdmin` côté miroir `/admin/stays/delete`.
- **Matrice 3 acteurs** (parent/staff/admin) sur `dossier-enfant` = duplication **volontaire** (RGPD Art. 9, 3 auditLog contexts). Décision produit 2026-04-19, à **conserver**.

---

## 1. Inventaire exhaustif par domaine (97 routes)

### AUTH (11 routes)
| Route | Méthodes | Guard | Scope |
|---|---|---|---|
| `/api/auth/login` | POST | rate-limit + signInWithPassword + JWT `gd_session` | admin/editor/viewer |
| `/api/auth/logout` | POST | cookie clear | public |
| `/api/auth/structure-login` | POST | rate-limit + verifyPassword + `buildProSessionToken` | structure tous sous-rôles |
| `/api/auth/pro-session` | POST | email + code + `resolveCodeToStructure` | structure referent |
| `/api/auth/activate-invitation` | POST | token invitation | structure |
| `/api/auth/educator-invite` | POST | interne admin→structure | — |
| `/api/auth/2fa/setup` | POST | `requireAdmin` | admin |
| `/api/auth/2fa/confirm` | POST | `requireAdmin` | admin |
| `/api/auth/2fa/verify` | POST | token temporaire 2FA | admin |
| `/api/auth/2fa/disable` | POST | `requireAdmin` | admin |

### ADMIN (38 routes, `requireEditor` ou `requireAdmin`)
Séparation EDITOR (lecture + modif métier) / ADMIN (destructif, users, structures merge).

Routes clés avec **miroirs body-based** (pattern SSRF Lot 1-6) :
- `stays/[id]` ↔ `stays/update` ↔ `stays/delete`
- `users/[id]` ↔ `users/update` ↔ `users/delete`
- `stays/[id]/sessions/[sessionId]` ↔ `stays/sessions/delete`
- `stays/[id]/notify-waitlist` ↔ `stays/notify-waitlist`
- `propositions/[id]/send` ↔ `propositions/send`
- `inscriptions/[id]/relance` ↔ `inscriptions/relance`
- `factures/[id]/paiements` ↔ `factures/paiements`

### STRUCTURE staff (21 routes, `requireStructureRole`)
Matrice des rôles :
- **direction** (10 chars) : team/*, invite, delegation, settings, inscriptions/*
- **direction + cds** : factures/*, propositions/*
- **direction + cds_delegated** : team (lecture seule)
- **staff (dir+cds+cds_delegated+secretariat)** : inscriptions/[id]/* (dossier, submit, upload, pdf, pdf-email)
- **staff** : incidents, medical, calls, notes

### DOSSIER ENFANT referent (5 routes, `verifyOwnership` suivi_token)
`/api/dossier-enfant/[inscriptionId]/{route, submit, upload, pdf, pdf-email}`

### SUIVI referent (6 routes)
`/api/suivi/[token]/{route, structure}`, `/api/suivi/resend`, `/api/inscriptions/{route, [id]/recap-pdf}`, `/api/payment/create-intent`

### SOUHAITS / ÉDUCATEUR (5 routes)
| Route | Guard |
|---|---|
| `/api/souhaits` POST | public rate-limit |
| `/api/souhaits/kid/[kidToken]` GET | kid_session_token |
| `/api/souhaits/link-inscription` POST | `requireEditor` admin |
| `/api/educateur/souhait/[token]` (singulier) | educateur_token UUID row-level |
| `/api/educateur/souhaits/[token]` (pluriel) | JWT agrégé `verifyEducateurAggregateToken` |

### CRON (4 routes, `CRON_SECRET` Bearer)
`cleanup-invitations`, `expire-codes`, `health-checks`, `rgpd-purge`

### PUBLIC / DIVERS (9 routes)
Structures search/verify, pro request-access/price-inquiry, webhooks/stripe, pdf/[slug], waitlist, etc.

---

## 2. Carte conceptuelle

```
/api
├── auth/            (JWT émis + 2FA)
├── admin/           (requireEditor | requireAdmin)
│   ├── stays/{[id], update, delete, slug/[slug], sessions/delete, [id]/sessions/[sid], [id]/notify-waitlist, notify-waitlist}
│   ├── users/{[id], update, delete}
│   ├── inscriptions/{[id]/{route, relance}, manual, relance}
│   ├── propositions/{[id]/send, send, pdf}
│   ├── factures/{[id]/paiements, paiements, pdf}
│   ├── structures/{[id]/{audit-log, regenerate-code}, link, merge}
│   ├── demandes-tarifs/[id]
│   ├── dossier-enfant/[inscriptionId]   (miroir READ-ONLY de /dossier-enfant)
│   └── stats, session-prices
├── structure/[code]/    (requireStructureRole — 5 sous-rôles)
│   ├── {team/[memberId]/{reinvite, revoke}, invite, delegation, settings}   <-- direction only
│   ├── {factures, factures/pdf, propositions, propositions/pdf}              <-- direction + cds
│   └── inscriptions/[id]/{dossier, submit, upload, pdf, pdf-email}           <-- staff sauf educateur
├── dossier-enfant/[inscriptionId]/{route, submit, upload, pdf, pdf-email}    <-- verifyOwnership (suivi_token)
├── suivi/[token]/{route, structure},  suivi/resend
├── inscriptions/{route, [id]/recap-pdf}
├── educateur/{souhait/[token], souhaits/[token]}     <-- 2 tokens distincts (UUID row / JWT agrégé)
├── souhaits/{route, kid/[kidToken], link-inscription}
├── pro/{request-access, price-inquiry, propositions}
├── cron/*   (CRON_SECRET)
├── webhooks/stripe, pdf/[slug], waitlist, payment/create-intent,
│   structures/{search, verify/[code]}, inscription-urgence
```

**Profondeur max** : 6 (`/structure/[code]/inscriptions/[id]/upload`, `/admin/stays/[id]/sessions/[sessionId]`).

---

## 3. Redondances identifiées

| # | Pair/Trio | Justification actuelle | Coût maintenance |
|---|---|---|---|
| **R1** | `/admin/stays/[id]` (PUT/DELETE) ↔ `/admin/stays/update` ↔ `/admin/stays/delete` | Lot SSRF préemptif : URL littérale côté client. Helpers `runUpdateStay`/`runDeleteStay` mutualisés. | 2 fichiers par op, tests doublés, risque dérive auth. |
| **R2** | `/admin/users/[id]` (PUT/DELETE) ↔ `/admin/users/update` ↔ `/admin/users/delete` | Idem Lot 1 SSRF. | Idem R1. |
| **R3** | `/admin/stays/[id]/sessions/[sessionId]` (DELETE) ↔ `/admin/stays/sessions/delete` (POST) | Lot 6 SSRF. Helper `runDeleteSession` ignore staySlug (documenté). | Ambiguïté : 2 endpoints, 1 ignore le segment. |
| **R4** | `/admin/stays/[id]/notify-waitlist` ↔ `/admin/stays/notify-waitlist` | Lot 2 SSRF. | Idem. |
| **R5** | `/admin/propositions/[id]/send` ↔ `/admin/propositions/send` | Lot 3 SSRF. | Idem. |
| **R6** | `/admin/inscriptions/[id]/relance` ↔ `/admin/inscriptions/relance` | Lot SSRF. | Idem. |
| **R7** | `/admin/factures/[id]/paiements` (GET+POST) ↔ `/admin/factures/paiements` (POST) | Lot 4 SSRF. | Asymétrie : GET seulement sur `[id]`. |
| **R8** | `/dossier-enfant/[id]/*` ↔ `/structure/[code]/inscriptions/[id]/*` ↔ `/admin/dossier-enfant/[id]` | 3 scopes d'acteurs distincts (referent / staff mandataire / admin GED). Décision produit 2026-04-19 documentée. | 10+ fichiers, 3 auditLog contexts. **Pattern validé — coût volontaire.** |
| **R9** | `/educateur/souhait/[token]` (singulier) ↔ `/educateur/souhaits/[token]` (pluriel) | 2 modèles de tokens : row-level UUID pour répondre, JWT agrégé pour lister. | Nommage fragile (typo = mauvais endpoint). Pas de helper partagé. |

---

## 4. Guards qui se contredisent

| Cas | Route A | Route B | Verdict |
|---|---|---|---|
| G1 | `/admin/stays/[id]` PUT = `requireEditor` | `/admin/stays/update` PATCH = `requireEditor` | OK cohérent. |
| **G2** | `/admin/stays/[id]` DELETE = imports `requireEditor` + `requireAdmin` | `/admin/stays/delete` POST = `requireAdmin` | **À vérifier manuellement** : si DELETE legacy utilise `requireEditor`, divergence de sécurité. |
| G3 | `/admin/inscriptions` DELETE = `requireAdmin` | `/admin/inscriptions/[id]` GET/PUT = `requireEditor`, DELETE = `requireAdmin` | Documenté (EDITOR lit/modifie, ADMIN supprime). OK. |
| G4 | `cds_delegated` exclu de `/team/*`, `/invite`, `/delegation`, `/settings` | Inclus sur `GET /team` et `inscriptions/[id]/*` | Cohérent CLAUDE.md §289-292 (analyse 2026-04-17 + décision 2026-04-19). OK. |
| G5 | `/souhaits/link-inscription` POST = `requireEditor` | `/souhaits` POST = public + rate-limit | Asymétrie voulue. OK. |
| G6 | `/educateur/souhait/[token]` = UUID row-level | `/educateur/souhaits/[token]` = JWT signé + `verifyEducateurAggregateToken` | Modèles hétérogènes. Justifiable mais non documenté dans CLAUDE.md. |

---

## 5. Profondeur d'imbrication excessive

| Route | Profondeur | Valeur scope | Verdict |
|---|---|---|---|
| `/structure/[code]/inscriptions/[id]/*` | 6 | `[code]` = scope structure, `[id]` = inscription dans cette structure | Porteuse (`requireInscriptionInStructure`). **Conserver.** |
| `/structure/[code]/team/[memberId]/*` | 6 | `[memberId]` appartient à `[code]` | Idem. **Conserver.** |
| `/admin/stays/[id]/sessions/[sessionId]` | 6 | `[id]` staySlug **ignoré** côté helper | Profondeur **sans valeur**. **Candidat retrait** (R3). |
| `/admin/factures/[id]/paiements` | 5 | `[id]` = factureId filtre GET réel | GET utile, POST redondant. |
| `/admin/structures/[id]/{audit-log, regenerate-code}` | 5 | `[id]` = structureId | Porteur. **Conserver.** |

---

## 6. Recommandations priorisées (max 5)

| # | Problème | Gain attendu | Effort | Risque régression | Pattern migration |
|---|---|---|---|---|---|
| **P1** | 6 paires miroirs SSRF (R1–R7) = 14 fichiers pour 7 ops | -7 fichiers, -7 fichiers tests, 1 seule source auth/auditLog par op | M | M | Garder `[id]` version, ajouter `body-id` optionnel OU déprécier `[id]` avec redirect 308 vers miroir body-based après audit clients. |
| **P2** | G2 à vérifier : import `requireAdmin, requireEditor` sur `/admin/stays/[id]/route.ts` → ambiguïté guard DELETE | Fix éventuel d'une brèche (EDITOR supprime séjour vs ADMIN) | S | B | Lire le corps du fichier, aligner sur `requireAdmin` comme le miroir, commit atomique. |
| **P3** | R3 : `/admin/stays/[id]/sessions/[sessionId]` où `[id]` est documenté comme ignoré | Suppression segment mort, -1 route, -1 handler test | S | B | Marquer deprecated, rediriger front vers `/admin/stays/sessions/delete`, supprimer après 1 sprint. |
| **P4** | R9 : `/educateur/souhait` vs `/educateur/souhaits` — typo = mauvais endpoint | Clarté API | S | B | Renommer `/educateur/inbox/[token]` (JWT agrégé) et `/educateur/reply/[token]` (row UUID). Alias legacy 308 pendant 1 sprint. |
| **P5** | G6 : hétérogénéité tokens éducateur non documentée dans CLAUDE.md | Doc explicite = moins de régressions futures | S | B (doc only) | Ajouter section tokens dans CLAUDE.md : nommer les 2 modèles, leur scope, leur révocation. |

**Non recommandé** : aplatir `/structure/[code]/inscriptions/[id]/*` ou retirer le triptyque `dossier-enfant / structure-inscriptions / admin-dossier-enfant` — la séparation porte la matrice RGPD (3 acteurs, 3 auditLog contexts) et son coût est volontaire et récent (2026-04-19).

---

## Actions suivantes possibles

1. **P2 d'abord** (sécurité, ~5 min) — vérifier le guard DELETE réel sur `/admin/stays/[id]/route.ts`
2. **Tout en une passe** P2 → P3 → P4 → P5 → P1 — estimé ~2h + tests + commit atomique par P
3. **Laisser dormir** — revenir dessus quand une feature proche touchera ces zones

Pas de décision prise dans ce rapport. À trancher en session dédiée.
