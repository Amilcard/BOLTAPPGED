# Guide — Ajouter des champs AcroForm aux templates PDF

**Objectif** : ajouter (ou renommer) ~135 champs nommés dans les 3 templates PDF
GED, à partir de la liste dans `docs/ACROFORM_FIELDS.md`.

**Outils recommandés par ordre de préférence** :

1. **LibreOffice Draw** (gratuit, macOS/Windows/Linux) — ⭐ recommandé, pipeline décrit ici
2. **Adobe Acrobat Pro** (~25 €/mois) — UX plus fluide mais payant
3. **PDF-XChange Editor** (Windows, freemium) — rapide mais pas cross-platform

Ce guide couvre **LibreOffice Draw** car c'est la seule option zéro-coût,
cross-platform, qui supporte la création et le renommage de champs AcroForm
dans un PDF existant.

⚠️ **Pré-requis** : LibreOffice 7.0+ installé. Vérifier avec `soffice --version`.
Sur macOS : `brew install --cask libreoffice` (installation propre).

---

## 1. Workflow général (30–60 min par template)

1. Ouvrir le PDF template dans LibreOffice Draw (import direct, pas Writer)
2. Activer la barre « Contrôles de formulaire »
3. Pour chaque champ de la liste :
   - Dessiner le rectangle à la bonne position
   - Double-cliquer pour ouvrir les propriétés
   - Renseigner le **Nom** (exact, copié depuis `ACROFORM_FIELDS.md`)
   - Ajuster taille police / multiline si nécessaire
4. Exporter en PDF avec « Créer un formulaire PDF » coché
5. Vérifier avec un script pdf-lib que les champs sont présents
6. Déposer le PDF final dans `public/templates/`

---

## 2. Ouvrir un PDF existant dans LibreOffice Draw

### macOS

```bash
# Ouvrir explicitement avec Draw (pas Writer qui reformate tout)
soffice --draw public/templates/bulletin-inscription-template.pdf
```

### Alternative GUI

- Ouvrir **LibreOffice Start Center**
- Menu : `Fichier` → `Ouvrir...` → choisir le PDF
- Une boîte de dialogue demande le format : sélectionner **« PDF — Draw »** (pas Writer)

LibreOffice Draw affiche le PDF page par page sans le reformater. C'est essentiel :
Draw préserve les coordonnées, positions, images et polices du PDF source, alors
que LibreOffice Writer le re-layout comme un doc Word et casse la mise en page.

---

## 3. Activer la barre « Contrôles de formulaire »

Menu : `Affichage` → `Barres d'outils` → cocher `Contrôles de formulaire`

Une nouvelle barre apparaît avec :

- **Zone de texte** (icône avec « ab| ») → pour les champs `text` et `text_wrap`
- **Case à cocher** (icône carré coché) → pour les champs `check`
- **Mode Conception** (icône règle/équerre) → **DOIT être activé** pour créer/éditer

⚠️ **Toujours vérifier que « Mode Conception » est actif** (icône allumée).
En mode normal, double-clic = remplir le champ (pas l'éditer).

---

## 4. Créer un champ texte

### Étapes

1. Sélectionner l'outil **Zone de texte** dans la barre Contrôles de formulaire
2. Tracer un rectangle sur le PDF **au-dessus de la ligne d'écriture cible**
3. Double-cliquer sur le champ créé → onglet **Propriétés** s'ouvre à droite
4. Dans **Général** :
   - **Nom** : nom exact du champ (ex. `bulletin_jeune_prenom`)
   - **Libellé** : laisser vide (uniquement utile pour les formulaires HTML)
   - **Titre** : laisser vide
   - **Valeur par défaut** : laisser vide
5. Dans **Police** :
   - **Police** : Helvetica (obligatoire — pdf-lib ne peut remplir que les polices embarquées standard)
   - **Taille** : 9 par défaut, ou 8/7 selon `ACROFORM_FIELDS.md`
6. **Bordure** : choisir « Aucune » (sinon la bordure apparaît dans le PDF final)
7. **Couleur** : noir ou gris foncé (code hex `#1a1a1a` si pertinent)

### Pour un champ `text_wrap` (multiligne)

Même procédure, plus :

- Dans les propriétés : cocher **Plusieurs lignes** / **Multiline**
- Redimensionner le rectangle pour accueillir 2-3 lignes visuelles
- Option : cocher **Retour à la ligne automatique** si disponible

---

## 5. Créer une case à cocher

1. Sélectionner l'outil **Case à cocher** dans la barre Contrôles de formulaire
2. Tracer un petit carré (~10×10 px) sur la case d'origine du template PDF
3. Double-cliquer → propriétés
4. **Nom** : nom exact du champ (ex. `bulletin_financement_ase`)
5. **Libellé** : laisser vide (sinon LibreOffice affiche du texte à côté de la case)
6. **État par défaut** : « Non sélectionné »
7. **Valeur de référence (sélectionné)** : `Yes` (standard PDF/AcroForm)
8. **Valeur de référence (non sélectionné)** : laisser vide ou `Off`

⚠️ **Critique** : la valeur cochée **doit** être `Yes` exactement — c'est ce que
`pdf-lib` attend dans `form.getCheckBox(name).check()`. Toute autre valeur
(`On`, `1`, `true`) empêchera le cochage depuis le code.

---

## 6. Positionner précisément un champ

### Astuce 1 — coordonnées absolues

Sélectionner le champ → appuyer sur **F4** (ou menu `Format` → `Position et taille`).
Une boîte permet de saisir X / Y / Largeur / Hauteur au pixel près.

### Astuce 2 — aligner plusieurs champs

Sélectionner plusieurs champs (Ctrl+clic) → clic droit → **Alignement** →
`Aligné à gauche`, `Aligné en haut`, etc. Essentiel pour les groupes
radio/checkboxes sur une même ligne.

### Astuce 3 — grille d'aide

Menu : `Affichage` → `Grille` → activer `Afficher la grille` + `Aligner sur la grille`.
Précision par défaut : 0,1 cm, réglable dans `Outils` → `Options` → `LibreOffice Draw` → `Grille`.

---

## 7. Renommer les champs existants (liaison — 86 champs génériques)

Le template `fiche-liaison-template.pdf` contient déjà 86 champs nommés
`Champ texte0` à `Champ texte85`. Il ne faut **pas** les supprimer/recréer
(cela casserait les IDs internes du PDF). Plutôt :

1. Activer **Mode Conception** dans la barre Contrôles de formulaire
2. Double-cliquer sur chaque champ
3. Remplacer le nom par celui de `ACROFORM_FIELDS.md` section 3
4. Vérifier qu'aucun doublon n'est créé (LibreOffice accepte parfois les doublons en silence)

Pour les champs `Champ texte*` qui ne correspondent à aucun champ cible dans
`ACROFORM_FIELDS.md` (reste du template pour pages 2-3 usage interne GED) :
renommer avec un préfixe neutre `liaison_interne_XX` et ne pas les utiliser
dans le code runtime. Ne pas les supprimer — la suppression casse parfois la
mise en page.

---

## 8. Exporter en PDF avec formulaire

Menu : `Fichier` → `Exporter en PDF…`

Cocher impérativement :

- ✅ **Créer un formulaire PDF** (onglet « Général »)
- ✅ Format de soumission : **FDF** (recommandé pour compat pdf-lib)
- ✅ **Exporter les noms de champ structurés** (si option présente)
- ❌ **NE PAS cocher** « Aplatir les champs de formulaire » (sinon tous les champs deviennent du texte statique et on perd tout le bénéfice)

Autres paramètres :

- ✅ Conservation des images : qualité 100 % (JPEG ou sans perte selon le template)
- ✅ **PDF/A-2b** si possible (archivage long terme — recommandé pour GED)
- ❌ Chiffrement : désactivé (sinon pdf-lib ne peut pas écrire les champs)

Sauvegarder avec un nom qui conserve la convention actuelle :

- `bulletin-inscription-template.pdf`
- `fiche-sanitaire-template.pdf`
- `fiche-liaison-template.pdf`

---

## 9. Vérifier que les champs sont bien nommés

Avant de remplacer les templates en production, vérifier avec un script Node :

```bash
# Créer un helper de vérification (à exécuter depuis la racine du projet)
node -e "
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = process.argv[1] || 'public/templates/bulletin-inscription-template.pdf';
(async () => {
  const bytes = fs.readFileSync(path);
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();
  const fields = form.getFields();
  console.log(\`Total: \${fields.length} champs AcroForm\`);
  fields.forEach(f => console.log(\`  - \${f.getName()} (\${f.constructor.name})\`));
})();
" public/templates/bulletin-inscription-template.pdf
```

La sortie doit lister tous les champs attendus avec leurs noms sémantiques.
Tout champ nommé `Champ texte*`, `Text1`, `Checkbox2` (auto-générés par
l'outil de création) = signal qu'un renommage a été oublié.

---

## 10. Checklist de validation par template

Avant de merger le PDF dans `public/templates/`, vérifier :

### Bulletin

- [ ] 38 champs nommés `bulletin_*`
- [ ] 3 cases à cocher `bulletin_envoi_fiche_liaison_*` mutuellement exclusives (groupe radio ou 3 check indépendants)
- [ ] 4 cases à cocher `bulletin_financement_*`
- [ ] Triplet date signature (`_jour`, `_mois`, `_annee`) en champs séparés
- [ ] Zone signature image à `page=0, x=350, y=795` intacte (pas de champ AcroForm dessus)

### Sanitaire

- [ ] 69 champs nommés `sanitaire_*`
- [ ] Triplet date de naissance (`_jour`, `_mois`, `_annee`)
- [ ] Tous les 33 champs vaccins présents (11 lignes × 3)
- [ ] Champ ROR partagé : `_rougeole`, `_oreillons`, `_rubeole` tous présents (même valeur au runtime, mais 3 champs distincts dans le PDF)
- [ ] 7 champs `text_wrap` (multiline) pour les zones libres (traitement détail, allergie détail, probleme santé, recommandations, remarques)
- [ ] Zone signature image à `page=1, x=350, y=800`

### Liaison

- [ ] 28 champs nommés `liaison_*`
- [ ] Les 58 champs résiduels `Champ texte*` (86 − 28) renommés `liaison_interne_*` OU documentés comme ignorés
- [ ] 6 checkboxes `liaison_choix_*` (3 paires oui/non)
- [ ] 2 checkboxes `liaison_deja_parti_*`
- [ ] 2 checkboxes `liaison_fiche_technique_lue_*`
- [ ] Zone signature image à `page=0, x=410, y=805`

---

## 11. Pièges connus — à anticiper

| Piège | Symptôme | Solution |
|---|---|---|
| Police non embarquée | pdf-lib throw `No font \`XYZ\` found` au runtime | Forcer Helvetica sur tous les champs lors de la création |
| Chiffrement PDF activé | pdf-lib throw `Input is encrypted` | Décocher le chiffrement à l'export |
| Champ name avec espace | `getTextField('foo bar')` ne trouve rien | Renommer en `snake_case` strict |
| Aplatissement à l'export | Champs disparus dans le PDF final | Décocher « Aplatir les champs » dans le dialogue d'export |
| Checkbox valeur `Off` au lieu de `Yes` | `form.getCheckBox(n).check()` throws ou cocher silencieux | Redéfinir la valeur `Yes` dans propriétés du champ |
| Appearance streams manquants | Champ présent mais rien ne s'affiche après remplissage | Dans le code : `form.updateFieldAppearances(font)` avant `form.flatten()` |
| Doublon de nom | LibreOffice accepte, pdf-lib remplit le 1er trouvé | Vérifier avec le script de l'étape 9, corriger à la main |

---

## 12. Temps estimé par template

| Template | Nombre de champs | Temps estimé (1re fois) | Temps estimé (avec expérience) |
|---|---|---|---|
| Bulletin | 38 | 45-60 min | 20 min |
| Sanitaire | 69 | 90-120 min | 45 min |
| Liaison (renommage) | 28 / 86 | 30-45 min | 20 min |
| **Total** | **135** | **~3h** | **~1h30** |

Prévoir une session dédiée de 2-3h avec pause. Travailler template par template
et valider chacun avec le script de l'étape 9 avant de passer au suivant.
