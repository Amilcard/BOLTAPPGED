# ACROFORM — Liste exhaustive des champs à créer

> **SCOPE RÉDUIT 2026-04-24** — migration AcroForm limitée à **2 templates**
> (bulletin + sanitaire = **107 champs**). La fiche de liaison est désormais
> envoyée par mail à la structure (flux papier signé + upload retour). Voir
> `docs/adr/2026-04-24-pdf-liaison-renseignements-email-flow.md`. La section 3
> ci-dessous est conservée à titre d'archive — **ne pas migrer en AcroForm**.

**Objectif** : migrer les 2 templates PDF (bulletin, sanitaire) vers des
**champs AcroForm nommés sémantiquement** pour supprimer définitivement les bugs
d'alignement liés aux coordonnées en dur dans `app/api/dossier-enfant/[inscriptionId]/pdf/route.ts`.

**Source de vérité** : extraction ligne par ligne du code actuel de `route.ts`
(commit de travail 2026-04-24). Chaque champ listé ci-dessous correspond à un
appel `writeText()` ou `writeCheck()` existant. Aucun champ inventé.

**Nommage** : `snake_case`, préfixé par domaine. Pas d'accents. Un champ = une
donnée atomique (pas de concat dans le nom).

**Types AcroForm utilisés** :
- `text` — champ texte simple
- `text_wrap` — texte multi-lignes (même type AcroForm `text` mais avec option « multiline »)
- `check` — case à cocher (valeur `Yes` si cochée, sinon vide)

**Source Supabase** : chemin dans le JSONB `gd_dossier_enfant.*` ou
`gd_inscriptions.*`. Si le chemin est `inscription.X` → colonne directe.

---

## 1. Bulletin d'inscription (`bulletin-inscription-template.pdf`, 1 page)

### 1.1 — Coordonnées (page 1, haut)

| Champ AcroForm | Type | Source Supabase | Longueur max |
|---|---|---|---|
| `bulletin_jeune_prenom` | text | `inscription.jeune_prenom` | 40 |
| `bulletin_jeune_date_naissance` | text | `inscription.jeune_date_naissance` formaté DD/MM/YYYY | 10 |
| `bulletin_jeune_nom` | text | `bulletin_complement.nom_famille` ∨ `inscription.jeune_nom` | 40 |
| `bulletin_jeune_sexe` | text | `fiche_sanitaire.sexe` (long) ∨ map(`inscription.jeune_sexe`) | 10 |
| `bulletin_referent_nom` | text | `inscription.referent_nom` | 40 |
| `bulletin_referent_tel` | text | `fiche_sanitaire.resp1_tel_portable` | 20 |
| `bulletin_adresse_permanente` | text | `bulletin_complement.adresse_permanente` | 80 |
| `bulletin_mail` | text | `bulletin_complement.mail` ∨ `inscription.referent_email` | 60 |

### 1.2 — Séjour choisi (page 1)

| Champ AcroForm | Type | Source | Taille police |
|---|---|---|---|
| `bulletin_sejour_nom` | text | `gd_stays.marketing_title` ∨ slug | 8pt |
| `bulletin_session_date` | text | `inscription.session_date` formaté | 8pt |
| `bulletin_city_departure` | text | `inscription.city_departure` | 8pt |

### 1.3 — Organisation départ / retour (page 1)

| Champ AcroForm | Type | Source |
|---|---|---|
| `bulletin_adresse_depart_nom` | text | `bulletin_complement.adresse_depart_nom` |
| `bulletin_adresse_depart_adresse` | text | `bulletin_complement.adresse_depart_adresse` |
| `bulletin_adresse_depart_lien` | text | `bulletin_complement.adresse_depart_lien` |
| `bulletin_adresse_depart_telephone` | text | `bulletin_complement.adresse_depart_telephone` |
| `bulletin_adresse_retour_nom` | text | `bulletin_complement.adresse_retour_nom` |
| `bulletin_adresse_retour_adresse` | text | `bulletin_complement.adresse_retour_adresse` |
| `bulletin_adresse_retour_lien` | text | `bulletin_complement.adresse_retour_lien` |
| `bulletin_adresse_retour_telephone` | text | `bulletin_complement.adresse_retour_telephone` |

### 1.4 — Envoi fiche de liaison (3 cases mutuellement exclusives — groupe radio recommandé)

| Champ AcroForm | Type | Cochée si |
|---|---|---|
| `bulletin_envoi_fiche_liaison_permanente` | check | `bulletin_complement.envoi_fiche_liaison === 'permanente'` |
| `bulletin_envoi_fiche_liaison_depart` | check | `bulletin_complement.envoi_fiche_liaison === 'depart'` |
| `bulletin_envoi_fiche_liaison_retour` | check | `bulletin_complement.envoi_fiche_liaison === 'retour'` |

### 1.5 — Contact urgence (page 1)

| Champ AcroForm | Type | Source |
|---|---|---|
| `bulletin_contact_urgence_nom` | text | `bulletin_complement.contact_urgence_nom` |
| `bulletin_contact_urgence_adresse` | text | `bulletin_complement.contact_urgence_adresse` |
| `bulletin_contact_urgence_lien` | text | `bulletin_complement.contact_urgence_lien` |
| `bulletin_contact_urgence_telephone` | text | `bulletin_complement.contact_urgence_telephone` |

### 1.6 — Financement (4 cases à cocher + 1 champ montants)

| Champ AcroForm | Type | Source |
|---|---|---|
| `bulletin_financement_ase` | check | `bulletin_complement.financement_ase === true \| 'true'` |
| `bulletin_financement_etablissement` | check | `bulletin_complement.financement_etablissement === true \| 'true'` |
| `bulletin_financement_famille` | check | `bulletin_complement.financement_famille === true \| 'true'` |
| `bulletin_financement_autres` | check | `bulletin_complement.financement_autres === true \| 'true'` |
| `bulletin_financement_montants` | text | `bulletin_complement.financement_montants` (8pt, max 20) |

### 1.7 — Autorisation légale (page 1, bas)

| Champ AcroForm | Type | Source |
|---|---|---|
| `bulletin_soussigne_nom` | text | `bulletin_complement.soussigne_nom` ∨ `inscription.referent_nom` |
| `bulletin_jeune_nom_complet` | text | `inscription.jeune_prenom` + ' ' + `jeune_nom_display` (max 40) |
| `bulletin_autorisation_fait_a` | text | `bulletin_complement.autorisation_fait_a` |
| `bulletin_date_signature_jour` | text | jour DD (max 2) |
| `bulletin_date_signature_mois` | text | mois MM (max 2) |
| `bulletin_date_signature_annee` | text | année YYYY (max 4) |

### 1.8 — Signature bulletin (image)

Pas un champ AcroForm — **zone d'embed d'image PNG** via `pdfDoc.embedPng()`.
À conserver tel quel dans le code (coord explicite `page=0, x=350, y=795, w=120, h=25`).

**Total bulletin : 38 champs AcroForm (29 text + 9 check + 3 date)**

---

## 2. Fiche sanitaire (`fiche-sanitaire-template.pdf`, 2 pages)

### 2.1 — PAGE 1 — Section « L'ENFANT »

| Champ AcroForm | Type | Source |
|---|---|---|
| `sanitaire_classe` | text | `fiche_sanitaire.classe` |
| `sanitaire_jeune_nom` | text | `jeune_nom_display` |
| `sanitaire_sexe_garcon` | check | `fiche_sanitaire.sexe === 'garcon'` |
| `sanitaire_sexe_fille` | check | `fiche_sanitaire.sexe === 'fille'` |
| `sanitaire_jeune_prenom` | text | `inscription.jeune_prenom` |
| `sanitaire_naissance_jour` | text | DD (max 2) |
| `sanitaire_naissance_mois` | text | MM (max 2) |
| `sanitaire_naissance_annee` | text | YYYY (max 4) |
| `sanitaire_sieste_oui` | check | `fiche_sanitaire.sieste === 'oui'` |
| `sanitaire_sieste_non` | check | `fiche_sanitaire.sieste === 'non'` |
| `sanitaire_pai` | check | `fiche_sanitaire.pai === true \| 'true'` |
| `sanitaire_aeeh` | check | `fiche_sanitaire.aeeh === true \| 'true'` |

### 2.2 — PAGE 1 — Section « RESPONSABLE 1 »

| Champ AcroForm | Type | Source |
|---|---|---|
| `sanitaire_resp1_nom` | text | `fiche_sanitaire.resp1_nom` |
| `sanitaire_resp1_prenom` | text | `fiche_sanitaire.resp1_prenom` |
| `sanitaire_resp1_parente` | text | `fiche_sanitaire.resp1_parente` |
| `sanitaire_resp1_adresse` | text | `fiche_sanitaire.resp1_adresse` (8pt) |
| `sanitaire_resp1_adresse_suite` | text | `fiche_sanitaire.resp1_adresse_suite` (8pt) |
| `sanitaire_resp1_cp_ville` | text | `fiche_sanitaire.resp1_cp_ville` (8pt) |
| `sanitaire_resp1_profession` | text | `fiche_sanitaire.resp1_profession` |
| `sanitaire_resp1_email` | text_wrap | `fiche_sanitaire.resp1_email` (8pt, wrap sur 2 lignes) |
| `sanitaire_resp1_tel_domicile` | text | `fiche_sanitaire.resp1_tel_domicile` |
| `sanitaire_resp1_tel_portable` | text | `fiche_sanitaire.resp1_tel_portable` |
| `sanitaire_resp1_tel_travail` | text | `fiche_sanitaire.resp1_tel_travail` |

### 2.3 — PAGE 1 — Section « RESPONSABLE 2 »

Mêmes 11 champs que RESP1, préfixe `sanitaire_resp2_*`. Tous les chemins dans `fiche_sanitaire.resp2_*`.

| Champ AcroForm |
|---|
| `sanitaire_resp2_nom` |
| `sanitaire_resp2_prenom` |
| `sanitaire_resp2_parente` |
| `sanitaire_resp2_adresse` |
| `sanitaire_resp2_adresse_suite` |
| `sanitaire_resp2_cp_ville` |
| `sanitaire_resp2_profession` |
| `sanitaire_resp2_email` (text_wrap) |
| `sanitaire_resp2_tel_domicile` |
| `sanitaire_resp2_tel_portable` |
| `sanitaire_resp2_tel_travail` |

### 2.4 — PAGE 1 — CAF/QF

| Champ AcroForm | Source |
|---|---|
| `sanitaire_allocataire_caf_msa` | `fiche_sanitaire.allocataire_caf_msa` |
| `sanitaire_quotient_familial` | `fiche_sanitaire.quotient_familial` |

### 2.5 — PAGE 1 — Délégations (3 lignes × 4 colonnes)

| Champ AcroForm | Type | Source |
|---|---|---|
| `sanitaire_delegation_1_nom` | text | `fiche_sanitaire.delegation_1_nom` |
| `sanitaire_delegation_1_prenom` | text | `fiche_sanitaire.delegation_1_prenom` |
| `sanitaire_delegation_1_lien` | text | `fiche_sanitaire.delegation_1_lien` |
| `sanitaire_delegation_1_tel` | text | `fiche_sanitaire.delegation_1_tel` |
| `sanitaire_delegation_2_nom` | text | `fiche_sanitaire.delegation_2_nom` |
| `sanitaire_delegation_2_prenom` | text | `fiche_sanitaire.delegation_2_prenom` |
| `sanitaire_delegation_2_lien` | text | `fiche_sanitaire.delegation_2_lien` |
| `sanitaire_delegation_2_tel` | text | `fiche_sanitaire.delegation_2_tel` |
| `sanitaire_delegation_3_nom` | text | `fiche_sanitaire.delegation_3_nom` |
| `sanitaire_delegation_3_prenom` | text | `fiche_sanitaire.delegation_3_prenom` |
| `sanitaire_delegation_3_lien` | text | `fiche_sanitaire.delegation_3_lien` |
| `sanitaire_delegation_3_tel` | text | `fiche_sanitaire.delegation_3_tel` |

### 2.6 — PAGE 2 — Médecin référent

| Champ AcroForm | Source |
|---|---|
| `sanitaire_medecin_nom` | `fiche_sanitaire.medecin_nom` |
| `sanitaire_medecin_tel` | `fiche_sanitaire.medecin_tel` |

### 2.7 — PAGE 2 — Vaccinations (11 vaccins × 3 champs = 33 champs)

Pour chaque vaccin, 3 champs : `_oui` (check), `_non` (check), `_date` (text).

| Préfixe | Clé source oui/non | Clé source date |
|---|---|---|
| `sanitaire_vaccin_diphterie` | `vaccin_diphterie` | `vaccin_diphterie_date` |
| `sanitaire_vaccin_tetanos` | `vaccin_tetanos` | `vaccin_tetanos_date` |
| `sanitaire_vaccin_poliomyelite` | `vaccin_poliomyelite` | `vaccin_poliomyelite_date` |
| `sanitaire_vaccin_coqueluche` | `vaccin_coqueluche` | `vaccin_coqueluche_date` |
| `sanitaire_vaccin_haemophilus` | `vaccin_haemophilus` | `vaccin_haemophilus_date` |
| `sanitaire_vaccin_hepatite_b` | `vaccin_hepatite_b` | `vaccin_hepatite_b_date` |
| `sanitaire_vaccin_rougeole` | `vaccin_rubeole_oreillons_rougeole` (ROR) | `vaccin_rubeole_oreillons_rougeole_date` |
| `sanitaire_vaccin_oreillons` | `vaccin_rubeole_oreillons_rougeole` (ROR) | `vaccin_rubeole_oreillons_rougeole_date` |
| `sanitaire_vaccin_rubeole` | `vaccin_rubeole_oreillons_rougeole` (ROR) | `vaccin_rubeole_oreillons_rougeole_date` |
| `sanitaire_vaccin_meningocoque_c` | `vaccin_meningocoque_c` | `vaccin_meningocoque_c_date` |
| `sanitaire_vaccin_pneumocoque` | `vaccin_pneumocoque` | `vaccin_pneumocoque_date` |

Pour chaque ligne ci-dessus → 3 champs : `<prefix>_oui`, `<prefix>_non`, `<prefix>_date`.

Exemple concret pour diphtérie :
- `sanitaire_vaccin_diphterie_oui` (check)
- `sanitaire_vaccin_diphterie_non` (check)
- `sanitaire_vaccin_diphterie_date` (text, 7pt, max 12)

### 2.8 — PAGE 2 — Renseignements médicaux

| Champ AcroForm | Type | Source |
|---|---|---|
| `sanitaire_poids` | text | `fiche_sanitaire.poids` |
| `sanitaire_taille` | text | `fiche_sanitaire.taille` |
| `sanitaire_traitement_en_cours_oui` | check | `traitement_en_cours === true \| 'true'` |
| `sanitaire_traitement_en_cours_non` | check | `traitement_en_cours === false \| 'false'` |
| `sanitaire_traitement_detail` | text_wrap | `fiche_sanitaire.traitement_detail` (8pt, wrap, max 2 lignes) |
| `sanitaire_allergie_asthme_oui` | check | `allergie_asthme === 'oui'` |
| `sanitaire_allergie_asthme_non` | check | `allergie_asthme === 'non'` |
| `sanitaire_allergie_alimentaire_oui` | check | `allergie_alimentaire === 'oui'` |
| `sanitaire_allergie_alimentaire_non` | check | `allergie_alimentaire === 'non'` |
| `sanitaire_allergie_medicamenteuse_oui` | check | `allergie_medicamenteuse === 'oui'` |
| `sanitaire_allergie_medicamenteuse_non` | check | `allergie_medicamenteuse === 'non'` |
| `sanitaire_allergie_autres` | text | `fiche_sanitaire.allergie_autres` (8pt, max 60) |
| `sanitaire_allergie_detail` | text_wrap | `fiche_sanitaire.allergie_detail` (8pt, wrap, max 3 lignes) |
| `sanitaire_probleme_sante_detail` | text_wrap | `fiche_sanitaire.probleme_sante_detail` (8pt, wrap, max 3 lignes) |
| `sanitaire_recommandations_parents` | text_wrap | `fiche_sanitaire.recommandations_parents` (8pt, wrap, max 3 lignes) |
| `sanitaire_remarques` | text_wrap | `fiche_sanitaire.remarques` (8pt, wrap, max 2 lignes) |

### 2.9 — PAGE 2 — Autorisation soins

| Champ AcroForm | Type | Source |
|---|---|---|
| `sanitaire_autorisation_soins_soussigne` | text | `fiche_sanitaire.autorisation_soins_soussigne` |
| `sanitaire_fait_a` | text | `fiche_sanitaire.fait_a` |
| `sanitaire_date_signature` | text | `fiche_sanitaire.date_signature` ∨ `dossier.created_at` |

### 2.10 — Signature sanitaire (image)

Zone d'embed PNG, pas un champ AcroForm. Coord : `page=1, x=350, y=800, w=120, h=25`.

**Total sanitaire : 69 champs AcroForm (29 text + 7 text_wrap + 33 vaccins = 11×3)**

---

## 3. Fiche de liaison — ❌ HORS SCOPE MIGRATION (ADR 2026-04-24)

> ⚠️ **Ne pas migrer ce template en AcroForm.** Décision 2026-04-24 :
> la fiche de liaison est désormais envoyée par mail à la structure (PDF
> pré-rempli avec données bulletin, à imprimer, faire signer et retourner
> par upload). La saisie en ligne a été retirée du parcours parent.
> Voir `docs/adr/2026-04-24-pdf-liaison-renseignements-email-flow.md`.
>
> Le code de génération `type=liaison` dans `pdf/route.ts` reste fonctionnel
> pour produire le PDF pré-rempli envoyé par mail ; les coord en dur restent
> acceptables dans ce flux (le rendu est destiné à l'impression papier, les
> décalages mineurs sont corrigés manuellement par le signataire).
>
> Section conservée ci-dessous à titre d'archive uniquement.

### État du template source (archive)

Le template `fiche-liaison-template.pdf` a **86 champs AcroForm génériques** nommés
`Champ texte0` … `Champ texte85`. La migration AcroForm de ce template est
**annulée**. Le template reste utilisé tel quel pour la génération PDF envoyée
à la structure par mail.

### 3.1 — PAGE 1 — Renseignements concernant le jeune

| Champ AcroForm | Type | Source |
|---|---|---|
| `liaison_jeune_nom` | text | `jeune_nom_display` |
| `liaison_jeune_prenom` | text | `inscription.jeune_prenom` |
| `liaison_jeune_date_naissance` | text | `inscription.jeune_date_naissance` formaté (8pt) |
| `liaison_etablissement_nom` | text | `fiche_liaison_jeune.etablissement_nom` |
| `liaison_etablissement_adresse` | text | `fiche_liaison_jeune.etablissement_adresse` |
| `liaison_etablissement_cp` | text | `fiche_liaison_jeune.etablissement_cp` |
| `liaison_etablissement_ville` | text | `fiche_liaison_jeune.etablissement_ville` |
| `liaison_sejour_nom` | text | `gd_stays.marketing_title` ∨ slug |
| `liaison_session_date` | text | `inscription.session_date` formaté |
| `liaison_resp_etablissement_nom` | text | `fiche_liaison_jeune.resp_etablissement_nom` |
| `liaison_resp_etablissement_prenom` | text | `fiche_liaison_jeune.resp_etablissement_prenom` |
| `liaison_resp_etablissement_tel1` | text | `fiche_liaison_jeune.resp_etablissement_tel1` |
| `liaison_resp_etablissement_tel2` | text | `fiche_liaison_jeune.resp_etablissement_tel2` |

### 3.2 — PAGE 1 — Partie à remplir par le jeune

| Champ AcroForm | Type | Source |
|---|---|---|
| `liaison_choix_seul_oui` | check | `choix_seul === 'oui'` |
| `liaison_choix_seul_non` | check | `choix_seul === 'non'` |
| `liaison_choix_ami_oui` | check | `choix_ami === 'oui'` |
| `liaison_choix_ami_non` | check | `choix_ami === 'non'` |
| `liaison_choix_educateur_oui` | check | `choix_educateur === 'oui'` |
| `liaison_choix_educateur_non` | check | `choix_educateur === 'non'` |
| `liaison_deja_parti_oui` | check | `deja_parti === 'oui'` |
| `liaison_deja_parti_non` | check | `deja_parti === 'non'` |
| `liaison_deja_parti_detail` | text | `fiche_liaison_jeune.deja_parti_detail` (8pt) |
| `liaison_pourquoi_ce_sejour` | text_wrap | `fiche_liaison_jeune.pourquoi_ce_sejour` (8pt, wrap 2 lignes) |
| `liaison_fiche_technique_lue_oui` | check | `fiche_technique_lue === 'oui'` |
| `liaison_fiche_technique_lue_non` | check | `fiche_technique_lue === 'non'` |

### 3.3 — PAGE 1 — Engagement

| Champ AcroForm | Type | Source |
|---|---|---|
| `liaison_signature_fait_a` | text | `fiche_liaison_jeune.signature_fait_a` |
| `liaison_date_signature` | text | `fiche_liaison_jeune.date_signature` ∨ `dossier.created_at` |

### 3.4 — Signature liaison (image)

Zone d'embed PNG, pas un champ AcroForm. Coord : `page=0, x=410, y=805, w=120, h=25`.

**Total liaison : 28 champs AcroForm (14 text + 1 text_wrap + 13 check)** — ❌ **hors scope migration** (ADR 2026-04-24)

---

## 4. Récapitulatif global

| Template | Champs text | Champs text_wrap | Champs check | Total |
|---|---|---|---|---|
| Bulletin | 29 | 0 | 9 | **38** |
| Sanitaire | 29 + 11 dates vaccins | 7 | 22 check vaccins + 11 check médical = 33 | **69** |
| Liaison | 14 | 1 | 13 | **28** |
| **TOTAL** | — | — | — | **135 champs AcroForm à créer/renommer** |

## 5. Conventions à respecter impérativement lors de la création dans l'outil

1. **Casse** : toujours `snake_case`, jamais de majuscules, pas d'espaces, pas d'accents.
2. **Préfixe** : `bulletin_`, `sanitaire_`, `liaison_` — permet de détecter les collisions accidentelles dans les logs.
3. **Police par défaut** : Helvetica 9pt (héritée de la police définie dans l'outil lors de la création du champ).
4. **Police contextuelle** : certains champs doivent être en 8pt (séjours, adresses longues) ou 7pt (dates vaccins). Définir au niveau du champ dans l'outil, pas au niveau du runtime.
5. **Checkboxes** : valeur cochée = `Yes` (standard AcroForm). Le code utilisera `form.getCheckBox(name).check()`.
6. **Multiline** : pour les champs `text_wrap` dans ce document, cocher l'option « Multiline » / « Plusieurs lignes » dans les propriétés du champ.
7. **Polices non standard** : éviter. Si le template source utilise une police custom, laisser le champ AcroForm hériter de la police par défaut (Helvetica) — pdf-lib ne peut pas écrire dans un champ référençant une police absente du document.

## 6. Champs signature image — hors AcroForm

Les 3 zones de signature (image PNG) restent gérées par `pdfDoc.drawImage()`
avec coordonnées en dur dans le code. Pas besoin de créer de champ AcroForm
pour ces zones. Coord actuelles à conserver :

| Template | Page | x | y | w | h |
|---|---|---|---|---|---|
| Bulletin | 0 | 350 | 795 | 120 | 25 |
| Sanitaire | 1 | 350 | 800 | 120 | 25 |
| Liaison | 0 | 410 | 805 | 120 | 25 |
