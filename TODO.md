# TODO — Migration AcroForm pour les PDF dossier enfant

**Créé le** : 2026-04-24
**Owner technique** : utilisateur (+ IA pour refacto code une fois les PDF livrés)
**Deadline proposée** : 48-72h après démarrage, avant nouvelle vague Thanh

> **SCOPE MIS À JOUR 2026-04-24** — voir `docs/adr/2026-04-24-pdf-liaison-renseignements-email-flow.md`.
>
> Migration AcroForm limitée à **2 templates** (bulletin + sanitaire = 107
> champs). La fiche de liaison sort du scope migration : elle est envoyée
> par mail à la structure (flux papier signé + upload retour), la saisie
> en ligne a été retirée du parcours parent. La fiche de renseignements
> est également envoyée par mail (template vierge à déposer dans
> `public/templates/fiche-renseignements-template.pdf`).

## Contexte court

Les 3 PDF dossier enfant (`bulletin`, `sanitaire`, `liaison`) sont aujourd'hui
remplis par coordonnées en dur dans `app/api/dossier-enfant/[inscriptionId]/pdf/route.ts`
(appels `writeText(x, y, ...)` / `writeCheck(x, y, ...)`).

Chaque modification de template (recadrage, changement de police source,
changement de marge) casse les alignements. Bugs remontés par Thanh
(2026-04-21 et 2026-04-24) : données hors case, texte qui chevauche, cases
à cocher décalées.

**Décision validée 2026-04-24** : migrer **bulletin + sanitaire** vers
**champs AcroForm nommés**. Le template stocke les positions/polices ; le code
se contente de remplir par nom de champ. Zéro coordonnée en dur, fidélité
visuelle 100 % conservée, alignement non régressable. La liaison n'est pas
migrée (flux mail à la structure à la place, le rendu papier imprimé est
acceptable même avec des décalages mineurs que le signataire corrige à la main).

---

## 1. Ce que je dois produire (toi, utilisateur)

### 1.1 — 2 PDF templates à migrer en AcroForm + 1 template vierge à déposer

À déposer dans `public/templates/` en remplacement / complément des fichiers actuels :

| Fichier | Action | Nombre de champs | État source |
|---|---|---|---|
| `bulletin-inscription-template.pdf` | **Migrer AcroForm** | 38 champs `bulletin_*` | Zéro champ AcroForm aujourd'hui → tout créer |
| `fiche-sanitaire-template.pdf` | **Migrer AcroForm** | 69 champs `sanitaire_*` | Zéro champ AcroForm aujourd'hui → tout créer |
| `fiche-liaison-template.pdf` | ❌ Pas de migration | — | Conservé tel quel (envoyé par mail structure, rendu papier) |
| `fiche-renseignements-template.pdf` | **À déposer** (vierge) | — | Nouveau fichier à ajouter au repo ; pas de champs à créer, vierge suffit |

### 1.2 — Format

- PDF standard (pas de chiffrement, pas d'aplatissement des champs)
- Polices Helvetica sur tous les champs (contrainte pdf-lib)
- Cases à cocher : valeur cochée = `Yes`
- Export LibreOffice avec option « Créer un formulaire PDF » cochée (voir `docs/ACROFORM_GUIDE.md` §8)

### 1.3 — Dossier de dépôt

```
public/templates/
├── bulletin-inscription-template.pdf   (remplacer)
├── fiche-liaison-template.pdf          (remplacer)
└── fiche-sanitaire-template.pdf        (remplacer)
```

Conserver les **mêmes noms de fichier** — le code les référence tels quels
dans `TEMPLATE_FILES` (ligne 11-15 de `route.ts`).

### 1.4 — Bonus (optionnel mais utile)

- Un fichier `public/templates/_OLD/` contenant les 3 PDF actuels avant migration (backup 1 clic)
- Un screenshot / export de validation par template (sortie du script de vérif de `docs/ACROFORM_GUIDE.md` §9)

---

## 2. Ce que je dois lire avant d'ouvrir LibreOffice

Dans l'ordre :

1. **`docs/ACROFORM_FIELDS.md`** — liste exhaustive des 135 champs à créer/renommer avec nom exact, type, source de données, police. C'est la source de vérité.
2. **`docs/ACROFORM_GUIDE.md`** — guide pas à pas LibreOffice Draw : ouvrir le PDF, activer la barre contrôles de formulaire, créer un champ texte, créer une checkbox, renommer un champ existant, exporter au bon format, vérifier le résultat.

Temps de lecture : 15-20 min avant de commencer.

---

## 3. Ordre d'exécution recommandé

### Phase A — Préparation (15 min)

1. Lire `ACROFORM_FIELDS.md` + `ACROFORM_GUIDE.md`
2. Backup des 3 PDF actuels dans `public/templates/_OLD/`
3. Installer LibreOffice si pas déjà fait : `brew install --cask libreoffice`
4. Vérifier version : `soffice --version` (attendu : 7.0+)

### Phase B — Templates, un par un (total ~2h)

Ordre suggéré : **bulletin → sanitaire**.

- **Bulletin en premier** (45-60 min) : 38 champs à créer, template court (1 page).
  Commencer par ce template pour se familiariser avec la barre Contrôles de
  formulaire LibreOffice, sur un scope plus petit.
- **Sanitaire ensuite** (90-120 min) : 69 champs à créer dont 33 vaccins
  très répétitifs (gain d'efficacité en fin de session grâce à la pratique).

**Fiche de liaison** : aucune action. La migration AcroForm a été annulée
(ADR 2026-04-24). Le template existant est conservé tel quel pour la
génération papier envoyée à la structure.

**Fiche de renseignements** : déposer le fichier vierge
`public/templates/fiche-renseignements-template.pdf` (récupéré depuis les
documents administratifs officiels 2026). Aucun champ à créer — le PDF
vierge sera servi tel quel dans le mail à la structure.

Pour chaque template :

1. Ouvrir dans LibreOffice Draw
2. Activer la barre Contrôles de formulaire + Mode Conception
3. Créer/renommer les champs un par un en suivant la section correspondante de `ACROFORM_FIELDS.md`
4. Export PDF avec option formulaire
5. Vérifier avec le script Node de `ACROFORM_GUIDE.md` §9 → tous les noms attendus présents
6. Déposer dans `public/templates/`

### Phase C — Validation (15 min)

1. `git status` → voir les 3 PDF modifiés
2. Lancer le script de vérif sur les 3 templates → confirmer les noms de champs
3. Ne **pas** commiter tout de suite — attendre que l'IA ait refactoré le code (phase D)

### Phase D — Refacto code (fait par l'IA, pas toi, 2-3h)

Une fois les 3 PDF livrés, l'IA produira :

1. Refactor de `app/api/dossier-enfant/[inscriptionId]/pdf/route.ts` :
   - Remplacer tous les `writeText(x, y, ...)` par `form.getTextField('name').setText(...)`
   - Remplacer tous les `writeCheck(x, y, ...)` par `form.getCheckBox('name').check()` (ou rien si faux)
   - Appeler `form.updateFieldAppearances(font)` avant `form.save()`
   - Appeler `form.flatten()` AVANT `save()` si le PDF doit être non modifiable
   - Conserver les 3 `drawImage()` pour les signatures (zones image, hors AcroForm)
2. Mise à jour du test `tests/api/dossier-pdf-route.test.ts` :
   - Remplacer les assertions coord-based par des assertions field-based (`form.getTextField('bulletin_jeune_prenom').getText() === 'Jean'`)
3. Validation TSC + Jest + test manuel Thanh en preview branch
4. Un seul commit atomique de type : `feat(pdf): migrate to AcroForm named fields for alignment stability`

---

## 4. Contraintes / non-négociables

- **Fidélité visuelle 100 %** : le PDF final doit ressembler à l'œil au PDF source. AcroForm préserve le template — seul le texte/cases s'ajoutent dans les champs.
- **Nommage exact** : chaque nom de champ doit correspondre **au caractère près** à ce qui est dans `ACROFORM_FIELDS.md`. Une faute = un champ non rempli au runtime, sans erreur visible.
- **Police Helvetica** : contrainte technique pdf-lib. Toute autre police embarquée = risque de throw au runtime.
- **Pas de chiffrement / pas d'aplatissement à l'export** : voir `ACROFORM_GUIDE.md` §8.
- **Zones signature image intactes** : les 3 rectangles signature (coord x=350, y=795 / x=350, y=800 / x=410, y=805) ne doivent pas être recouverts par un champ AcroForm. Laisser ces zones vierges dans le PDF.

---

## 5. Questions fréquentes anticipées

**Q — Je peux utiliser Adobe Acrobat Pro au lieu de LibreOffice ?**
R — Oui, l'UX est meilleure. Seule obligation : nommer les champs exactement
comme dans `ACROFORM_FIELDS.md` et exporter sans chiffrement ni aplatissement.

**Q — Si je me trompe sur un nom de champ, qu'est-ce qui se passe ?**
R — Au runtime, le code fera `form.getTextField('bulletin_xxx_typo')` qui throw
`No field named bulletin_xxx_typo`. L'erreur sera visible dans Sentry /
logs Vercel → correction simple (renommer le champ et redéployer le PDF).
Aucune donnée perdue.

**Q — Je peux renommer les champs existants de la liaison au lieu de tout créer ?**
R — Oui, c'est ce qui est recommandé. Voir `ACROFORM_GUIDE.md` §7. Ne pas
supprimer/recréer — cela casse parfois la mise en page du PDF.

**Q — Je dois créer les champs en suivant exactement les coordonnées actuelles du code ?**
R — Non. AcroForm stocke la position dans le PDF lui-même. Tu positionnes
le rectangle **visuellement**, au-dessus de la ligne cible dans le template.
Les coord du code `writeText(x, y, ...)` deviennent obsolètes après la migration.

**Q — Comment tester visuellement que le rendu est correct sans toucher au code ?**
R — Dans LibreOffice Draw, désactive « Mode Conception », tape directement
dans les champs pour simuler un remplissage, puis exporte en PDF pour voir
le rendu.

**Q — Combien de temps prévoir au total ?**
R — 2-3h la première fois (tu + LibreOffice). Le refacto code par l'IA sera
fait après, en 2-3h supplémentaires. Total bout-en-bout : une demi-journée.

---

## 6. Ce qui est hors périmètre de ce chantier

- Changement du contenu graphique des templates (logo, wording, layout)
- Ajout de pages 2-3 à la liaison (usage interne GED, déjà présent mais pas rempli en ligne)
- Changement des tailles police par défaut sur le template (rester identique aux 9pt / 8pt / 7pt actuels)
- Migration d'autres PDF du repo (factures, propositions tarifaires, confirmations)

Ces points peuvent faire l'objet d'un chantier séparé plus tard.

---

## 7. Critères de succès

Avant de déclarer le chantier terminé, vérifier :

- [ ] Les 3 PDF dans `public/templates/` passent la vérif script node (voir `ACROFORM_GUIDE.md` §9)
- [ ] Les 135 champs AcroForm attendus sont présents avec noms exacts
- [ ] Les 3 zones signature image sont intactes (pas recouvertes)
- [ ] `npx tsc --noEmit` passe après refacto route.ts
- [ ] `npm run lint` passe après refacto route.ts
- [ ] Les tests Jest dossier-pdf passent après mise à jour
- [ ] Test manuel Thanh sur preview branch : bulletin + sanitaire + liaison générés, rendu visuel OK, données aux bons endroits
- [ ] Commit atomique avec message explicite + push `origin main`
- [ ] Ligne ajoutée dans `docs/TECH_DEBT.md` pour clore le point « bugs alignement PDF récurrents »

---

## 8. Fallback / plan B si la migration AcroForm échoue

Si LibreOffice Draw ne permet pas de créer des champs AcroForm propres
(cas extrême — pas observé à date), fallback sur :

- Achat d'une licence **Adobe Acrobat Pro** (30 jours gratuits en trial) pour
  créer les champs, puis annulation
- OU **PDF-XChange Editor Pro** (Windows uniquement, licence à l'unité ~40 €)
- OU en dernier recours : extraction pdfplumber des bbox + génération JSON de
  coord → consommer dans le code (plan B décrit dans l'architecture AcroForm
  rejetée, voir historique 2026-04-24)

En cas de blocage : remonter à l'IA pour brainstormer une alternative.

---

## 9. Historique décisionnel

- 2026-04-21 : Thanh remonte 1re vague de bugs alignement (décalages visibles à l'œil)
- 2026-04-24 matin : Codex session ajuste les coord en dur (commits non mergés, fix ne part pas en prod)
- 2026-04-24 midi : Thanh retest, aucune amélioration constatée (normal, rien de déployé)
- 2026-04-24 aprem : audit architecte → AcroForm identifié comme réponse structurelle
- 2026-04-24 fin : GO utilisateur, création de ce TODO.md
