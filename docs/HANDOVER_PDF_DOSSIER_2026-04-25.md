# Handover — PDF dossier enfant — 2026-04-25

**Auteur session** : Claude (Opus 4.7 1M)
**Zone touchée** : `app/api/dossier-enfant/[inscriptionId]/pdf/route.ts` + `scripts/pdf/`
**Commit ref** : voir `git log --oneline -5` (commit suivant ce handover)
**Précédent SHA** : `a9ebe9b` (avant cette session)

> Ce document existe pour qu'une autre IA reprenant le sujet ne ré-invente pas
> ce qui a été constaté ni ne réintroduise les régressions. Lecture obligatoire
> avant tout patch coordonnées PDF.

---

## 1. Ce qui a été fait dans cette session

### 1.1 Trois fixes structurels appliqués (route.ts)

| # | Localisation | Avant | Après | Justification |
|---|---|---|---|---|
| F1 | bulletin date signature `~L:329` | `writeDateTriplet({dayX, monthX, yearX, y:743})` | jour + mois seulement (yearX retiré) | Le template a déjà `/ 2026` imprimé → l'année écrite par-dessus |
| F2 | vaccins sanitaire `~L:430` | `rowY = 80 + i * 9` linéaire avec `i <= 2 ? left : i <= 8 ? middle : right` | layout 3×3 modulo : `colIndex = i<=2?0 : i<=7?1 : 2`, `rowInCol`, `rowY = 100 + rowInCol*18` | Bug X tous alignés sur header — l'indexation linéaire empilait les vaccins sur les premières y |
| F3 | catch signature embed `~L:566` | `catch {}` silencieux | `console.warn('[pdf GET] signature embed skipped:', err.message)` | Visibilité minimale en cas de PNG corrompu |

### 1.2 Script Phase A créé

`scripts/pdf/extract-template-coords.ts` (npx tsx).

**Sortie** : `out/pdf-coords.json` (gitignored) — extrait via pdf-lib les rectangles AcroForm.

**Résultat factuel d'exécution 2026-04-25** :

| Template | Fields AcroForm extraits |
|---|---|
| `bulletin-inscription-template.pdf` | **0** |
| `fiche-sanitaire-template.pdf` | **0** |
| `fiche-liaison-template.pdf` | 87 |
| `fiche-renseignements-template.pdf` | 0 |

**Conclusion** : 3 templates sur 4 sont des PDFs visuels statiques sans champ
AcroForm. Aucune coordonnée sémantique exploitable. La liaison a 87 champs
mais avec des noms génériques `Champ texte0..N` (mapping sémantique manuel
nécessaire si on veut s'en servir).

---

## 2. Ce qui n'a PAS été fait (et pourquoi)

### 2.1 Recalibrage des coordonnées x/y pour bulletin + sanitaire

**Refusé en cours de session pour éviter de ré-introduire des bugs.**

Historique des allers-retours coords signature : 730 → 780 → 795 sur 3
itérations, sans test visuel automatisé. Patcher d'autres x/y au pifomètre
relancerait le cycle.

**Méthode correcte** (déjà documentée par Codex) :

- `docs/ACROFORM_GUIDE.md` : pipeline LibreOffice Draw pour ajouter ~107
  champs AcroForm aux 2 templates (bulletin + sanitaire) — 30–60 min/template
- `docs/ACROFORM_FIELDS.md` : liste exhaustive nommée des champs
- ADR `2026-04-24-pdf-liaison-renseignements-email-flow.md` : justifie
  l'exclusion fiche-liaison et fiche-renseignements (bascule email)

Tant que les templates bulletin + sanitaire restent en mode overlay sans
AcroForm, les bugs Thanh d'alignement persisteront.

### 2.2 Bugs Thanh visuels non corrigés (recensés mais non patchés)

Source : doc utilisateur `Problème Fiche téléchargé.pdf` + 12 captures
+ 3 PDFs générés (Bulletin/Liaison/Sanitaire) ouverts en session.

**Bulletin (encore présents en sortie session, hors F1)** :

- Tableau `Documents à envoyer à` : `X` placé en colonne label (1ʳᵉ col) au
  lieu des colonnes `FICHE LIAISON` ou `CONVOCATION`. Le data ne capture pas
  non plus quelle colonne cocher (un seul `envoi_fiche_liaison` pour 2 cols).
- `Financement du séjour` : checkboxes y=580/596/612/628 tombent dans le
  bandeau orange `TÉLÉPHONE/SERVICE DEMANDEUR/AFFAIRE SUIVIE PAR`. Le tableau
  financement réel est plus bas (~y=665).
- `Autorisation responsable légal` : le champ "responsable légal de l'enfant
  ____" est attendu autour de x=180, le code écrit à x=370 (hors zone).
  Le contenu (`prenom + nom`) est correct côté code.
- Signature pictogramme `y=795` tombe sur le footer ASSOCIATION GROUPE ET
  DÉCOUVERTE — la zone signature template est ~y=755.

**Sanitaire (encore présents en sortie session, hors F2)** :

- Date naissance `01/01/2020/ ........./ ........` : `writeDateTriplet`
  écrit jour+mois+année dans la case `jour` parce que le template n'a pas
  3 cases physiques séparées (ou les coords dayX/monthX/yearX sont fausses).
- Sexe `Garçon X Fille` : X positionné entre les deux labels.
- Sieste : aucune case cochée alors que data peut exister.
- Mail responsable 2 `camilleroux` tronqué (probable bug saisie côté
  formulaire, pas PDF — à vérifier).
- Tél portable resp 2 `*0123456789` : astérisque parasite du label `*` collé
  au numéro (offset x trop petit).
- Traitement médical `X NON ⚪` : X avant `NON` au lieu de cocher le radio.
- `Alimentaire — ALLERGIES AUX ARARCHIDES` écrit par-dessus le titre
  `ALLERGIES & DIFFICULTÉS DE SANTÉ` (probable y trop haut sur
  `allergie_detail` ou `allergie_autres`).
- Cases ASTHME / ALIMENTAIRES / MÉDICAMENTEUSES : aucune cochée alors qu'une
  allergie est saisie en clair.
- `Régime alimentaire` écrit par-dessus la question
  `Le mineur présente-t-il un problème de santé...`.
- Recommandations utiles : zone vide.
- Date + Signature obligatoire mal alignées.

**Liaison (encore présent)** :

- Pictogrammes signature `✍ ✍` mal placés (deux zones signature attendues :
  jeune + responsable, le code n'en place qu'une seule).
- Page 2 (Informations avant séjour) et page 3 (Compte rendu) vides → **by
  design**, ADR liaison-email-flow. Pas un bug.

### 2.3 P0/P1 sécu identifiés mais non corrigés cette session

| Code | Localisation | Action attendue |
|---|---|---|
| B1 | `~L:67-71` SELECT * sur `gd_dossier_enfant` | Remplacer par liste explicite des colonnes JSONB selon docType |
| B2 | `~L:604` catch final `console.error` brut | Ajouter `captureServerException(error, {domain:'rgpd', operation:'pdf_generate'}, {docType, inscriptionId})` |
| B3 | `~L:542` embedPng sans cap taille | Valider `imgBytes.length < 500_000` avant embed |
| M6 | `~L:80` post-SELECT | Ajouter `if (inscription.referent_email !== ownership.referentEmail) return 403` |

Ces 4 P0/P1 viennent de l'audit `functional-bug-hunter` interne à cette
session. À cross-checker avec `audit-reports/sentry-coverage.txt` et
`audit-reports/role-guards.txt` qui ont été modifiés en parallèle par une
autre session — possiblement déjà traités ailleurs. **Ne pas appliquer
sans vérifier d'abord** que ce n'est pas en double.

### 2.4 Branches `claude/*` orphelines auditées (non supprimées)

Audit complet effectué via diff vs main :

| Branche | Statut | Décision matrice CLAUDE.md anti-branches-orphelines |
|---|---|---|
| `claude/lucid-leavitt-6aa6a9` | 2 commits PDF (`086eb9f` + `48a364c`) | **Abandon** — `086eb9f` re-porté fidèlement par `dbbd372` sur main, refacto `48a364c` réintroduirait bugs déjà fixés |
| `origin/claude/review-ged-architecture-LIdeW` | 201 commits, 38j retard | **Abandon** — déjà tracé dans `docs/TECH_DEBT.md` actif item (e) |
| `claude/security-code-review-QpkBJ` | 154 commits historiques | **Abandon** — c'est l'ancienne branche principale pré-Vercel, entièrement absorbée. Vérifié : `iirfvndgzutbxwfdwawu` hardcoded supprimé, `ORG_BANK_IBAN` variabilisé, security headers présents, middleware avancé |
| `claude/{blissful-matsumoto, goofy-jones, magical-grothendieck, nostalgic-hugle-9805ee, sweet-bhabha-52ca83}` + `origin/claude/upbeat-hawking` | 0 commit unique (tip = merge-base) | Suppression triviale |

**Action humaine attendue** : `git push origin --delete <branch>` pour
chaque, plus `git branch -D <branch>` local. Non exécuté en session : action
destructive, l'utilisateur doit valider explicitement.

---

## 3. Anti-patterns à NE PAS reproduire

1. **Patcher des coordonnées x/y au pifomètre** : c'est exactement ce qui a
   produit le cycle 730→780→795 sur la signature et les 21 bugs Thanh
   actuels. Toute modification de coord doit passer par AcroForm + mesure
   automatisée OU validation visuelle pixel.
2. **Cherry-pick d'une branche `claude/*` sans audit diff préalable** :
   conflits massifs garantis vu l'évolution de main. Si fix orphelin
   pertinent, re-porter manuellement les valeurs/logique sur main.
3. **Ré-introduire `lib/pdf-dossier.ts`** (refacto orphan `48a364c`) : il
   contient les anciennes versions buggées de `writeText` (cap 120 fixe),
   `pourquoi_ce_sejour` (slice arbitraire), date liaison (`new Date()`).
   Le rendu inline sur main est plus avancé.
4. **Supprimer le commentaire `// nosemgrep: ... -- static whitelist`** sur
   le `path.resolve` du template (route.ts ~L:103-104) : le whitelist est
   déjà documenté, le supprimer ré-allume Codacy/Semgrep.
5. **Toucher à `app/global-error.tsx`, `next.config.mjs`,
   `audit-reports/*.txt`** depuis cette zone : ils sont modifiés par d'autres
   sessions/scripts CI. Hors scope dossier-enfant PDF.

---

## 4. Pour reprendre proprement le sujet

Ordre recommandé :

1. **Lire** `AGENTS.md` + `CLAUDE.md` § "anti-branches-orphelines" + cette
   section
2. **Exécuter** la Phase B (création AcroForm bulletin + sanitaire) selon
   `docs/ACROFORM_GUIDE.md` + `docs/ACROFORM_FIELDS.md` (107 champs)
3. **Refactor** `route.ts` : remplacer `writeText(0, 160, 79, ...)` par
   `form.getTextField('coord_prenom').setText(...)`. Plus de hardcoded x/y.
4. **Régénérer** les 3 PDFs avec data fixture "Mia Laurent" et comparer
   visuellement aux captures Thanh dans `Capture-Problème-Fiche Téléchargé/`
5. **Câbler** un test snapshot (Phase C non faite) : générer PDF fixture en
   CI, diff binaire/pixel-perfect.

---

## 5. État des fichiers en sortie de session

```
M  app/api/dossier-enfant/[inscriptionId]/pdf/route.ts   ← 3 fixes (F1/F2/F3) + 320 lignes pré-existantes
?? scripts/pdf/extract-template-coords.ts                ← Phase A
?? out/pdf-coords.json (gitignored)                      ← extrait Phase A
?? docs/HANDOVER_PDF_DOSSIER_2026-04-25.md               ← ce document
```

**Hors scope** (modifié par autres sessions, NON inclus dans le commit) :

```
M  app/global-error.tsx
M  next.config.mjs
M  audit-reports/*.txt              ← scripts CI parallèles
?? AGENTS.md                        ← Codex
?? docs/ACROFORM_GUIDE.md           ← Codex
?? docs/ACROFORM_FIELDS.md          ← Codex
?? .codex/                          ← config Codex
?? audit-reports/email-outbound-drift.txt
?? audit-reports/sentry-coverage.txt
?? audit-reports/state-reconciliation.txt
?? audit-reports/zod-sql-consistency.txt
```
