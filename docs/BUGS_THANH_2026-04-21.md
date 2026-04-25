# Bugs Thanh — Test terrain 2026-04-21 (cartographie 2026-04-25 / diagnostic 2026-04-25)

## Statut diagnostic 2026-04-25

| Item | Réalité vérifiée |
|---|---|
| Branche orpheline `claude/lucid-leavitt-6aa6a9` | 2 commits (refactor + fix signature) déjà re-portés sur main via `dbbd372` + `4d6c335` → **obsolète** |
| `lib/pdf-dossier.ts` | N'existe PAS sur main — refactor non mergé. Tout est dans `route.ts` (625 lignes) |
| Source des bugs | `route.ts` L317-320 (financement Y) + L456-457 (traitement OUI/NON X) — bugs toujours présents |
| Coords extraites via `pdftotext -bbox` | OUI label xMin=450.35 / NON label xMin=517.41 / financement labels yMin=620 |

### Corrections Phase 1 — confirmées ≥95% (prêtes à coder)

| Bug | Ligne | Avant | Après | Source |
|---|---|---|---|---|
| SAN-TRAITEMENT OUI | L456 | `writeCheck(1, 520, 258, …)` | `writeCheck(1, **437**, 258, …)` | bbox OUI xMin=450 |
| SAN-TRAITEMENT NON | L457 | `writeCheck(1, 578, 258, …)` | `writeCheck(1, **505**, 258, …)` | bbox NON xMin=517 |
| BUL-FINANCEMENT ASE | L317 | `Y=580` | `Y=**636**` | bbox financement yMin=620 |
| BUL-FINANCEMENT ETABL | L318 | `Y=596` | `Y=**636**` | idem |
| BUL-FINANCEMENT FAMILLE | L319 | `Y=612` | `Y=**636**` | idem |
| BUL-FINANCEMENT AUTRES | L320 | `Y=628` | `Y=**636**` | idem |

### Corrections Phase 2 — appliquées 2026-04-25, à confirmer visuellement après re-génération PDF

| Bug | Avant | Après | Statut |
|---|---|---|---|
| SAN-VACCINS-MIDDLE yesX | 332 | **380** | ⚠️ Estimé (bbox vectoriel) — vérif visuelle requise |
| SAN-VACCINS-MIDDLE noX | 347 | **395** | idem |
| SAN-VACCINS-MIDDLE dateX | 378 | **425** | idem |
| BUL-COCHAGE-ADRESSE X=265 | inchangé | inchangé | À confirmer : X dans col FICHE, overlap visuel fond orange |
| BUL-SOUSSIGNE X=102 | inchangé | inchangé | Probablement OK (2px après label xMax=99.707) |

Commit Phase 2 : `1e06682` — vérifier sur re-génération PDF fiche sanitaire page 2 section vaccinations.

Source : 11 captures `/Users/laidhamoudi/Downloads/Capture-Problème-Fiche Téléchargé`
+ 3 PDF générés (Bulletin, Liaison, Sanitaire). Fausses données test (Mia Laurent /
Emma Laurent / Camille Roux / Lyon). **Pas de PII réelle.**

Cross-check : `app/api/dossier-enfant/[inscriptionId]/pdf/route.ts` + `public/templates/*.pdf`.

> **NB** : la **fiche de liaison n'est plus migrée AcroForm** depuis ADR
> 2026-04-24 (envoyée par mail papier signé). Les bugs `LIAI-*` ci-dessous sont
> à fixer en rustine directe sur coords OU à abandonner si liaison reste hors
> ligne. Confirmer décision avant fix.

## Synthèse

| # | ID | Doc | Sévérité | Cause racine | Cible fix |
|---|---|---|---|---|---|
| 1 | BUL-COCHAGE-ADRESSE | Bulletin | P1 | Cochage `envoi_fiche_liaison` empiète sur label "Adresse permanente" | route.ts L306 — `writeCheck(0, 265, 375)` |
| 2 | BUL-LIEN-TEL-VIDES | Bulletin | P2 | Lignes "Lien avec l'enfant" / "Téléphone" haut tableau jamais remplies | Champs absents form OU coords manquantes section adresse |
| 3 | BUL-FINANCEMENT-100-EMPIETE | Bulletin | P1 | Valeur "100" empiète sur label "Financement du séjour" | route.ts L322 — Y=660 trop haut |
| 4 | BUL-X-FUITE-TELEPHONE-SERVICE | Bulletin | P1 | X cochage déborde dans label "TÉLÉPHONE :" sous SERVICE DEMANDEUR | route.ts L317 — `writeCheck(0, 175, 580)` X-coord collision |
| 5 | BUL-SOUSSIGNE-OVERFLOW | Bulletin | P1 | "Marie Martin" déborde sur "Je soussigné(e)" | route.ts L326 — X=102 trop à gauche |
| 6 | BUL-RESPONSABLE-MINEUR-VIDE | Bulletin | P2 | Ligne pointillée "responsable légal de l'enfant" vide | route.ts L327 — `${prenom} ${nom}` à coords 370,703 OU donnée vide |
| 7 | BUL-DATE-DOUBLEE-FAIT-A | Bulletin | P1 | "23/04/2026" écrit en entier alors que "/2026" pré-imprimé sur template | route.ts L333-334 — vérifier `getDateParts`, suspect : la date complète passe à `parts[0]` |
| 8 | SAN-DATE-NAISSANCE-MONO-BLOC | Sanitaire | P1 | "01/01/2020" dans 1er bloc seul, 2 autres blocs vides | route.ts L353 — `writeDateTriplet` ne split pas (format ISO `2020-01-01` ?) |
| 9 | SAN-EMAILS-TRONQUES | Sanitaire | P1 | Mails Resp1/Resp2 affichés sans @ (`emmalaurent`, `camilleroux`) | route.ts L370 (maxWidth=320) + L383 (maxWidth=220) — wrap coupe le @ |
| 10 | SAN-VACCINS-X-OVERFLOW-MIDDLE | Sanitaire | P1 | Colonne X verticaux dans le séparateur entre obligatoires/recommandés | route.ts L431-432 — `vaccineColumns.middle` `yesX=332 / noX=347` calibrés faux |
| 11 | SAN-TRAITEMENT-X-EMPIETE-NON | Sanitaire | P1 | X "NON" traitement médical déborde sur le label "NON" | route.ts L457 — `writeCheck(1, 578, 258)` X-coord collision label |
| 12 | SAN-DATE-SIGNATURE-VIDES | Sanitaire | P1 | Bas page 2 "Date*:" + "Signature obligatoire*:" vides | route.ts L489 — `writeText(1, 145, 793, date_signature)` coords ne tombent pas sous le label OU champ non rempli |
| 13 | LIAI-FAIT-A-LE-AU-DESSUS | Liaison | OBSOLÈTE | "Lyon" / "24/04/2026" placés au-dessus de "Fait à : ……… le ………" | route.ts L542-543 — Y=776 trop haut. **Liaison hors AcroForm depuis 2026-04-24** |

## Détails techniques

### BUL-COCHAGE-ADRESSE (#1)

Capture : 1er bulletin. Le X coché pour "Adresse permanente" déborde
visuellement sur le tableau "Documents à envoyer à*" / "FICHE DE LIAISON ET
TROUSSEAU". Les lignes "Lien avec l'enfant : ……" et "Téléphone : ……" en haut
du tableau ne sont pas remplies.

Code : `writeCheck(0, 265, 375, envoiFicheLiaison === 'permanente')` — Y=375
correspond à la ligne "Adresse permanente", X=265 = colonne FICHE DE LIAISON.
Visuellement le X glyph débord à gauche (alignement baseline + size=11 bold).

### BUL-DATE-DOUBLEE-FAIT-A (#7)

Capture 3 : `Lyon  ............. le …… /…… / 2026 23/04/2026 ✍`. La date
complète apparaît à droite alors que le template a déjà `/ 2026` pré-imprimé.

Hypothèse 1 : `getDateParts(d.date_signature)` retourne `null` → fallback
vers `dossierDate` qui est écrit ailleurs ?
Hypothèse 2 : autre `writeText` à coords 333,743 écrit la date complète plutôt
que jour+mois.

À vérifier en runtime avant fix.

### SAN-DATE-NAISSANCE-MONO-BLOC (#8)

Capture 1 sanitaire : `Date de naissance*: 01/01/2020/ ……….. / ………..`. La
date entière est écrite dans le bloc `dayX`, les blocs `monthX` et `yearX`
restent vides.

Code : `writeDateTriplet(0, { dayX: 138, monthX: 234, yearX: 332, y: 216 }, inscription.jeune_date_naissance)` — la fonction split
correctement si `getDateParts` reçoit une date au format DD/MM/YYYY. Suspect :
`inscription.jeune_date_naissance` arrive au format `2020-01-01` (ISO Postgres
`date`) → `getDateParts` split sur `/` retourne 1 seul élément, fallback ligne
192 écrit `value` entier dans dayX.

Fix attendu : `getDateParts` gérer aussi format ISO OU normaliser en amont.

### SAN-EMAILS-TRONQUES (#9)

Captures 2 sanitaire : Resp1 mail = `emmalaurent` (sans @), Resp2 mail =
`camilleroux` (sans @). Les emails de test étaient probablement
`emma.laurent@example.fr` et `camille.roux@example.fr`.

Code : `writeWrappedText(0, 230, 472, email1, { size: smallFontSize, maxWidth: 320, lineHeight: 18, maxLines: 2 })`.
La largeur 320 px à 8pt suffit ~50 chars, donc l'email devrait passer entier.
Suspect : la fonction `writeWrappedText` casse au @ (caractère séparateur)
et la 2e ligne (`@example.fr`) est masquée par d'autres champs dessus.

À vérifier : ouvrir `Fiche_sanitaire (5).pdf` et regarder la 2e ligne en
zoom 200 %.

### SAN-VACCINS-X-OVERFLOW-MIDDLE (#10)

Capture 3 sanitaire : colonne verticale de X dans la zone séparateur entre
"Vaccins obligatoires pour tous" et "Vaccins recommandés pour les enfants…"
(visuellement tombe sur les labels "Coqueluche", "Haemophilus", "Rubéole/
Oreillons/Rougeole").

Code : `vaccineColumns.middle = { yesX: 332, noX: 347, dateX: 378 }` mais
visuellement les X tombent autour de X=350 sur le séparateur central du
tableau, pas dans la case OUI de la colonne du milieu.

Cause : coords pifomètre obsolètes vs template actuel. Calibration à refaire.

### SAN-TRAITEMENT-X-EMPIETE-NON (#11)

Capture 4 sanitaire : `Votre enfant suit un traitement médical pendant l'accueil : OUI ⊘ NON ⊘` avec un X sur "NON" qui déborde sur le mot "NON".

Code : `writeCheck(1, 578, 258, traitement === 'false')` — X=578 trop à gauche
(devrait être la case carrée à droite du label "NON", pas la lettre "N").

### LIAI-* (#13 + observé en Capture 1 liaison)

ENGAGEMENT : "Lyon" / "24/04/2026" placés AU-DESSUS de la ligne "Fait à :
……… le ………" au lieu de DEDANS (overflow vertical Y=776 trop haut).

PARTIE A REMPLIR PAR LE JEUNE : 3 cochages "oui/non" décalés (le crochet
déborde sur le mot "oui").

**Décision produit nécessaire** : la fiche de liaison est désormais hors
flux numérique (envoyée mail signé). Fix coords pas prioritaire SAUF si
elle redevient PDF auto-généré.

## Mapping vers fix

| Stratégie | Couvre | Effort | Risque |
|---|---|---|---|
| **A — Rustine coords** sur les 12 bugs P1 (bulletin + sanitaire) | #1, #3, #4, #5, #7, #8, #9, #10, #11, #12 | 2-3h calibration template par template | Faible — diff isolé route.ts |
| **B — Migration AcroForm** (Phase B existante : `scripts/pdf/build-acroform-text-fields.ts`) puis refacto route.ts → `form.getTextField('name').setText(value)` | Tous les bugs alignement définitivement | 1-2 jours (script déjà écrit, refacto route.ts à faire) | Moyen — change pipeline rendu, tests E2E nécessaires |
| **C — Hybride** : rustine A immédiate + migration B en parallèle pour livrer fix avant Phase B mature | Tous | 3-4h + work background | Faible si commits séparés |

## Backlog post-cartographie

- [ ] Décision A / B / C (utilisateur)
- [ ] Si A : ouvrir une preview branch Supabase + tester chaque bug avec données réalistes (incl. email avec @, date ISO `YYYY-MM-DD`)
- [ ] Si B : finir Phase B (script Acroform existe, migration route.ts à écrire)
- [ ] Confirmer scope liaison (#13) : fix coords ou abandon ?
- [ ] Re-test Thanh sur preview branch avant push prod
