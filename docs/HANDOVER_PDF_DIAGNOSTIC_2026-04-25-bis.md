# Handover — Diagnostic PDF dossier enfant (suite) — 2026-04-25 12h

**Auteur session** : Claude (Opus 4.7 1M)
**Session précédente** : `4d6c335` (autre IA) + `docs/HANDOVER_PDF_DOSSIER_2026-04-25.md`
**SHA en sortie** : `4d6c335` (aucun commit produit dans cette session — diagnostic only)

> Cette session a été exclusivement diagnostic + traçage dette. **Aucun fichier modifié** après `4d6c335`. Si tu reprends : ne refais pas les mesures déjà faites ci-dessous.

---

## 1. Ce que cette session a fait

### 1.1 Commits réels (avant cette session, dans le même tronc)
- `90f3b2a` feat(dossier): switch liaison + renseignements to email flow (ADR 2026-04-24)
- `ee9d743` docs(audit): routing redundancy report 2026-04-24
- `e34e1e7` docs(tech-debt): trace delegation cron expiration gap V2
- `a9ebe9b` fix(audit): post-action-assertions regex multi-line + branch orphan trace
- `4d6c335` (autre IA) fix(pdf-dossier): bulletin date + vaccins layout 3x3 + signature warn + handover

### 1.2 Cette session : 0 commit code, 1 fichier handover (celui-ci)

Mesures + audit + verdict only. Tué le dev server local en fin de session.

---

## 2. Mesures MCP Supabase déjà faites (ne pas refaire)

### 2.1 Dossier référence Thanh — confirmé
- **inscriptionId** : `ce6d0a23-7407-4a74-ab51-9da7e58effed`
- **suivi_token** : `7f1c20e5-1af9-41f2-9702-cf2341651381` (valide jusqu'au 2026-05-24)
- **referent_email** : `bonbon123@yopmail.com`
- **séjour** : `les-ptits-puisotins-1` (note : Liaison PDF affichait "MY LITTLE FOREST" — data peut-être obsolète OU autre dossier antérieur)
- **ged_sent_at** : 2026-04-23 (déjà soumis)
- **dossier_id** : `24bf496b-57fb-40d1-bfd2-c93f6ce44a07`

### 2.2 État réel fiche_sanitaire Mia (DB ground truth)
```
recommandations_parents = "Régime alimentaire"
probleme_sante_detail   = ""        (string vide, pas NULL)
allergie_detail         = "ALLERGIES AUX ARARCHIDES"
sieste                  = ""         (vide)
traitement_en_cours     = "false"   (string, pas boolean)
allergie_asthme         = "non"
allergie_alimentaire    = NULL
allergie_medicamenteuse = NULL
allergie_autres         = ""
remarques               = NULL
regime_alimentaire      = NULL       (champ absent du form)
```

### 2.3 Worst-case signatures prod (34 sigs mesurées)
| Doc | Min | Avg | **Max** |
|---|---|---|---|
| Bulletin | 6.5 KB | 7.6 KB | 8.9 KB |
| Sanitaire | 6.0 KB | 7.5 KB | 8.7 KB |
| Liaison | 5.6 KB | 8.6 KB | **13.7 KB** |

→ Cap embedPng recommandé : **200 KB** (15× worst case). 500 KB = excessif. 100 KB = risque rejet sigs hautes.

### 2.4 Branches orphelines `claude/*` audit
- 7 branches `claude/*` locales
- **`origin/claude/review-ged-architecture-LIdeW`** : 201 commits, 17/03/2026, 306 fichiers diff. **Abandon** recommandé (matrice CLAUDE.md anti-branches-orphelines). Tracé dans `TECH_DEBT.md` item T1+T2 sous-dette `(e)`.

### 2.5 verifyOwnership analyse
- `lib/verify-ownership.ts:65-76` fait DÉJÀ le couplage strict `token ↔ inscription_id ↔ referent_email`
- → **M6 sécu (handover précédent §2.3) = faux positif**. Ne pas appliquer (défense redondante).

### 2.6 Audit baseline `scripts/audit/all.mjs` (post-fix `a9ebe9b`)
Script `post-action-assertions.mjs` réparé : regex single-line ne matchait pas mutations multi-line. Baseline réelle = **110 mutations sans assertX câblé** (vs 0 faussement avant).

---

## 3. Diagnostic critique (corrige une erreur du plan architecte précédent)

### 3.1 Convention Y dans `writeText` — INVERSÉE

`route.ts:154` :
```ts
y: height - y,  // pdf-lib utilise origine bas-gauche, mais writeText prend y depuis le HAUT
```

**Conséquence** : dans le code, `Y plus grand = plus BAS sur la page`.

| Y dans code | Position visuelle (page A4 841 pts) |
|---|---|
| 216 | 26% du haut (haut de page) |
| 498 | 59% (milieu) |
| 560 | 67% (milieu-bas) |
| 648 | 77% (bas) |

### 3.2 Bug Thanh "Régime alimentaire sur question santé" — DÉJÀ RÉSOLU

Le PDF Mia généré aujourd'hui (post-`4d6c335`) :
- `recommandations_parents="Régime alimentaire"` est rendu Y=648 = **zone "Recommandations utiles des parents"** (correcte) ✅
- `probleme_sante_detail=""` n'est rien rendu (data vide) ✅
- pdftotext confirme "Régime alimentaire" présent dans le PDF

**Hypothèse** : un commit antérieur (probablement `4d6c335` ou avant) a indirectement résolu le bug capturé par Thanh le 24/04 10:08 (PDF `Fiche_sanitaire (5).pdf`). Le code post-`4d6c335` est correct sur ce point.

### 3.3 Plan architecte F4+F5 (swap Y reco/santé) — REJETÉ

L'architecte a proposé d'inverser Y=560 et Y=648. **Si appliqué, casserait le rendu actuel** (déplacerait recommandations en haut de page). Diagnostic basé sur mauvaise compréhension de la convention Y inversée.

### 3.4 Plan architecte F9 (traitement_en_cours boolean) — REJETÉ

Code L456-457 gère DÉJÀ `boolean false` via `|| d.traitement_en_cours === false`. Le bug Thanh "X superposé sur NON" est en réalité **coord X=578 mal calibrée** = Cat B coord pure = **interdit pifomètre**. Phase B AcroForm uniquement.

### 3.5 Plan architecte F6 (sieste enum drift) — NON URGENT

Form propose `oui` / `ca_depend`. Code attend `oui` / `non`. Drift réel mais :
- Mia : `sieste=""` → rien coché (correct)
- Aucun parent en prod n'a probablement saisi `ca_depend` (à mesurer)
- Bug latent, pas actuel. Attendre un cas réel ou Phase B AcroForm.

---

## 4. Bugs Thanh restants (post-`4d6c335`)

Tous **Cat B coord pure** = INTERDIT pifomètre, Phase B AcroForm uniquement.

Liste consolidée handover précédent §2.2 + observations cette session :
- Bulletin : Documents à envoyer X colonne label, Financement checkboxes y=580-628 dans bandeau orange, Autorisation x=370 vs attendu x=180, Signature y=795 sur footer
- Sanitaire : Date naissance dans 1 case, Sexe X mal placé, Mail tronqué (bug saisie React), Tél portable astérisque parasite, Traitement médical X superposé NON, Date+Signature obligatoire mal alignées
- Liaison : Pictogrammes signature mal placés, 1 seule signature au lieu de 2

---

## 5. Sécu non appliquées (handover précédent §2.3) — toujours valides

| Code | Localisation | Action |
|---|---|---|
| **B1** | `route.ts:67-71` `SELECT *` | Liste explicite par docType (réduit aussi surface RGPD) |
| **B2** | `route.ts:619` catch brut `console.error` | `captureServerException(e, {domain:'rgpd', operation:'pdf_generate'}, {docType, inscriptionId})` (helper déjà en place `lib/sentry-capture.ts`) |
| **B3** | `route.ts:558-559` embedPng sans cap | `if (imgBytes.length > 200_000)` (basé mesure §2.3) |
| ~~M6~~ | ~~ownership post-SELECT~~ | ❌ **FAUX POSITIF** — verifyOwnership couvre déjà (cf. §2.5) |

**Effort** : ~45 min total, 3 commits indépendants, aucune coord touchée.

---

## 6. État de la session sortie

```
git status --short  (au moment T-1) :
 M app/api/dossier-enfant/[inscriptionId]/pdf/route.ts   (autre IA, déjà committé en 4d6c335)
 M app/global-error.tsx                                  (autre session, hors scope)
 M next.config.mjs                                       (autre session, hors scope)
 M audit-reports/*.txt                                   (refresh script audit, peut-être commit-utile)
?? docs/HANDOVER_PDF_DIAGNOSTIC_2026-04-25-bis.md        (ce document)
?? AGENTS.md                                             (Codex, hors scope)
?? .codex/                                               (config Codex)
```

Dev server local Next.js a été lancé puis tué (PID 14725 killed).

PDFs générés en /tmp pour validation visuelle (peuvent être supprimés) :
- `/tmp/mia-sanitaire-BEFORE.pdf` (562 KB, rendu actuel)
- `/tmp/mia-sanitaire-BEFORE-2.png` (page 2 visualisée)

---

## 7. Tasks Claude Code créés (peuvent être nettoyés)

- `#11` CI Jest fail audit-log getClientIp mock obsolète → **résolu** (test passe en local sur main, CI relance suffit)
- `#12` Cartographier 13 bugs Thanh → fait, voir §4 + handover précédent
- `#13` Plan fix rustine coords + CI fix → résolu (rustine refusée, CI passé)

---

## 8. Pour reprendre proprement

**Si l'utilisateur veut continuer les fixes sécu (B1+B2+B3)** : 
1. Relire §5 ci-dessus
2. Attention `route.ts:67-71` modifié par `4d6c335` (SELECT a déjà bougé), vérifier état actuel avant patcher B1
3. Régénérer PDF Mia après chaque commit (token Mia §2.1) + pdftoppm + Read PNG

**Si l'utilisateur veut Phase B AcroForm** :
1. Procédure `docs/ACROFORM_GUIDE.md` (LibreOffice, 30-60 min/template, 107 champs sur bulletin + sanitaire)
2. Refacto `route.ts` : `writeText(0, 160, 79, ...)` → `form.getTextField('coord_prenom').setText(...)`
3. Snapshot tests post-refacto

**Si l'utilisateur veut nettoyer branches orphelines** : `git push origin --delete <branch>` × 7 (liste handover précédent §2.4)

---

## 9. Anti-patterns à NE PAS reproduire

1. **Patcher coord au pifomètre** : si tu veux corriger un bug visuel sans AcroForm, tu DOIS valider visuellement avant ET après via pdftoppm + Read PNG.
2. **Faire confiance à un plan architecte sans vérifier la convention Y** : `writeText` inverse Y. Toujours regarder `route.ts:154` avant d'analyser des coordonnées.
3. **Délégation à arch-impact-reviewer sans cross-check par lecture code** : l'architecte peut spéculer si la doc est ambiguë. Toujours re-lire le code source.
4. **Réintroduire un fix qui a déjà été fait** : commit `4d6c335` a fixé F1/F2/F3 + helpers. Bug Thanh "Régime alimentaire" probablement résolu indirectement.
5. **Toucher fichiers hors scope** : `app/global-error.tsx`, `next.config.mjs`, `audit-reports/*`, `lib/pdf-dossier.ts` (orphelin).

---

## 10. Fichiers absolus référencés

- `/Users/laidhamoudi/Dev/GED_APP/app/api/dossier-enfant/[inscriptionId]/pdf/route.ts`
- `/Users/laidhamoudi/Dev/GED_APP/lib/verify-ownership.ts`
- `/Users/laidhamoudi/Dev/GED_APP/lib/sentry-capture.ts`
- `/Users/laidhamoudi/Dev/GED_APP/components/dossier-enfant/FicheSanitaireForm.tsx`
- `/Users/laidhamoudi/Dev/GED_APP/docs/HANDOVER_PDF_DOSSIER_2026-04-25.md` (handover précédent)
- `/Users/laidhamoudi/Dev/GED_APP/docs/ACROFORM_GUIDE.md`
- `/Users/laidhamoudi/Dev/GED_APP/docs/ACROFORM_FIELDS.md`
- `/Users/laidhamoudi/Dev/GED_APP/docs/TECH_DEBT.md` (R1 5/5 saturé, sous-dettes a-f dans item T1+T2)
- `/Users/laidhamoudi/Downloads/Capture-Problème-Fiche Téléchargé/` (12 captures Thanh + 3 PDFs réels)
