# Guide de test — Application Groupe & Découverte

**Pour :** la personne qui va tester l'application pour la première fois
**Durée totale :** environ 4 heures (réparties sur 1 ou 2 journées)
**Date :** avril 2026

---

## 1. Bonjour et merci

Merci d'accepter de tester notre application. Ce document est fait pour vous
guider pas à pas. Vous n'avez pas besoin de connaître l'application avant de
commencer : tout est expliqué ici.

Votre rôle : **jouer plusieurs personnages l'un après l'autre**, et noter tout ce
qui vous surprend, vous gêne, ne marche pas, ou vous semble moche, peu clair,
ou trop lent.

**Rien n'est trop petit à signaler.** Un bouton mal placé, un mot pas clair, une
couleur bizarre, un mail qui n'arrive pas, un message d'erreur incompréhensible,
une page qui met 10 secondes à charger : tout nous intéresse.

---

## 2. L'application en 3 minutes

### Qu'est-ce qu'elle fait ?

**Groupe & Découverte (GED)** est une plateforme qui organise des séjours
éducatifs (colonies de vacances spécialisées) pour des enfants et adolescents
suivis par la protection de l'enfance (foyers, éducateurs ASE).

L'application permet de :
- **Côté enfants et ados** (3 à 17 ans) : découvrir les séjours disponibles et
  dire lesquels leur font envie
- **Côté adultes** (éducateurs, directeurs de foyer, secrétaires) : recevoir les
  envies des jeunes, demander des devis, inscrire les enfants, remplir les
  dossiers administratifs, payer

### Qui l'utilise ?

Il y a **4 grands types de personnes** qui utilisent l'application :

| Personnage | Qui c'est | Ce qu'il/elle fait |
|---|---|---|
| **Un jeune** | Un enfant ou ado de 3 à 17 ans suivi par un éducateur | Regarde les séjours, met en favoris, envoie ses envies à son éducatrice |
| **Une éducatrice** | L'adulte qui suit le jeune au quotidien (foyer, famille d'accueil) | Reçoit les envies, demande des tarifs, inscrit le jeune, remplit son dossier (sanitaire, autorisations, etc.) |
| **Une direction ou secrétaire de structure** | Le chef ou la chef de l'établissement, ou sa secrétaire | Gère l'équipe des éducateurs, peut remplir un dossier à la place d'une éducatrice absente |
| **L'équipe GED** (admin) | Nous, en interne | Voit tout, valide les inscriptions, gère les paiements |

### Ce que vous allez tester

Vous allez **jouer ces 4 personnages** l'un après l'autre, dans l'ordre. Vous
commencez par l'enfant, puis vous devenez son éducatrice, puis la direction de
son foyer, puis l'admin GED. C'est comme une pièce de théâtre où vous jouez
tous les rôles.

---

## 2 bis — Lexique : les mots à connaître avant de commencer

Prenez 3 minutes pour lire ces définitions. Ce sont les mots qui reviennent
partout dans ce guide et dans l'application.

| Mot | Ce que ça veut dire |
|---|---|
| **Séjour** | Une colonie de vacances éducative (Ex. "Ferme pédagogique en Dordogne, 7 jours"). Une vingtaine sont proposés sur le site. |
| **Session** | Une date précise à laquelle un séjour a lieu (Ex. "du 10 au 17 juillet 2026"). Un séjour peut avoir plusieurs sessions dans l'année. |
| **Un·e jeune** | Un enfant ou adolescent·e de 3 à 17 ans. Ne se connecte pas (pas de compte). Navigue librement sur le site. |
| **ASE** | Aide Sociale à l'Enfance. Service qui protège les enfants en danger. Les jeunes qui utilisent GED sont suivis par l'ASE. |
| **Foyer** | Établissement qui héberge les jeunes suivis par l'ASE (maison d'enfants, MECS). |
| **Structure** | Mot générique pour désigner un foyer, un service ASE, une association. C'est le partenaire professionnel de GED. |
| **Éducatrice / éducateur** | L'adulte qui suit le jeune au quotidien. Elle s'occupe de l'inscrire aux séjours. |
| **Référent·e** | Synonyme d'éducatrice/éducateur. C'est la personne qui reçoit les envies du jeune et remplit son dossier. |
| **CDS** | Chef·fe De Service. L'adjoint·e direct·e du directeur de la structure. |
| **Direction** | La directrice ou le directeur de la structure. Elle/il gère l'équipe et peut déléguer son rôle au CDS. |
| **Secrétariat** | Personne qui assiste la direction (dossiers administratifs, inscriptions urgentes). |
| **Staff** | Mot générique pour tout le personnel de la structure (direction + CDS + secrétariat + éducateurs). |
| **Admin GED** | L'équipe interne de Groupe & Découverte qui voit tout, valide les inscriptions et les paiements. |
| **Envies** (ou "souhaits") | Les séjours qu'un·e jeune met en favoris et veut envoyer à sa référente. |
| **Inscription** | Quand l'éducatrice valide qu'un jeune part à un séjour (paiement inclus). |
| **Dossier enfant** | Le dossier administratif complet du jeune : bulletin d'inscription, fiche sanitaire (médical), fiche de liaison, documents (vaccinations, assurance...). L'éducatrice le remplit APRÈS l'inscription. |
| **Fiche sanitaire** | Partie médicale du dossier (allergies, traitements, vaccins). Données très sensibles. |
| **RGPD** | La loi française/européenne qui protège vos données personnelles. Chaque fois que l'appli demande des données, une mention RGPD doit être visible. |
| **Code structure** | Un code secret de **10 caractères** pour la direction, ou **6 caractères** pour le CDS. Permet de se connecter au tableau de bord structure sans mot de passe. |
| **Lien personnel** | Lien envoyé par email, unique, à ne pas transférer. Ex : lien d'invitation d'un membre d'équipe, lien pour remplir un dossier enfant. |
| **Espace pro** | L'espace de l'application réservé aux professionnels connectés. C'est là qu'on voit les **prix** et qu'on inscrit les jeunes. |

---

## 2 ter — La carte des adresses de l'application (URLs)

Chaque écran de l'application a sa propre adresse. Voici celles que vous allez
rencontrer. Toutes commencent par `https://app.groupeetdecouverte.fr/`.

| Adresse courte | À quoi ça sert | Qui l'utilise |
|---|---|---|
| `/` (la racine) | Page d'accueil. Explique le projet, menu vers le catalogue. | Tout le monde (public) |
| `/recherche` | Catalogue complet des séjours avec filtres. | Jeunes + éducatrices |
| `/sejour/[nom-du-sejour]` | Fiche détaillée d'un séjour (photos, dates, programme). | Jeunes + éducatrices |
| `/envies` | Ma liste de favoris (côté jeune, sans compte). | Jeunes uniquement |
| `/acceder-pro` | Formulaire pour demander un accès professionnel. | Nouvelle éducatrice sans compte |
| `/login` | Page de connexion (sert à tout le monde qui a un compte). | Éducatrices pro, admin GED |
| `/login?context=pro` | Même page mais avec le message "Espace professionnel" mis en avant. | Éducatrices pro |
| `/structure/[CODE-10-CHARS]` | Tableau de bord direction de la structure. | Direction de structure |
| `/structure/[CODE-6-CHARS]` | Tableau de bord CDS de la même structure. | CDS |
| `/suivi/[code-long]` | Dossier enfant à remplir (lien envoyé par email à l'éducatrice après inscription). | Éducatrice référente |
| `/educateur/souhait/[code-long]` | Page qui montre à l'éducatrice les envies envoyées par un jeune. | Éducatrice (avant d'avoir un compte pro) |
| `/admin` | Zone admin GED (après connexion). | Équipe GED uniquement |

**Vous n'avez pas besoin de retenir tout ça.** À chaque parcours de test, je
vous donne l'adresse exacte à ouvrir. Ce tableau est juste là pour que vous
compreniez où vous êtes pendant le test.

---

## 3. Comment utiliser ce guide

### Matériel nécessaire

- Un **ordinateur** (PC ou Mac) avec un navigateur récent (Chrome, Firefox,
  Safari, Edge — au choix)
- Un **téléphone** (iPhone ou Android) avec un navigateur
- **Deux boîtes mail** que vous ouvrez en parallèle dans deux onglets :
  - Votre **mail perso** (`ttu.nguyen188@gmail.com`) → vous jouerez les rôles
    "éducatrice terrain" et "secrétariat"
  - Votre **mail pro université** (`Thanh.Nguyen@univ-lyon2.fr`) → vous jouerez
    les rôles "direction de structure" et "admin GED"
- Ce guide sous les yeux (imprimé ou sur un 2e écran)
- De quoi noter : le tableau de retour fourni plus bas, ou un cahier / fichier
  Excel / Google Docs

**Pourquoi 2 mails ?** Parce que dans la vraie vie, une directrice de foyer a
un mail pro et une éducatrice terrain utilise son mail de service. Ça reflète
la réalité et ça permet à GED de tracer proprement qui fait quoi pendant le
test. Avant de commencer, vérifiez que vous pouvez **recevoir et envoyer** des
mails depuis les deux adresses (envoyez-vous un mail de test de l'une à
l'autre).

### L'adresse de l'application

**https://app.groupeetdecouverte.fr**

C'est la vraie application en ligne. Vos actions sont réelles mais vous avez
des codes et identifiants de test, donc rien ne dérange les vraies familles ni
les vrais éducateurs.

### Comment noter vos retours

Pour chaque parcours, vous avez un **tableau à remplir**. Voici le modèle
complet :

| # Étape | Ce que j'ai fait | Résultat attendu | Résultat observé | ✅ OK / ❌ Problème | Gravité 1-5 | Durée | Device | Captures | Remarques design |
|---|---|---|---|---|---|---|---|---|---|
| 1 | ... | ... | ... | ... | ... | 2s | PC Chrome | IMG_001 | ... |

**Comment remplir chaque colonne :**

- **# Étape** : le numéro d'étape du parcours (ex. 5.3)
- **Ce que j'ai fait** : décrivez votre action en 1 ligne, comme à un ami
  ("j'ai cliqué sur le gros bouton orange en haut")
- **Résultat attendu** : copiez ce que ce guide dit qui devait se passer
- **Résultat observé** : ce qui s'est VRAIMENT passé. Si c'est la même chose
  que attendu, écrivez "conforme". Si c'est différent, décrivez précisément.
- **✅ OK / ❌ Problème** : cochez
- **Gravité 1-5** (si problème) :
  - **1** = petit détail cosmétique (faute de frappe, alignement imparfait)
  - **2** = gêne mineure (j'ai mis du temps à comprendre mais j'ai trouvé)
  - **3** = gêne importante (j'ai dû tâtonner, j'aurais abandonné si ce n'était
    pas un test)
  - **4** = bloquant partiel (une partie n'a pas marché, mais j'ai pu finir)
  - **5** = bloquant total (je n'ai pas pu continuer le parcours)
- **Durée** : environ combien de temps cette étape a pris (5s, 30s, 2min...).
  Signalez surtout quand c'est lent.
- **Device** : "PC Chrome" / "iPhone Safari" / "Android Firefox"... (dites
  toujours d'où vous testez)
- **Captures** : mettez un nom court pour chaque image (IMG_001, IMG_002),
  envoyez les images à part dans un dossier zippé
- **Remarques design** : tout ce qui touche au visuel/lisibilité (couleur
  dure, texte coupé, bouton trop petit, image floue...)

**Les 2 types d'erreurs à signaler — aussi importants l'un que l'autre :**

1. **Erreurs de fonctionnement** (ça ne marche pas) : un bouton qui ne fait
   rien, une page blanche, un message d'erreur, un email qui n'arrive pas, un
   paiement refusé, etc.

2. **Problèmes visuels ou de clarté** : un bouton trop petit, un texte coupé,
   une couleur dure, un mot qu'on ne comprend pas, deux éléments qui se
   superposent, une image qui ne charge pas, un design "pas beau" ou "pas
   pro".

**Ne vous censurez pas. Rien n'est trop petit pour être signalé.**

### Comment bien rapporter un problème

Si vous repérez un bug, essayez systématiquement ceci :

1. **Reproduisez-le** : refaites l'étape exactement pareil. Est-ce que le
   problème revient ? (oui / non / parfois)
2. **Captures d'écran** : prenez une photo JUSTE AVANT le problème et JUSTE
   APRÈS
3. **Notez votre navigateur** et si vous êtes sur PC ou mobile
4. **Notez l'heure précise** (aide GED à retrouver dans ses journaux
   techniques)
5. Si un message d'erreur apparaît, **recopiez-le mot pour mot** (ou capture
   d'écran)

### Ne faites PAS ces choses

- ❌ Ne cliquez pas "Ignorer" quand un message apparaît sans le lire
- ❌ Ne rafraîchissez pas la page d'un coup de F5 avant d'avoir noté ce que
  vous voyez
- ❌ N'essayez pas de "deviner" ce qu'il faut faire si ce n'est pas clair —
  notez "pas compris" et passez au parcours suivant

### Conseils

- Testez **à chaque fois** sur ordinateur ET sur téléphone. Beaucoup de bugs
  apparaissent seulement sur mobile.
- Prenez une **capture d'écran** à chaque étape importante, même quand tout va
  bien. On aura une trace visuelle.
- **Chronométrez-vous** (approximativement) : si une page met plus de 5
  secondes à charger, c'est à signaler.
- **Ne trichez pas** : si vous ne comprenez pas une étape, notez "je n'ai pas
  compris" et arrêtez ce parcours. C'est l'info la plus précieuse pour nous.

---

## 4. Vos identifiants de test (confidentiels)

Voici les informations dont vous avez besoin pour démarrer. Gardez ce document
pour vous — ces identifiants sont temporaires et seront désactivés à la fin du
test.

### Vos 2 emails (vous les utilisez déjà, rien à créer)

| Rôles joués | Email |
|---|---|
| Éducatrice terrain + secrétariat | `ttu.nguyen188@gmail.com` |
| Direction de structure + admin GED | `Thanh.Nguyen@univ-lyon2.fr` |

### Votre structure de test (Bloc C — parcours 12 à 15)

| Info | Valeur |
|---|---|
| Nom de la structure | **Structure Test Thanh** |
| **Code Direction** (10 caractères) | **`20A1F449A8`** |
| **Code CDS** (6 caractères) | **`8D7FC4`** |
| Email associé | `Thanh.Nguyen@univ-lyon2.fr` |
| Valide jusqu'au | 19 octobre 2026 |

### Votre compte admin GED (Bloc D — parcours 16)

| Info | Valeur |
|---|---|
| Email | `Thanh.Nguyen@univ-lyon2.fr` |
| Mot de passe | **`TestGED2026!`** |
| Rôle | Éditeur |

### ⚠️⚠️⚠️ AVERTISSEMENT IMPORTANT pour le parcours 16 (admin) ⚠️⚠️⚠️

Votre compte admin a les **droits d'écriture** sur la base de données réelle
de GED. Cela signifie que vous **pourriez** modifier les vraies données si
vous cliquez n'importe où.

**Règle d'or pendant le parcours 16 :** regardez, ne cliquez pas.

**Ne cliquez JAMAIS sur :**
- ❌ Boutons rouges ou orange "Supprimer", "Annuler", "Révoquer"
- ❌ Boutons "Valider l'inscription", "Changer le statut"
- ❌ Boutons "Envoyer email", "Envoyer la facture", "Relancer"
- ❌ Boutons "Exporter" (peuvent déclencher envois automatiques)
- ❌ Changements de prix, de dates, de capacité
- ❌ Tout bouton dont l'effet n'est pas évident à la lecture

**Ce que vous POUVEZ faire sans risque :**
- ✅ Cliquer sur "Voir" / "Détail" / "Consulter"
- ✅ Naviguer dans les onglets et les listes
- ✅ Utiliser les filtres et la recherche
- ✅ Faire défiler les pages

**Si vous avez un doute, notez dans votre tableau "je n'ai pas cliqué, je
pense que ça aurait fait X" — c'est une info précieuse pour nous.**

Si vous cliquez par erreur sur une action d'écriture :
1. Ne paniquez pas
2. Notez immédiatement dans le tableau ce que vous avez cliqué, à quelle heure
3. Prévenez GED dès que possible
4. Toutes les actions sont consignées et réversibles en moins de 5 minutes

### Votre compte éducatrice pro — À CRÉER VOUS-MÊME pendant le test

Pour tester le parcours réel, **vous allez créer votre compte pro vous-même**
pendant le parcours 7 (demander un accès professionnel). Donc rien à recevoir
à l'avance. Notez juste que quand vous le ferez, vous devrez utiliser :
- Email : `ttu.nguyen188@gmail.com`
- Structure : "Structure Test Thanh" (votre structure de test)

### Votre secrétaire de structure — À INVITER VOUS-MÊME pendant le test

Même logique : parcours 13, la direction (vous) invite une secrétaire. Vous
utiliserez :
- Email invité : `ttu.nguyen188@gmail.com` (votre mail perso)
- Prénom : Sophie · Nom : Test (ou ce que vous voulez)
- Rôle : Secrétariat

Puis parcours 14, vous activez ce compte avec un mot de passe de votre choix
(notez-le !).

---

### Récapitulatif à garder sous les yeux

```
─────────────────────────────────────────────
MES 2 EMAILS
  Terrain   : ttu.nguyen188@gmail.com
  Pro univ. : Thanh.Nguyen@univ-lyon2.fr
─────────────────────────────────────────────
MA STRUCTURE TEST
  Nom        : Structure Test Thanh
  Direction  : 20A1F449A8  (10 chars)
  CDS        : 8D7FC4       (6 chars)
─────────────────────────────────────────────
ADMIN GED (éditeur — lire section warning §4 avant P16)
  Email      : Thanh.Nguyen@univ-lyon2.fr
  Password   : TestGED2026!
─────────────────────────────────────────────
À CRÉER PENDANT LE TEST
  Compte pro éducatrice    (Parcours 7)
  Mot de passe que je choisirai : ______________
  Compte secrétariat       (Parcours 13+14)
  Mot de passe que je choisirai : ______________
─────────────────────────────────────────────
```

**Important — sécurité** : ces identifiants sont **personnels et temporaires**.
Ne les partagez avec personne. À la fin du test, GED les désactivera.

---

## 4 bis — Points d'attention connus à ne pas confondre avec des bugs

Avant de commencer, prenez 2 minutes pour lire ces **quirks connus** de
l'application. Ce sont des particularités cosmétiques que nous connaissons,
qui ne doivent PAS vous bloquer ni vous inquiéter.

| Quirk | Où | Ce que vous verrez | Quoi faire |
|---|---|---|---|
| **Widget Cloudflare** | Étape 5/5 du formulaire d'inscription | Une case "Vérification" avec un logo Cloudflare entre les options paiement et le bouton | La **cocher** avant de cliquer "S'inscrire". Sans elle, le bouton reste grisé. C'est normal. |
| **Contrainte d'âge** | Étape 2/5 | Un bandeau au-dessus du champ date de naissance vous indique la fourchette d'âge attendue. Si vous tapez une date hors plage, un message pédagogique s'affiche. | **Léa doit avoir 6 ans à la date du séjour**. Ex. pour un séjour début juillet 2026, mettez une date de naissance en août 2019. Le hint préventif vous guide en amont. |

**Ces quirks ne doivent pas être comptés comme des bugs dans vos retours** —
nous les connaissons et les fixons après votre test. Si vous en découvrez
d'autres, **là** c'est précieux de les signaler.

---

## 4 ter — Nouvelles améliorations UX déployées le 19 avril au soir

Plusieurs ajustements viennent d'être mis en ligne pour rendre les parcours plus
clairs. Lisez cette section avant de tester : ce qui était décrit comme "à
améliorer" dans des versions précédentes du guide est désormais corrigé.

### Création de structure (parcours 9, étape 3/5)

- **Adresse "N° et rue"** : maintenant **éditable si vide** après vérification
  du code structure. Vous pouvez la remplir.
- **Type de structure** : maintenant **éditable si vide**. Vous pouvez choisir
  dans la liste si la structure n'avait pas encore de type.
- **Email de la structure (standard, optionnel)** : libellé clarifié — c'est
  l'email général de la structure (accueil, secrétariat). Optionnel.
- **Votre email personnel (référent)** : libellé clarifié avec un texte d'aide
  *"C'est sur cet email que vous recevrez tous les courriers"*. Champ obligatoire.

### Récap après inscription (parcours 9 fin)

- **Référent** : affiche désormais **"Prénom Nom"** du référent (ex. "Thanh
  Nguyen"), plus le nom de la structure.

### Date de naissance (parcours 9, étape 2/5)

- **Hint préventif** affiché au-dessus du champ : *"⚠️ L'enfant doit avoir entre
  X et Y ans au moment du séjour"*.
- **Message d'erreur pédagogique** si la date saisie est hors plage (au lieu
  d'un blocage sec).

### Remplir le dossier (parcours 10)

- **Un seul bouton "Valider le bloc"** par formulaire (à la place des deux
  anciens boutons "Enregistrer" + "Valider").
- **Wording corrigé** : on parle de *"formulaires à compléter"* (et non plus
  de *"documents manquants"*) pour ne pas confondre avec les pièces jointes.
- **Barre de progression %** sur chaque bloc, avec compteur "X% complété" et
  "n/total" champs remplis. À 100% : pastille verte **"Complet ✓"**.
- **Auto-fill** entre blocs pour éviter de retaper :
  - **Nom du contact d'urgence** : recopié du Bulletin vers les Renseignements.
  - **Téléphone du contact d'urgence** : recopié du Bulletin vers les Renseignements.
  - **Lieu de signature ("Fait à")** : recopié du Bulletin vers la Liaison.

### Envoi du dossier (parcours 11)

- **Envoi possible avec des PJ optionnelles manquantes** : si les 4 blocs sont
  complétés et signés, vous pouvez envoyer le dossier à GED même s'il manque
  certaines pièces jointes (vaccins, assurance, etc.).
- **Récapitulatif post-envoi** : la liste des PJ manquantes s'affiche après
  envoi (*"Dossier envoyé. X documents optionnels manquants : vaccins,
  assurance…"*).
- **Relance manuelle** : GED vous recontactera au besoin pour les pièces
  manquantes.

---

## 5. Checklist à faire AVANT de démarrer le 1er parcours

Prenez 10 minutes pour ces 7 vérifications. Elles vous éviteront des blocages
pendant le test.

| # | Vérification | Fait ✅ |
|---|---|---|
| 1 | J'ai reçu par email les crédentials de GED et je les ai notés dans le cadre ci-dessus | |
| 2 | Je peux ouvrir ma boîte `ttu.nguyen188@gmail.com` et envoyer/recevoir des mails | |
| 3 | Je peux ouvrir ma boîte `Thanh.Nguyen@univ-lyon2.fr` et envoyer/recevoir des mails | |
| 4 | J'ai ouvert **https://app.groupeetdecouverte.fr** dans mon navigateur, la page s'affiche | |
| 5 | J'ai préparé un dossier sur mon ordinateur pour mettre mes captures d'écran (Ex. `TEST-GED-2026-04-XX/captures/`) | |
| 6 | J'ai ce guide sous les yeux (imprimé ou sur un 2e écran) | |
| 7 | J'ai prévu au moins 1h devant moi sans interruption | |

**Si un point ne passe pas au vert, contactez GED avant de commencer.**

---

# Les parcours à tester

Les parcours sont regroupés en 4 blocs. Chaque bloc correspond à un des
personnages que vous jouez. Dans chaque bloc, les parcours se suivent dans un
ordre logique (le parcours 2 utilise ce qui a été fait au parcours 1, etc.).
**Respectez l'ordre.**

### Aperçu des 4 blocs

| Bloc | Vous jouez qui ? | Objectif général | Parcours | Durée |
|---|---|---|---|---|
| **A** | Un·e jeune de 13 ans | Vérifier que l'app est claire, utilisable sur mobile, et permet d'envoyer des envies à son éducatrice | P1 à P4 | ~45 min |
| **B** | Une éducatrice ASE | Vérifier qu'on peut demander un tarif, créer un compte, inscrire un jeune et remplir son dossier | P5 à P11 | ~2h |
| **C** | La direction et la secrétaire d'un foyer | Vérifier qu'on peut gérer son équipe, inviter des collaborateurs, et remplir un dossier en dépannage | P12 à P15 | ~50 min |
| **D** | L'admin GED | Vérifier qu'on voit bien les inscriptions, les paiements, les dossiers en consultation | P16 | ~15 min |

**Durée totale cumulée :** environ 4 heures. À répartir sur 1 ou 2 journées
selon votre confort.

---

# BLOC A — Vous êtes un jeune (un·e enfant ou ado)

**Décor :** Imaginez que vous avez 13 ans, vous vivez dans un foyer, et votre
éducatrice vous a dit "regarde sur le site de Groupe & Découverte, il y a des
colos sympas, dis-moi lesquelles te plaisent".

Vous allez utiliser l'application **sans compte, sans mot de passe**. Vous êtes
juste un·e visiteur·se libre.

---

## Parcours 1 — Découvrir l'application

**Où :** Sur votre téléphone (c'est ce qu'un ado utiliserait)
**Temps :** 10 minutes

### Étapes

1. Ouvrez votre navigateur téléphone et allez sur
   **https://app.groupeetdecouverte.fr**
2. Regardez la page d'accueil : lisez les titres, les slogans, les images.
3. Faites défiler vers le bas. Que voyez-vous ?
4. Cherchez un bouton ou un lien pour **voir tous les séjours**.
5. Cliquez dessus.

### Ce que vous devez voir

- Une page d'accueil chaleureuse, avec des photos de colos
- Un message clair expliquant que c'est une plateforme de séjours pour les
  jeunes suivis par un éducateur
- Un gros bouton type **"Découvrir les séjours"** ou **"Voir les colos"**
- Après clic, une page avec plusieurs séjours (photos + titres + destinations)

### Points d'attention

- Le site s'affiche-t-il correctement sur votre petit écran ?
- Les images sont-elles nettes ?
- Est-ce que le texte est lisible (pas trop petit, bon contraste) ?
- Y a-t-il un menu en bas de l'écran (sur mobile) ?
- Vous sentez-vous en confiance (design pro, pas de pub agressive) ?

### Tableau à remplir

| # | Action | Attendu | Observé | OK ? | Captures | Remarques design |
|---|---|---|---|---|---|---|
| 1.1 | Ouvrir l'accueil | Page chargée < 3 sec, titre visible | | | | |
| 1.2 | Lire les textes | Clair, pas de fautes | | | | |
| 1.3 | Trouver le bouton "voir les séjours" | Visible sans chercher | | | | |
| 1.4 | Cliquer dessus | Catalogue s'affiche | | | | |
| 1.5 | Vérifier sur ordinateur aussi | Affichage adapté grand écran | | | | |

---

## Parcours 2 — Explorer les séjours et filtrer

**Où :** Téléphone ou ordinateur, au choix
**Temps :** 15 minutes

### Étapes

1. Vous êtes sur la page qui liste tous les séjours (catalogue).
2. Regardez combien il y en a au total.
3. Cherchez un moyen de **filtrer** : par exemple, seulement les séjours d'été,
   ou seulement pour les 10-13 ans, ou seulement en montagne.
4. Essayez plusieurs filtres.
5. Cliquez sur **un séjour qui vous attire** pour voir sa fiche détaillée.
6. Lisez toute la fiche : description, dates, programme, photos.

### Ce que vous devez voir

- Une liste propre et claire des séjours
- Des filtres visibles (âge, saison, thème, région...)
- Quand vous cliquez sur un séjour, une page détaillée s'ouvre avec :
  - Le titre du séjour
  - Plusieurs photos
  - Les dates disponibles
  - Le programme (ce qu'on fait chaque jour)
  - La description
  - **Pas de prix affiché** (c'est normal : les prix sont réservés aux
    professionnels)
  - Un bouton pour ajouter le séjour à ses "envies"

### Points d'attention

- Les filtres fonctionnent-ils vraiment ? (le nombre de séjours change-t-il ?)
- La fiche détaillée est-elle jolie et complète ?
- Les photos chargent-elles vite ?
- Si vous revenez en arrière, retrouvez-vous votre filtre ou il disparaît ?

### Tableau

| # | Action | Attendu | Observé | OK ? | Captures | Remarques |
|---|---|---|---|---|---|---|
| 2.1 | Compter les séjours | Au moins 15 séjours | | | | |
| 2.2 | Filtrer par saison "été" | Liste se réduit | | | | |
| 2.3 | Filtrer par âge "10-13 ans" | Liste se réduit | | | | |
| 2.4 | Ouvrir une fiche séjour | Page complète avec photos | | | | |
| 2.5 | Chercher le prix | Pas affiché côté jeune | | | | |
| 2.6 | Trouver bouton "Ajouter à mes envies" | Bouton visible | | | | |

---

## Parcours 3 — Mettre des séjours en favoris (envies)

**Où :** Téléphone de préférence
**Temps :** 10 minutes

### Étapes

1. Sur la fiche d'un séjour qui vous attire, cliquez sur **"Ajouter à mes
   envies"** (ou le petit cœur).
2. Allez voir votre liste d'envies (cherchez "Mes envies" dans le menu).
3. Retournez au catalogue. Ajoutez 2 ou 3 autres séjours.
4. Enlevez-en 1 pour voir si ça fonctionne.
5. **Fermez votre navigateur**, ré-ouvrez-le, retournez sur
   `app.groupeetdecouverte.fr` et vérifiez que vos envies sont toujours là.

### Ce que vous devez voir

- Un retour visuel quand vous ajoutez (cœur rempli, animation, message)
- Une page "Mes envies" qui liste les séjours choisis
- Possibilité de retirer un séjour
- **Les envies sont conservées** même après avoir fermé le navigateur

### Points d'attention

- Le cœur/bouton a-t-il un état "ajouté" bien visible ?
- Peut-on enlever facilement ?
- Les envies survivent-elles à la fermeture ?

### Tableau

| # | Action | Attendu | Observé | OK ? | Captures | Remarques |
|---|---|---|---|---|---|---|
| 3.1 | Ajouter séjour à envies | Confirmation visible | | | | |
| 3.2 | Voir la page "Mes envies" | Séjour présent | | | | |
| 3.3 | Ajouter 2 autres | Total 3 envies | | | | |
| 3.4 | Retirer 1 envie | Reste 2 envies | | | | |
| 3.5 | Fermer/rouvrir navigateur | Les 2 envies toujours là | | | | |

---

## Parcours 4 — Envoyer ses envies à son éducatrice

**Où :** Téléphone
**Temps :** 10 minutes

Maintenant que vous avez sélectionné vos envies, vous voulez les partager avec
votre éducatrice pour qu'elle vous inscrive à un séjour.

### Étapes

1. Sur la page "Mes envies", cherchez un bouton type **"Envoyer à mon
   éducateur / éducatrice"** ou **"Partager mes envies"**.
2. Cliquez dessus.
3. Remplissez le formulaire :
   - Votre prénom (inventez : "Camille", "Léa", "Tom"...)
   - Votre âge
   - L'email de votre éducatrice : **mettez VOTRE mail perso** (vous allez
     recevoir le mail en tant qu'éducatrice ensuite)
   - Éventuellement un message libre ("J'aime bien celui-ci")
4. **Lisez bien** la mention RGPD / confidentialité avant de valider.
5. Validez l'envoi.
6. Allez vérifier votre boîte mail perso : vous devez recevoir un email.

### Ce que vous devez voir

- Un formulaire clair et pas trop long
- Une **mention RGPD visible** expliquant ce que fait GED avec ces données
- Un message de confirmation après envoi ("C'est envoyé à ton éducatrice !")
- Un email dans votre boîte dans les 2 minutes, envoyé par
  `noreply@groupeetdecouverte.fr`, contenant la liste des séjours que vous
  avez choisis et un lien pour que l'éducatrice réagisse

### Points d'attention ⚠️

- **Est-ce que le mail arrive bien ?** (regardez aussi les spams)
- Le mail est-il joli, professionnel, bien mis en page ?
- Le prénom du jeune est-il bien repris ?
- Les séjours choisis sont-ils tous listés avec leur image ?
- Y a-t-il un lien cliquable dans le mail ?

### Tableau

| # | Action | Attendu | Observé | OK ? | Captures | Remarques |
|---|---|---|---|---|---|---|
| 4.1 | Trouver bouton "envoyer à mon éducateur" | Visible | | | | |
| 4.2 | Remplir formulaire | Champs clairs, tous compréhensibles | | | | |
| 4.3 | Voir mention RGPD | Présente et lisible | | | | |
| 4.4 | Valider | Confirmation écran | | | | |
| 4.5 | Recevoir email (dans boîte perso) | Arrivée < 2 min | | | | |
| 4.6 | Ouvrir email | Joli, pro, tous séjours listés | | | | |
| 4.7 | Cliquer lien dans email | Ouvre une page de l'appli | | | | |

### 📍 Bug / UX déjà signalé par GED (à ne pas remonter)

Aucun à ce stade du parcours.

---

# BLOC B — Vous êtes l'éducatrice

**Décor :** Vous êtes l'éducatrice de Camille (le ou la jeune du bloc A). Vous
venez de recevoir son email avec ses envies de colo. Vous allez :

1. Lire ses envies
2. Demander un tarif à GED (sans avoir de compte)
3. Demander un accès pro si vous n'en avez pas encore
4. Plus tard, vous connecter à votre espace pro
5. Inscrire Camille à un séjour
6. Remplir son dossier administratif
7. Signer et envoyer le dossier à GED

---

## Parcours 5 — Lire les envies du jeune depuis l'email

**Où :** Ordinateur
**Temps :** 10 minutes

### Étapes

1. Ouvrez votre boîte mail perso.
2. Retrouvez l'email envoyé à l'étape 4 ("Envies de Camille").
3. **Cliquez sur le lien** dans le mail.
4. Une page s'ouvre dans votre navigateur.
5. Lisez-la entièrement.

### Ce que vous devez voir

- Une page dédiée à cette demande (hébergée sur `app.groupeetdecouverte.fr`)
- Le prénom et l'âge du jeune
- La liste complète des séjours qu'il/elle a choisis
- Pour chaque séjour : photo, titre, dates, destination
- **Pas de prix** visible (ou clairement marqué "Demander le tarif")
- Des boutons d'action possibles : "Demander le tarif", "Inscrire ce jeune",
  "Signaler à GED"

### Points d'attention

- La page charge-t-elle vite ?
- Le design est-il pro, adapté à une éducatrice professionnelle ?
- Les infos sont-elles suffisantes pour qu'elle se décide ?

### Tableau

| # | Action | Attendu | Observé | OK ? | Captures | Remarques |
|---|---|---|---|---|---|---|
| 5.1 | Cliquer lien email | Page s'ouvre | | | | |
| 5.2 | Voir prénom du jeune | Affiché | | | | |
| 5.3 | Voir liste séjours | Complète avec photos | | | | |
| 5.4 | Voir boutons d'action | Visibles et clairs | | | | |

---

## Parcours 6 — Demander un tarif sans avoir de compte pro

**Où :** Ordinateur
**Temps :** 10 minutes

Vous êtes éducatrice, mais vous n'avez pas encore de compte. Vous voulez
quand même connaître le prix d'un séjour pour en parler à votre direction.

### Étapes

1. Depuis la page d'un séjour (dans le catalogue ou depuis le lien du jeune),
   cherchez un bouton **"Demander le tarif"** ou **"Je suis pro, demander un
   devis"**.
2. Un formulaire s'ouvre.
3. Remplissez :
   - Votre prénom
   - Nom de la structure (inventez : "Foyer Les Tilleuls")
   - Votre email perso
4. Validez.
5. Vérifiez votre boîte mail : vous devez recevoir le tarif par email dans les
   minutes qui suivent.

### Ce que vous devez voir

- Formulaire court (3 champs maximum)
- Message de confirmation après validation
- **Email de tarif reçu** avec :
  - Le prix du séjour (base + options transport si dispo)
  - Des conseils pour demander un accès pro
  - Un ton professionnel

### Points d'attention ⚠️

- **Si vous recliquez 2 fois de suite sur "Valider", que se passe-t-il ?**
  Idéalement, un message vous dit "Vous venez de faire la demande, patientez
  avant une nouvelle". (c'est pour empêcher les abus)
- Le mail de tarif est-il bien mis en forme ?
- Est-ce que le prix est clair ?

### Tableau

| # | Action | Attendu | Observé | OK ? | Captures | Remarques |
|---|---|---|---|---|---|---|
| 6.1 | Trouver bouton "demander tarif" | Visible sur fiche séjour | | | | |
| 6.2 | Remplir formulaire | Champs simples | | | | |
| 6.3 | Valider | Confirmation écran | | | | |
| 6.4 | Recevoir mail tarif | Arrivée < 3 min | | | | |
| 6.5 | Lire le tarif | Prix clair | | | | |
| 6.6 | Retenter immédiatement | Message anti-abus | | | | |

---

## Parcours 7 — Demander un accès professionnel

**Où :** Ordinateur
**Temps :** 10 minutes

Vous voulez maintenant avoir un vrai compte pour pouvoir inscrire Camille.

### Étapes

1. Cherchez sur le site un lien **"Je suis pro"** ou **"Demander un accès
   pro"** ou allez directement sur
   **https://app.groupeetdecouverte.fr/acceder-pro**
2. Remplissez le formulaire (prénom, nom, structure, email, téléphone, etc.)
3. Validez.
4. Vérifiez vos mails : vous devez recevoir une **confirmation** de votre
   demande.
5. (En vrai, ensuite, GED valide manuellement. Pour le test, on utilisera un
   compte pro déjà créé par GED — voir étape suivante.)

### Ce que vous devez voir

- Formulaire clair, bien structuré
- Mention RGPD visible
- Message de confirmation après validation
- Email de confirmation reçu
- Texte expliquant les délais ("nous revenons vers vous sous 48h")

### Tableau

| # | Action | Attendu | Observé | OK ? | Captures | Remarques |
|---|---|---|---|---|---|---|
| 7.1 | Trouver page "acceder-pro" | Accessible depuis l'accueil | | | | |
| 7.2 | Remplir formulaire | Complet mais pas trop long | | | | |
| 7.3 | Mention RGPD | Présente | | | | |
| 7.4 | Valider | Confirmation écran | | | | |
| 7.5 | Recevoir mail confirmation | Arrivée < 3 min | | | | |

---

## Parcours 8 — Se connecter à l'espace pro

**Où :** Ordinateur
**Temps :** 5 minutes

Vous avez maintenant un compte pro (fourni par GED pour le test — voir section 4).

### Étapes

1. Allez sur **https://app.groupeetdecouverte.fr/login?context=pro**
2. Vous devez voir une page de connexion clairement identifiée "Espace
   professionnel"
3. Entrez l'email et le mot de passe pro fournis par GED
4. Validez
5. Vous arrivez sur une page différente de celle des enfants : l'espace pro
   avec le catalogue et **les prix visibles**

### Ce que vous devez voir

- Page de connexion sobre et professionnelle
- Lien "Mot de passe oublié"
- Après connexion : un catalogue qui ressemble à celui des jeunes MAIS avec
  les prix visibles
- Un menu pro en haut ou dans une barre latérale

### Points d'attention

- Essayez avec un **mauvais mot de passe** : un message d'erreur clair doit
  apparaître ("Identifiants incorrects"), **sans révéler** si c'est l'email ou
  le mot de passe qui est faux (sécurité)
- Essayez 5 fois de suite avec le mauvais mdp : un message de type "trop de
  tentatives, patientez" doit apparaître

### Tableau

| # | Action | Attendu | Observé | OK ? | Captures | Remarques |
|---|---|---|---|---|---|---|
| 8.1 | Page login pro | Identifiable clairement | | | | |
| 8.2 | Connexion avec bons identifiants | Accès catalogue pro | | | | |
| 8.3 | Voir les prix | Oui, sur chaque séjour | | | | |
| 8.4 | Tenter connexion mauvais mdp | Erreur générique | | | | |
| 8.5 | 5 tentatives mauvais mdp | Message anti-abus | | | | |

---

## Parcours 9 — Inscrire un jeune à un séjour

**Où :** Ordinateur
**Temps :** 20 minutes

Vous êtes connectée en pro. Vous allez inscrire Camille (le jeune du bloc A) à
un séjour.

### Étapes

1. Depuis le catalogue pro, choisissez **un séjour** (au hasard, celui qui
   vous plaît, avec des dates disponibles).
2. Ouvrez sa fiche.
3. Cliquez sur **"Inscrire un jeune"** ou équivalent.

#### 🔑 POINT CRITIQUE à ne pas rater — Code structure

Dans le formulaire, vous verrez un champ intitulé **"Code structure
(si vous en avez un)"**. **Vous DEVEZ y saisir votre code de
structure de test.**

➡️ Code à saisir : **`20A1F449A8`**

Si vous le saisissez correctement, la bordure du champ devient
**verte** et un message confirme "Structure reconnue : Structure
Test Thanh". C'est ce qu'il faut voir.

Si vous **oubliez ce code** ou que vous le tapez mal, votre
inscription sera liée à une **nouvelle structure fantôme** créée
automatiquement, et elle **n'apparaîtra pas** dans votre dashboard
structure (parcours 12) — ce qui fausse la suite du test.

#### Suite du formulaire

4. Remplissez le reste :
   - **Prénom enfant** : `Camille` · **Nom** : au choix · **Sexe** : Fille
   - **Date de naissance enfant** : **IMPORTANT** — Camille doit avoir
     exactement **6 ans à la date du séjour** (pas 5, pas 7). Si vous
     choisissez le séjour MY LITTLE FOREST (3-6 ans) le 5 juillet 2026,
     mettez une date de naissance **1er août 2019** (6 ans révolus au
     moment du séjour). Si vous mettez 4 ans, le site bloque avec "Âge
     au départ : 7 ans • Âge requis : 3-6 ans" (c'est attendu, mais
     empêche de continuer). Pour un séjour 6-12 ans, une date 2017-2018
     fonctionnera.
   - **Nom de la structure** : pré-rempli "Structure Test Thanh" — ne
     touchez pas, il est grisé
   - **Nom du référent** : `Thanh Nguyen`
   - **Email référent** : `ttu.nguyen188@gmail.com`
   - **Téléphone référent** : `0612345678` (fictif)
   - **Session** : sélectionnez une date (ex. 5 juillet 2026)
   - **Ville de départ** : "Sans transport" (plus simple)
   - **Mode de paiement** : virement bancaire OU carte (au choix)

5. À l'**étape 5/5**, cochez le widget **"Vérification" Cloudflare**
   qui apparaît entre les options paiement et le bouton.
6. Acceptez les conditions RGPD.
7. Cliquez le bouton final :
   - **Virement bancaire / Chèque** → bouton "**S'inscrire**"
   - **Carte bancaire** → bouton "**Payer maintenant**"
8. Selon le mode de paiement :
   - **Carte** : on vous redirige vers Stripe. Pour le test, utilisez
     la carte test `4242 4242 4242 4242`, date future quelconque
     (ex. 12/30), CVC `123`, nom quelconque.
   - **Virement** : vous recevez un mail avec les coordonnées
     bancaires. **Ne faites PAS de vrai virement** — c'est un test.
   - **Chèque** : vous recevez un mail avec l'adresse postale.
     **N'envoyez PAS de vrai chèque** — c'est un test.

### Ce que vous devez voir

- Formulaire long mais clair, découpé en étapes (pas 1 grand écran avec 40
  champs)
- Indicateur d'avancement (étape 1/4, 2/4, etc.)
- Récapitulatif avant paiement
- Paiement Stripe qui fonctionne avec la carte test
- Message de succès après paiement
- Email de confirmation reçu par l'éducatrice (vous)
- Dans le mail : **un lien pour accéder au dossier du jeune** (c'est ce qu'on
  teste au parcours suivant)

### Points d'attention ⚠️

- À chaque étape, est-ce que vous pouvez revenir en arrière sans perdre ce
  que vous avez saisi ?
- Les champs obligatoires sont-ils bien marqués ?
- Si vous laissez un champ vide, y a-t-il un message d'erreur clair ?
- Le paiement Stripe fonctionne-t-il du premier coup ?
- L'email de confirmation arrive-t-il ?

### Tableau

| # | Action | Attendu | Observé | OK ? | Captures | Remarques |
|---|---|---|---|---|---|---|
| 9.1 | Cliquer "Inscrire un jeune" | Formulaire s'ouvre | | | | |
| 9.2 | Remplir étape 1 (infos jeune) | Champs clairs | | | | |
| 9.3 | Remplir étape 2 (structure) | Champs clairs | | | | |
| 9.4 | Remplir étape 3 (session) | Dates disponibles visibles | | | | |
| 9.5 | Choisir paiement carte | Redirection Stripe | | | | |
| 9.6 | Payer avec 4242... | Paiement accepté | | | | |
| 9.7 | Message de succès | Affiché | | | | |
| 9.8 | Mail confirmation reçu | Arrivée < 3 min | | | | |
| 9.9 | Lien vers le dossier dans le mail | Présent et cliquable | | | | |

---

## Parcours 10 — Remplir le dossier administratif du jeune 🎯 CŒUR DU TEST

**Où :** Ordinateur
**Temps :** 30 minutes

### 🎯 Pourquoi ce parcours est le plus important

Remplir un dossier enfant en ligne de bout en bout est **la raison d'être** de
l'application. Si ce parcours bugue, le produit ne sert à rien. Consacrez-y
tout le soin possible, c'est celui qui nous intéresse le plus.

### 📁 À préparer AVANT de démarrer (5 min)

Pour ne pas être bloquée en milieu de dossier, préparez ces 4 fichiers dans
un dossier facile à retrouver (Bureau, Desktop, Téléchargements) :

| Fichier | Usage | Comment le créer |
|---|---|---|
| `test-vaccins.pdf` (< 5 Mo) | Simuler carnet de vaccination | N'importe quel PDF — copiez-en un de vos documents |
| `test-attestation.jpg` (< 5 Mo) | Simuler une attestation | N'importe quelle photo |
| `test-gros-fichier.pdf` (> 5 Mo) | Tester le refus de fichiers trop lourds | Un PDF scanné haute résolution, ou un PDF de cours avec beaucoup d'images |
| `test-interdit.exe` | Tester le refus de formats interdits | Sur Mac : créez un fichier vide et renommez en .exe. Sur Windows : n'importe quel exécutable |

Ces fichiers ne sont pas lus par GED, ils servent juste à tester que l'appli
accepte/refuse correctement.

Après l'inscription, l'éducatrice doit remplir un dossier avec des infos
médicales, administratives, et signer des documents.

### Étapes

1. Dans le mail reçu à l'étape 9, cliquez sur le lien "Remplir le dossier".
2. Une page s'ouvre dans votre navigateur : c'est l'espace de suivi du jeune.
3. Vous voyez le compteur **"X formulaires à compléter"** (et non plus
   "documents manquants"). Plusieurs **blocs à compléter** sont affichés
   (onglets ou cartes) :
   - **Bulletin d'inscription** : coordonnées parents, personnes autorisées à
     venir chercher l'enfant, etc.
   - **Fiche sanitaire** : allergies, maladies, traitements, vaccinations
   - **Fiche de liaison jeune** : infos personnelles complémentaires
   - **Renseignements** (si le séjour le demande) : informations spécifiques
4. Sur chaque bloc, repérez la **barre de progression %** en haut (ex. "0%
   complété — 0/12 champs"). Elle se remplit au fur et à mesure de votre
   saisie.
5. Remplissez le **Bulletin d'inscription** au moins partiellement, puis
   cliquez sur le **bouton unique "Valider le bloc"** (un seul bouton, plus
   les anciens "Enregistrer" + "Valider" séparés).
6. Fermez la page sans rien faire de plus. Rouvrez le lien du mail.
7. **Vérifiez que vos données sont toujours là** (sauvegarde automatique).
8. Ouvrez les **Renseignements** et vérifiez que le **nom et le téléphone du
   contact d'urgence** sont déjà préremplis depuis le Bulletin (auto-fill).
   Vérifiez aussi que le champ **"Fait à"** de la Liaison reprend le lieu de
   signature du Bulletin.
9. Continuez : remplissez la **Fiche sanitaire** complètement. Mettez de
   fausses infos mais crédibles (allergie aux arachides, vacciné, pas de
   traitement). Cliquez "Valider le bloc".
10. Remplissez la **Fiche de liaison jeune**, validez.
11. Si "Renseignements" est présent, complétez-le et validez.
12. À 100% sur chaque bloc, vérifiez l'apparition de la pastille verte
    **"Complet ✓"**.
13. **Uploadez un document** (n'importe quel PDF ou JPG : photo d'identité
    factice, pdf quelconque). Essayez des tailles < 5 Mo.
14. Essayez d'uploader un fichier **> 5 Mo** : un message d'erreur doit
    apparaître.
15. Essayez d'uploader un fichier interdit (ex. fichier `.exe` ou `.doc`) : un
    message d'erreur doit apparaître.

### Ce que vous devez voir

- Interface claire avec les 4 blocs visibles et un compteur "X formulaires à
  compléter"
- **Une barre de progression %** par bloc, qui évolue à la saisie
- **Un seul bouton "Valider le bloc"** par formulaire (plus deux séparés)
- **Pastille verte "Complet ✓"** quand un bloc atteint 100%
- **Auto-fill effectif** : nom + téléphone contact urgence préremplis dans les
  Renseignements ; "Fait à" prérempli dans la Liaison
- Sauvegarde automatique (pas besoin de cliquer "Enregistrer" tout le temps)
- Upload qui fonctionne pour les formats autorisés (PDF, JPG, PNG, WebP)
- Refus clair et poli des formats ou tailles non autorisés
- Possibilité de télécharger le document rempli au format PDF
- Possibilité d'envoyer le PDF par email

### Points d'attention ⚠️

- **Sauvegarde automatique** : vraiment automatique ou faut-il cliquer ?
- Si vous saisissez vite, le texte suit-il sans saccade ?
- Les dates de naissance, numéros de téléphone, emails : format validé ?
- Upload : indicateur de progression visible ?
- Pouvez-vous supprimer un fichier uploadé par erreur ?

### Tableau

| # | Action | Attendu | Observé | OK ? | Captures | Remarques |
|---|---|---|---|---|---|---|
| 10.1 | Ouvrir lien dossier depuis mail | Page s'ouvre, compteur "X formulaires à compléter" affiché | | | | |
| 10.2 | Voir les 4 blocs | Onglets/cartes visibles | | | | |
| 10.3 | Voir la barre de progression % par bloc | Barre visible, compteur "X% — n/total" | | | | |
| 10.4 | Remplir bulletin partiel | Barre % qui progresse, fluide | | | | |
| 10.5 | Cliquer "Valider le bloc" (un seul bouton) | Validation OK, plus deux boutons séparés | | | | |
| 10.6 | Fermer puis rouvrir | Données conservées | | | | |
| 10.7 | Vérifier auto-fill contact urgence (Bulletin → Renseignements) | Nom + téléphone préremplis | | | | |
| 10.8 | Vérifier auto-fill "Fait à" (Bulletin → Liaison) | Lieu prérempli | | | | |
| 10.9 | Remplir sanitaire complet | Tous champs utilisables, barre à 100% | | | | |
| 10.10 | Voir pastille verte "Complet ✓" à 100% | Pastille affichée | | | | |
| 10.11 | Remplir liaison jeune | Champs clairs | | | | |
| 10.12 | Upload PDF < 5 Mo | Accepté, visible dans la liste | | | | |
| 10.13 | Upload fichier > 5 Mo | Refusé avec message clair | | | | |
| 10.14 | Upload .exe | Refusé avec message clair | | | | |
| 10.15 | Supprimer un upload | Fonctionne | | | | |
| 10.16 | Générer PDF bulletin | Téléchargement possible | | | | |
| 10.17 | Envoyer PDF par mail | Mail reçu | | | | |

---

## Parcours 11 — Signer et envoyer le dossier complet à GED

**Où :** Ordinateur (idéalement avec un pavé tactile ou un écran tactile pour
la signature)
**Temps :** 15 minutes

### Étapes

1. Dans chaque bloc, cherchez la zone de **signature** (souvent en bas).
2. Signez avec votre souris ou votre doigt (sur tablette).
3. Essayez d'effacer et de recommencer.
4. Une fois **les 4 blocs complétés (100%) et signés**, cherchez un bouton
   **"Envoyer le dossier à GED"** ou **"Soumettre"**.
5. **Bonne nouvelle** : l'envoi est désormais **possible même s'il manque
   certaines pièces jointes optionnelles** (vaccins, attestation assurance,
   etc.). Le blocage ne porte que sur les 4 formulaires + signatures.
6. Si un bloc est incomplet ou non signé, le bouton doit être grisé ou vous
   signaler quoi compléter.
7. Envoyez.
8. Après l'envoi, vérifiez que la liste des **PJ optionnelles manquantes**
   apparaît dans le récap (ex. *"Dossier envoyé. 2 documents optionnels
   manquants : vaccins, assurance"*).
9. Vous devez recevoir un **email d'accusé de réception**.
10. Essayez d'envoyer une 2e fois : un message doit vous dire "déjà envoyé".

### Ce que vous devez voir

- Zone de signature claire avec bouton "Effacer"
- Visualisation de la signature après tracé
- Bouton d'envoi **actif dès que les 4 blocs sont à 100% et signés**, même si
  des PJ optionnelles manquent
- Liste claire de ce qui manque si un bloc/signature est incomplet
- Récap post-envoi listant les PJ optionnelles manquantes (le cas échéant)
- Email d'accusé de réception envoyé à l'éducatrice (vous)
- Message "dossier déjà envoyé" si tentative 2

### Tableau

| # | Action | Attendu | Observé | OK ? | Captures | Remarques |
|---|---|---|---|---|---|---|
| 11.1 | Signer avec la souris | Trait visible | | | | |
| 11.2 | Effacer signature | Bouton fonctionnel | | | | |
| 11.3 | Essayer d'envoyer avec un bloc incomplet | Empêché, message clair | | | | |
| 11.4 | Envoyer avec PJ optionnelles manquantes | Succès (envoi autorisé) | | | | |
| 11.5 | Voir la liste des PJ manquantes dans le récap | Liste affichée post-envoi | | | | |
| 11.6 | Mail accusé réception | Reçu < 3 min | | | | |
| 11.7 | Retenter un envoi | Bloqué "déjà envoyé" | | | | |

---

# BLOC C — Vous êtes la direction ou la secrétaire de la structure

**Décor :** Vous êtes maintenant la directrice ou le directeur du foyer qui
emploie plusieurs éducatrices. Vous avez un **code spécial à 10 caractères**
(fourni par GED) qui vous donne accès à un tableau de bord.

Vous pouvez :
- Voir toutes les inscriptions de votre structure
- Gérer votre équipe (inviter, retirer des membres)
- Déléguer temporairement vos pouvoirs à un adjoint (CDS)
- Remplir un dossier enfant à la place d'une éducatrice absente

---

## Parcours 12 — Se connecter en direction

**Où :** Ordinateur
**Temps :** 5 minutes

### Étapes

1. Allez sur **https://app.groupeetdecouverte.fr**
2. Cherchez un lien **"Espace structure"** ou **"Directeur·rice / CDS"**.
   S'il n'y a pas de lien depuis l'accueil, testez directement l'adresse :
   **https://app.groupeetdecouverte.fr/structure/[votre-code-10-chars]**
3. Une page d'accès s'ouvre : entrez votre code 10 caractères.
4. Acceptez l'engagement RGPD si c'est la première fois.
5. Vous arrivez sur un tableau de bord "direction".

### Ce que vous devez voir

- Une page d'accueil spécifique "direction"
- Le nom de la structure affiché clairement
- Des onglets ou sections : Équipe · Inscriptions · Dossiers · Paramètres
- Les infos du compte direction (email, nom de la structure)

### Points d'attention

- Le code à 10 caractères est-il respecté à la lettre (majuscules,
  minuscules) ?
- Que se passe-t-il si on entre un code invalide ? (message d'erreur clair)
- Que se passe-t-il si on entre un code expiré ?
- La page est-elle adaptée ordinateur ET mobile ?

### Tableau

| # | Action | Attendu | Observé | OK ? | Captures | Remarques |
|---|---|---|---|---|---|---|
| 12.1 | Trouver l'accès direction | Visible depuis accueil | | | | |
| 12.2 | Entrer code 10 chars | Accès accordé | | | | |
| 12.3 | Voir dashboard direction | Onglets visibles | | | | |
| 12.4 | Entrer un mauvais code | Message d'erreur poli | | | | |
| 12.5 | Tester sur mobile | Affichage adapté | | | | |

---

## Parcours 13 — Inviter une secrétaire dans l'équipe

**Où :** Ordinateur
**Temps :** 15 minutes

La direction peut inviter des collaborateurs (secrétaires, éducateurs). Chaque
invité reçoit un email avec un lien pour créer son propre mot de passe.

### Étapes

1. Dans le dashboard direction, allez dans l'onglet **"Équipe"**.
2. Cliquez sur **"Inviter un membre"**.
3. Remplissez le formulaire :
   - Email : votre mail perso (vous allez recevoir l'invitation en tant que
     secrétaire)
   - Prénom : "Sophie"
   - Nom : "Test"
   - Rôle : **Secrétariat**
4. Validez.
5. Vérifiez que dans la liste "Équipe", Sophie apparaît avec statut
   **"En attente"**.
6. Allez dans votre boîte mail : vous devez recevoir un email d'invitation
   avec un lien d'activation.
7. **Ne cliquez pas encore** sur le lien.
8. Retournez dans le dashboard direction. Essayez de **renvoyer l'invitation**
   (bouton "Réinviter").
9. Vérifiez que vous recevez un 2e email et que l'ancien lien devient
   invalide.

### Ce que vous devez voir

- Interface claire pour ajouter un membre
- Champs bien nommés ("Rôle" = secrétariat / éducateur)
- Message de confirmation après invitation
- Liste d'équipe avec statuts visibles (En attente / Actif / Révoqué)
- Mail d'invitation pro, avec lien d'activation
- Réinvitation possible

### Points d'attention ⚠️

- Le mail contient-il la mention **"Lien personnel à ne pas transmettre"** ?
  (obligation RGPD)
- L'expéditeur est-il bien `noreply@groupeetdecouverte.fr` ?
- Combien de temps avant que le lien expire ? (devrait être indiqué)
- Essayez d'**inviter la même personne 2 fois** : que se passe-t-il ?

### Tableau

| # | Action | Attendu | Observé | OK ? | Captures | Remarques |
|---|---|---|---|---|---|---|
| 13.1 | Aller dans onglet Équipe | Accessible | | | | |
| 13.2 | Inviter un membre | Formulaire clair | | | | |
| 13.3 | Voir membre "En attente" | Dans la liste | | | | |
| 13.4 | Recevoir mail d'invitation | Arrivée < 3 min | | | | |
| 13.5 | Vérifier mention lien personnel | Présente | | | | |
| 13.6 | Réinviter | Nouveau mail reçu | | | | |
| 13.7 | Ancien lien invalide | Confirmé | | | | |

---

## Parcours 14 — La secrétaire active son compte

**Où :** Ordinateur
**Temps :** 10 minutes

Vous êtes maintenant Sophie, la secrétaire invitée au parcours 13.

### Étapes

1. Ouvrez votre mail perso (c'est vous, jouant Sophie).
2. Cliquez sur le lien d'activation dans le mail d'invitation.
3. Une page s'ouvre : **"Créer votre mot de passe"**.
4. Essayez un mot de passe **très faible** : "1234" → doit être refusé.
5. Créez un mot de passe fort (ex: `TestSecret2026!`).
6. Validez.
7. Vous êtes connectée automatiquement à l'espace structure côté secrétaire.
8. Vérifiez que vous voyez **moins de choses** qu'en direction : pas de
   gestion d'équipe, pas de paramètres — mais accès aux dossiers enfants.

### Ce que vous devez voir

- Page "Créer mot de passe" claire
- Règles de mot de passe affichées (longueur minimale, caractères requis)
- Refus clair des mots de passe faibles
- Connexion automatique après création
- Dashboard secrétariat : plus limité que direction

### Tableau

| # | Action | Attendu | Observé | OK ? | Captures | Remarques |
|---|---|---|---|---|---|---|
| 14.1 | Cliquer lien activation | Page s'ouvre | | | | |
| 14.2 | Règles mdp affichées | Visibles | | | | |
| 14.3 | Tester mdp faible "1234" | Refusé | | | | |
| 14.4 | Créer mdp fort | Accepté, connexion auto | | | | |
| 14.5 | Voir dashboard secrétariat | Plus limité que direction | | | | |

---

## Parcours 15 — La secrétaire remplit un dossier à la place d'une éducatrice absente

**Où :** Ordinateur
**Temps :** 20 minutes

**Contexte réel :** l'éducatrice Jeanne est en arrêt maladie. Une inscription
urgente doit être remplie avant la fin de semaine. La secrétaire a le droit de
le faire à sa place — mais une trace complète est gardée.

### Étapes

1. Connectez-vous en secrétariat (ou retournez sur le dashboard).
2. Dans la liste des inscriptions, choisissez **l'inscription de Camille** (faite
   au parcours 9).
3. Cliquez pour ouvrir le dossier.
4. **Vérifiez que le dossier est visible et modifiable**, avec un bandeau ou
   une mention indiquant "Vous agissez à la place de l'éducatrice" ou équivalent.
5. Remplissez quelques champs manquants, enregistrez.
6. Uploadez un document.
7. Générez le PDF du bulletin.
8. Envoyez le PDF par email.
9. Soumettez le dossier à GED (si pas déjà fait au parcours 11).

### Ce que vous devez voir

- Accès complet au dossier du jeune (lecture + écriture + upload + PDF + envoi)
- Une mention claire "action en tant que secrétariat" dans l'interface
- L'éducatrice (vous en mail perso) reçoit un email de confirmation d'envoi
  **avec la secrétaire en copie cachée** (preuve que la secrétaire a bien agi
  à sa place)

### Tableau

| # | Action | Attendu | Observé | OK ? | Captures | Remarques |
|---|---|---|---|---|---|---|
| 15.1 | Connecter secrétaire | Dashboard secrétariat ouvert | | | | |
| 15.2 | Ouvrir dossier Camille | Accessible | | | | |
| 15.3 | Mention "en tant que secrétariat" | Visible | | | | |
| 15.4 | Modifier un champ | Sauvegardé | | | | |
| 15.5 | Uploader document | Accepté | | | | |
| 15.6 | Générer PDF | Téléchargé | | | | |
| 15.7 | Envoyer PDF par mail | Mail reçu par éducatrice + copie secrétaire | | | | |

---

# BLOC D — Vous êtes l'admin GED (équipe interne)

**Décor :** Vous êtes dans les bureaux de GED. Vous voyez toutes les
inscriptions, toutes les structures, tous les paiements.

---

## Parcours 16 — Connexion admin et vue d'ensemble

**Où :** Ordinateur
**Temps :** 15 minutes

### 🛑 AVANT DE COMMENCER — Relisez l'avertissement §4 du guide

Ce parcours est le **seul** où vous avez des droits d'écriture sur la vraie
prod. La règle d'or : **regardez, ne cliquez pas**. Relisez les 6 interdictions
listées dans la section "§4 Vos identifiants de test" avant de démarrer.

### Étapes

1. Connectez-vous sur **https://app.groupeetdecouverte.fr/login** (sans
   `?context=pro`) avec `Thanh.Nguyen@univ-lyon2.fr` + `TestGED2026!`
2. Vous arrivez sur le **tableau de bord admin**.
3. Explorez les sections en **consultation uniquement** :
   - Inscriptions (voir celle de Camille, vérifier qu'elle est présente)
   - Structures (voir "Structure Test Thanh")
   - Séjours (catalogue admin — **ne modifiez rien**)
   - Paiements / factures (regardez, ne cliquez pas "Relancer" / "Valider")
   - Utilisateurs

### Ce que vous devez voir

- Un tableau de bord complet et pro
- L'inscription de Camille listée avec statut (paiement reçu, dossier envoyé,
  etc.)
- Possibilité de cliquer sur une inscription pour voir tous les détails
- Statistiques ou KPIs en page d'accueil admin

### Points d'attention

- Les données sensibles (mail des enfants, info médicales) sont-elles
  masquées par défaut ?
- Y a-t-il un bouton "voir le détail" qui affiche l'info sensible seulement à
  la demande ?
- Y a-t-il une trace de "qui a consulté quoi" (audit log) ?

### Tableau

| # | Action | Attendu | Observé | OK ? | Captures | Remarques |
|---|---|---|---|---|---|---|
| 16.1 | Login admin | Accès dashboard | | | | |
| 16.2 | Trouver inscription Camille | Présente | | | | |
| 16.3 | Voir détail inscription | Accessible | | | | |
| 16.4 | Consulter dossier enfant | Accessible avec précaution RGPD | | | | |
| 16.5 | Voir paiement | Statut à jour | | | | |

---

# Vérifications transversales (à faire 1 fois en fin de test)

## Visuel et design

| # | Vérification | OK ? | Remarques |
|---|---|---|---|
| T.1 | Les couleurs sont-elles cohérentes sur toutes les pages ? | | |
| T.2 | La taille des textes est-elle lisible partout ? | | |
| T.3 | Les boutons ont-ils tous la même forme et le même style ? | | |
| T.4 | Les images sont-elles nettes et bien cadrées ? | | |
| T.5 | Y a-t-il des fautes de frappe ou de grammaire ? (noter les pages) | | |
| T.6 | Les liens cliquables sont-ils clairement identifiables ? | | |
| T.7 | Le site est-il aussi bien sur mobile que sur ordinateur ? | | |

## Performance

| # | Vérification | OK ? | Remarques |
|---|---|---|---|
| T.8 | Temps de chargement accueil | | (secondes) |
| T.9 | Temps d'ouverture fiche séjour | | |
| T.10 | Temps après validation formulaire | | |
| T.11 | Temps de génération PDF | | |

## Accessibilité

| # | Vérification | OK ? | Remarques |
|---|---|---|---|
| T.12 | Pouvez-vous naviguer au clavier (touche Tab) ? | | |
| T.13 | Y a-t-il des textes alternatifs sur les images ? | | |
| T.14 | Le contraste texte/fond est-il suffisant partout ? | | |

## Messages d'erreur

| # | Vérification | OK ? | Remarques |
|---|---|---|---|
| T.15 | Quand une erreur arrive, est-ce expliqué en français simple ? | | |
| T.16 | Y a-t-il une suggestion pour s'en sortir ? | | |
| T.17 | Les codes techniques (500, 404) sont-ils traduits en message humain ? | | |

## RGPD et confiance

| # | Vérification | OK ? | Remarques |
|---|---|---|---|
| T.18 | Mention RGPD présente à chaque collecte de données ? | | |
| T.19 | Lien "Confidentialité" accessible depuis le bas de page ? | | |
| T.20 | Lien "Mentions légales" accessible ? | | |
| T.21 | Lien "CGU / CGV" accessible ? | | |
| T.22 | Info claire sur la durée de conservation des données ? | | |

---

# Tableau de synthèse finale (à remettre à GED)

| Parcours | Nb étapes OK | Nb étapes KO | Gravité (1-5) | Commentaire global |
|---|---|---|---|---|
| P1 Découvrir | /5 | | | |
| P2 Explorer séjours | /6 | | | |
| P3 Favoris | /5 | | | |
| P4 Envoyer envies | /7 | | | |
| P5 Lire envies | /4 | | | |
| P6 Demander tarif | /6 | | | |
| P7 Demander accès pro | /5 | | | |
| P8 Login pro | /5 | | | |
| P9 Inscrire un jeune | /9 | | | |
| P10 Remplir dossier | /12 | | | |
| P11 Signer & envoyer | /6 | | | |
| P12 Login direction | /5 | | | |
| P13 Inviter membre | /7 | | | |
| P14 Activer compte | /5 | | | |
| P15 Secrétaire remplit dossier | /7 | | | |
| P16 Admin | /5 | | | |
| **Transversal** | /22 | | | |

**Gravité :**
- **1** = détail cosmétique (typo, petit alignement)
- **2** = gêne mineure (mal compris, mais on s'en sort)
- **3** = gêne majeure (fonctionnalité difficile à utiliser)
- **4** = bloquant partiel (une partie du parcours impossible)
- **5** = bloquant total (le parcours ne fonctionne pas du tout)

---

# Comment remettre votre rapport à GED

À la fin du test, vous envoyez un **seul email** à GED avec **3 pièces
jointes** :

1. **Ce guide rempli** — vos tableaux complétés (enregistrez ce fichier en
   Word ou PDF avec vos notes dans les cases)
2. **Un dossier ZIP de captures d'écran** — nommées IMG_001, IMG_002, etc.,
   correspondant à ce que vous avez mentionné dans les tableaux
3. **Un message court** (optionnel mais apprécié) — votre ressenti général en
   3-5 lignes :
   - Le meilleur moment du test
   - Le pire moment (ce qui vous a le plus frustrée)
   - Votre recommandation principale pour améliorer

### Destinataire

Email : **groupeetdecouverte@gmail.com**
Objet : **Retours test humain — [votre prénom] — [date du test]**

### Délai

Idéalement **sous 48h après la fin de votre dernière session de test**
(histoire de ne pas oublier les détails).

### Modèle d'email à reprendre

```
Bonjour,

Voici mes retours de test de l'application GED, effectués le [DATES].

J'ai complété [X]/16 parcours. Les autres n'ont pas été complétés parce
que [raison — bloquant, manque de temps, etc.]

Bilan rapide :
- Parcours qui fonctionnent bien : [liste]
- Parcours avec soucis importants : [liste + gravité]
- Parcours bloqués : [liste]

Points les plus gênants à mes yeux (top 3) :
1. ...
2. ...
3. ...

Points les plus agréables :
1. ...
2. ...

Pièces jointes :
- Guide-test-complété.pdf
- Captures-ecran.zip
- Notes-libres.txt (si pertinent)

Bien cordialement,
Thanh
```

---

# Questions fréquentes

**Je suis perdue à une étape, que faire ?**
Notez-le dans le tableau ("je n'ai pas compris, je ne trouve pas") et passez au
parcours suivant. C'est l'info la plus précieuse pour nous.

**J'ai cassé quelque chose ?**
Impossible. Vous êtes dans un environnement de test isolé. Toutes vos actions
sont marquées "test" côté base de données et n'affectent ni les vraies
familles ni les vrais éducateurs.

**Un email n'arrive pas, j'attends combien ?**
3 à 5 minutes maximum. Au-delà, notez "mail non reçu" et passez. Vérifiez
toujours les spams avant.

**Je ne reçois rien du tout ?**
Contactez l'équipe GED : le serveur mail est peut-être en panne. On vous dira.

**À qui j'envoie mes retours ?**
Remettez ce document rempli + vos captures d'écran à
`groupeetdecouverte@gmail.com` ou à la personne qui vous l'a transmis.

---

**Bon courage, et merci.**

L'équipe GED
