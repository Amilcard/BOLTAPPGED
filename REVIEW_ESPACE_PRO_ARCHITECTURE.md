# Revue Architecture Espace Pro GED_APP
## Logique actuelle, complétude, RGPD et bonnes pratiques

Date : 2026-03-17 | Projet : GED_APP / Groupe et Découverte

---

## T1 — Logique actuelle de l'espace pro

### Parcours réel de l'application

L'espace pro s'articule autour de **4 phases** implémentées dans l'app :

| Phase | Fonction | Route / Composant |
|-------|----------|--------------------|
| 1. Inscription | Le référent (éducateur, travailleur social) inscrit un jeune à un séjour | `POST /api/inscriptions` → formulaire public |
| 2. Suivi séjour | L'admin GED suit les documents reçus, besoins pris en compte, équipe informée | `PUT /api/admin/inscriptions/[id]` |
| 3. Préférences | Le référent indique ses préférences de communication et besoins spécifiques | `PATCH /api/suivi/[token]` |
| 4. Dossier enfant | Le référent complète les fiches administratives en ligne (bulletin, sanitaire, liaison) | `DossierEnfantPanel` + API dédiée |

### Accès par rôle

**Ce que le PRO (référent) peut voir et faire** via `/suivi/[token]` :
- Voir **tous ses dossiers** (multi-enfants, multi-séjours) regroupés par email
- Pour chaque dossier : nom du jeune, séjour, date, ville départ, prix, statut inscription, statut paiement, méthode de paiement, référence paiement
- Voir le statut des documents (`documents_status`) et si les besoins ont été pris en compte
- Voir la `note_pro` rédigée par l'admin GED
- Modifier ses préférences : nouvelles pendant le séjour, canal de contact, bilan de fin, consignes communication, besoins spécifiques
- Compléter le dossier enfant en ligne (3 fiches)

**Ce que l'ADMIN GED peut voir et faire** via `/admin/demandes` :
- Toutes les inscriptions, tous les référents
- Changer le statut de l'inscription (en_attente, validee, refusee, annulee)
- Mettre à jour : `documents_status`, `besoins_pris_en_compte`, `equipe_informee`, `note_pro`
- Consulter les fiches dossier enfant complétées
- Générer/télécharger des PDFs
- Voir les alertes santé (allergies, PAI, AEEH)

**Ce qui est déjà rempli en ligne** :
- Formulaire d'inscription complet (infos jeune, référent, organisation, options)
- Préférences de suivi (Phase 3)
- Dossier enfant : bulletin de complément, fiche sanitaire, fiche de liaison jeune

**Ce qui relève encore du papier / document / traitement manuel** :
- Pièces jointes / justificatifs (champ `documents_joints` en JSONB, mais pas d'upload implémenté dans l'UI)
- Fiche de renseignements (`fiche_renseignements` dans le schéma mais pas de composant formulaire visible)
- Réception des paiements par virement ou chèque (vérification manuelle)
- Validation physique de documents papier que le référent pourrait envoyer hors app

---

## T2 — Logique de complétude des informations

### Système de complétude actuel

La complétude est suivie à **deux niveaux** :

#### Niveau inscription (`gd_inscriptions`)

| Champ | Valeurs | Qui le gère |
|-------|---------|-------------|
| `status` | `en_attente`, `validee`, `refusee`, `annulee` | Admin |
| `payment_status` | `pending_payment`, `paid`, `failed` | Auto (Stripe) ou Admin |
| `documents_status` | `en_attente`, `partiellement_recus`, `complets` | Admin |

#### Niveau dossier enfant (`gd_dossier_enfant`)

| Document | Champ données | Flag complétude |
|----------|--------------|-----------------|
| Bulletin de complément | `bulletin_complement` (JSONB) | `bulletin_completed` (bool) |
| Fiche sanitaire | `fiche_sanitaire` (JSONB) | `sanitaire_completed` (bool) |
| Fiche de liaison jeune | `fiche_liaison_jeune` (JSONB) | `liaison_completed` (bool) |

**Calcul de progression** : `completedCount / 3` → affiché en fraction (0/3, 1/3, 2/3, 3/3) et en pourcentage.

### Ce qui manque ou reste flou

1. **Pas de statut global de complétude du dossier** — Le `documents_status` côté inscription est géré manuellement par l'admin et n'est **pas synchronisé automatiquement** avec les flags `*_completed` du dossier enfant. Un référent peut avoir complété 3/3 fiches en ligne, mais l'admin doit encore manuellement passer `documents_status` à `complets`.

2. **Pas de granularité intermédiaire dans les fiches** — Chaque fiche est soit `completed` soit non. Il n'y a pas de statut "en cours de saisie" persisté (le formulaire peut être sauvegardé partiellement, mais le flag `completed` n'est `true` que quand le référent valide explicitement).

3. **Le champ `fiche_renseignements`** existe dans le schéma mais n'a pas de formulaire. Son rôle vis-à-vis de la complétude est indéfini.

4. **Les pièces jointes** (`documents_joints`) existent dans le schéma mais pas dans l'interface. La complétude documentaire ne les intègre pas encore.

### Verdict

La logique de complétude est **partiellement structurée** : elle fonctionne bien pour les 3 fiches en ligne, mais il manque :
- Un lien automatique entre les flags `*_completed` et le `documents_status` admin
- Un statut intermédiaire "sauvegardé mais pas validé"
- L'intégration des pièces jointes dans le calcul de complétude

---

## T3 — Cartographie des catégories d'informations

### A. Administratif

| Données | Espace pro | En ligne | Limiter | Cloisonner |
|---------|-----------|----------|---------|------------|
| Nom, prénom, date naissance du jeune | Oui | Oui (inscription) | Non | Non |
| Organisation / structure | Oui | Oui | Non | Non |
| Référent (nom, email, tel) | Oui | Oui | Non | Non |
| N° dossier (`dossier_ref`) | Oui | Auto-généré | Non | Non |
| Responsables légaux (resp1, resp2) | Via fiche sanitaire | Oui | Non | Non |
| Délégations (personnes autorisées) | Via fiche sanitaire | Oui | Non | Non |
| Classe, sexe | Via fiche sanitaire | Oui | Non | Non |

**Verdict** : Place légitime dans l'espace pro. Peut être rempli en ligne. Pas de restriction nécessaire au-delà du contrôle d'accès par token.

### B. Financier

| Données | Espace pro | En ligne | Limiter | Cloisonner |
|---------|-----------|----------|---------|------------|
| Prix total | Oui | Auto-calculé | Non | Non |
| Méthode de paiement | Oui | Oui | Non | Non |
| Référence de paiement | Oui | Auto-générée | Non | Non |
| Statut de paiement | Oui (lecture) | Auto/Admin | Non | Non |
| Quotient familial CAF | Via fiche sanitaire | Oui | **Oui** | **Oui** |
| IBAN/BIC GED | Via email | Non (env vars) | Non | Non |

**Verdict** : Le quotient familial CAF est une **donnée sensible** — il révèle la situation financière de la famille. Il est actuellement dans la fiche sanitaire, ce qui est **discutable** (ce n'est pas une donnée médicale). Le reste est standard.

### C. Logistique séjour

| Données | Espace pro | En ligne | Limiter | Cloisonner |
|---------|-----------|----------|---------|------------|
| Séjour choisi (slug, titre marketing) | Oui | Oui | Non | Non |
| Session / date | Oui | Oui | Non | Non |
| Ville de départ / transport | Oui | Oui | Non | Non |
| Options éducatives | Oui | Oui | Non | Non |

**Verdict** : Standard. Bien implémenté. Aucun problème.

### D. Parcours / Éducatif / Autonomie

| Données | Espace pro | En ligne | Limiter | Cloisonner |
|---------|-----------|----------|---------|------------|
| Options éducatives | Oui | Oui | Non | Non |
| Fiche de liaison jeune | Oui | Oui | Non | Non |
| Besoins spécifiques (texte libre) | Oui | Oui | Limite 1000 car. | Non |
| Consignes de communication | Oui | Oui | Limite 500 car. | Non |

**Verdict** : Bien cadré. Les limites de caractères sont en place. Le contenu des besoins et consignes peut contenir des informations sensibles de facto (ex: "l'enfant est suivi par un juge") — mais c'est un champ libre, difficile à cloisonner techniquement.

### E. Santé / Vigilance / Données sensibles

| Données | Espace pro | En ligne | Limiter | Cloisonner |
|---------|-----------|----------|---------|------------|
| Vaccinations (9 vaccins + dates) | Via fiche sanitaire | Oui | Non | **Oui** |
| Poids, taille | Via fiche sanitaire | Oui | Non | Non |
| Traitement en cours | Via fiche sanitaire | Oui | **Oui** | **Oui** |
| Allergies (asthme, alimentaire, médicamenteuse) | Via fiche sanitaire | Oui | **Oui** | **Oui** |
| PAI (Plan d'Accueil Individualisé) | Via fiche sanitaire | Oui | **Oui** | **Oui** |
| AEEH (handicap) | Via fiche sanitaire | Oui | **Oui** | **Oui** |
| Médecin traitant | Via fiche sanitaire | Oui | Non | Non |
| Problèmes de santé | Via fiche sanitaire | Oui | **Oui** | **Oui** |
| Autorisation de soins | Via fiche sanitaire | Oui | Non | Non |
| Recommandations parents | Via fiche sanitaire | Oui | Non | Non |

**Verdict** : C'est la catégorie la plus sensible (voir T4). La fiche sanitaire contient des **données de santé** au sens RGPD, qui nécessitent un traitement renforcé. L'architecture actuelle les stocke en JSONB dans un champ unique, ce qui est fonctionnel mais ne permet pas un cloisonnement fin.

### F. Préférences de suivi / Communication

| Données | Espace pro | En ligne | Limiter | Cloisonner |
|---------|-----------|----------|---------|------------|
| Préférence nouvelles séjour | Oui | Oui | Non | Non |
| Canal de contact préféré | Oui | Oui | Non | Non |
| Bilan fin de séjour | Oui | Oui | Non | Non |
| Consignes communication | Oui | Oui | 500 car. | Non |

**Verdict** : Standard. Bien implémenté, avec whitelist stricte de valeurs autorisées et sanitization.

### G. Pièces jointes / Justificatifs

| Données | Espace pro | En ligne | Limiter | Cloisonner |
|---------|-----------|----------|---------|------------|
| Documents joints (`documents_joints`) | Prévu (JSONB) | **Non implémenté** | **Oui** | **Oui** |
| PDFs générés (fiches complétées) | Admin (download) | Non | Non | Non |

**Verdict** : L'upload de pièces jointes n'est pas encore implémenté dans l'UI. Le champ existe dans le schéma. Quand il sera implémenté, il faudra un contrôle d'accès strict et un stockage sécurisé (Supabase Storage avec RLS).

---

## T4 — Ce qui relève du RGPD

### Classification des données

#### 1. Données standard (traitement classique, base légale = exécution du contrat)
- Nom, prénom du jeune
- Date de naissance
- Organisation / structure
- Référent (nom, email, tel)
- Responsables légaux (nom, prénom, adresse, tel)
- Séjour, date, ville de départ, prix
- Statut inscription et paiement
- Options éducatives
- Préférences de communication

#### 2. Données à accès restreint (traitement justifié, mais accès limité)
- Quotient familial CAF/MSA → révèle la situation économique
- Besoins spécifiques (champ libre) → peut contenir des informations sur la situation sociale
- Consignes de communication → peut contenir des éléments sur le contexte familial
- N° allocataire CAF/MSA
- Personnes délégataires et leur lien avec l'enfant

#### 3. Données sensibles (article 9 RGPD — traitement interdit sauf exception)
- **Données de santé** : allergies, asthme, traitements en cours, problèmes de santé, PAI
- **Données de handicap** : AEEH (Allocation d'Éducation de l'Enfant Handicapé)
- **Données médicales** : vaccinations, médecin traitant, autorisation de soins, poids/taille
- **Base légale nécessaire** : intérêt vital de l'enfant (soins urgents) + consentement explicite (autorisation de soins)

#### 4. Informations qui ne devraient PAS circuler par email
- Détails médicaux (allergies, traitements, PAI)
- Statut AEEH
- Quotient familial
- Contenu détaillé de la fiche sanitaire
- Toute pièce jointe contenant des données de santé

### État actuel dans l'app

**Points positifs** :
- L'API `/api/suivi/[token]` utilise un **SELECT explicite** des colonnes — pas de `SELECT *`. Les données sensibles du dossier enfant (fiche sanitaire JSONB) ne sont **pas exposées** dans l'API de suivi. C'est une bonne pratique.
- Les emails de confirmation ne contiennent **aucune donnée de santé**. Ils sont limités à : nom, séjour, date, prix, paiement, lien de suivi.
- La whitelist stricte du PATCH empêche toute modification de champ non autorisé.

**Points de vigilance** :
- La fiche sanitaire est stockée en **JSONB brut** dans `gd_dossier_enfant.fiche_sanitaire`. Il n'y a pas de chiffrement au repos spécifique à ce champ (au-delà du chiffrement disque de Supabase/Postgres).
- L'admin voit **toutes les données santé** dans le détail modal. C'est nécessaire opérationnellement, mais il n'y a pas de journalisation d'accès (audit log).
- Le `DossierEnfantAdminBlock` affiche des alertes santé en résumé. Si ces données apparaissent dans des captures d'écran ou des exports, c'est un risque.
- Le **quotient familial** est dans la fiche sanitaire, alors qu'il relève davantage du financier/social.

---

## T5 — Évaluation par rapport aux bonnes pratiques

### 1. UX / Simplicité pour les éducateurs et pros

| Critère | Évaluation |
|---------|------------|
| Accès sans compte (magic link token) | **Bon** — pas de friction d'inscription, adapté aux pros qui gèrent ponctuellement |
| Vue multi-dossiers regroupés par email | **Bon** — un référent voit tous ses jeunes d'un coup |
| Formulaires progressifs (sauvegarde partielle) | **Bon** — le hook `useDossierEnfant` permet la sauvegarde bloc par bloc |
| Préférences modifiables par le référent | **Bon** — whitelist stricte, UX claire |
| Complétude visible (0/3, 1/3...) | **Partiellement bon** — le compteur fonctionne mais manque de feedback détaillé sur ce qui reste à faire |

### 2. Lisibilité du dossier et du suivi

| Critère | Évaluation |
|---------|------------|
| Statuts clairs et distincts | **Partiellement bon** — 3 axes de statut (inscription, paiement, documents) mais pas de statut synthétique global |
| Note pro visible des deux côtés | **Bon** — l'admin écrit, le référent lit |
| Séparation phases | **Bon** — 4 phases identifiées et implémentées |
| Absence de tableau de bord synthétique côté admin | **À améliorer** — l'admin n'a pas de vue globale "combien de dossiers incomplets" |

### 3. Minimisation et protection des données

| Critère | Évaluation |
|---------|------------|
| SELECT explicite dans l'API suivi (pas de SELECT *) | **Bon** |
| Whitelist de champs éditables | **Bon** |
| Emails sans données sensibles | **Bon** |
| Validation UUID sur les tokens | **Bon** |
| Vérification propriété du dossier (même referent_email) | **Bon** |
| Pas de chiffrement spécifique des données santé | **À améliorer** |
| Pas d'audit log des accès aux données sensibles | **À améliorer** |
| Pas d'expiration des tokens de suivi | **À améliorer** |

### 4. Exploitabilité opérationnelle pour GED

| Critère | Évaluation |
|---------|------------|
| Admin peut changer les statuts rapidement | **Bon** |
| Admin voit les alertes santé | **Bon** (opérationnellement nécessaire) |
| Pas de synchronisation auto documents_status ↔ fiches complétées | **À améliorer** |
| Pas de notification quand un référent complète un dossier | **À améliorer** |
| PDF téléchargeables | **Bon** |

---

## T6 — Écarts et zones floues identifiés

### 1. Mélange données administratives et sensibles
La fiche sanitaire (`FicheSanitaireForm`) contient à la fois :
- Des données admin pures (responsables légaux, adresses, téléphones, classe, sexe)
- Des données financières (quotient familial CAF, allocataire)
- Des données de santé strictes (allergies, PAI, traitements)

**Risque** : En accédant à la fiche sanitaire, on accède à tout en bloc. Pas de granularité.

### 2. Visibilité côté pro — correcte mais à surveiller
Le SELECT explicite dans `/api/suivi/[token]` est bien fait : il n'expose pas les données JSONB du dossier enfant. **Mais** : si le référent a accès au `DossierEnfantPanel` pour remplir les fiches, il a évidemment accès aux données qu'il a saisies lui-même. Ce n'est pas un problème si le token n'est pas partagé. Le risque est un token qui "fuite" (transféré par email, copié dans un système tiers).

### 3. Absence de séparation claire entre champs à remplir et pièces à joindre
Le schéma prévoit `documents_joints` (JSONB array) mais l'UI ne propose pas d'upload. Résultat : le `documents_status` admin est géré "en l'air", sans lien avec des fichiers réels dans l'app. La complétude documentaire est **déclarative côté admin**, pas factuelle.

### 4. Statuts de complétude insuffisants
- Pas de distinction entre "formulaire ouvert mais pas commencé" et "formulaire sauvegardé partiellement"
- Le `documents_status` admin est déconnecté de la complétude réelle des fiches en ligne
- Pas de statut global "dossier complet" combinant inscription + paiement + documents + fiches

### 5. Emails — bien maîtrisés
Les emails actuels sont **propres** : pas de données de santé, pas de pièces jointes, juste un récapitulatif inscription + lien de suivi. **Point d'attention** : le lien de suivi dans l'email est un secret — s'il est forwarded, le destinataire a accès à tous les dossiers du référent.

### 6. Accès insuffisamment cloisonnés
- Le token donne accès à **tous** les dossiers du même email. Si un référent gère 15 jeunes, le token les expose tous.
- Pas de mécanisme de révocation de token
- Pas d'expiration de token (un lien envoyé il y a 2 ans fonctionne toujours)
- L'admin utilise la `SUPABASE_SERVICE_ROLE_KEY` directement dans les routes API (pas de RLS active sur ces routes)

### 7. Fiche renseignements : zone morte
Le champ `fiche_renseignements` et `renseignements_completed` existent dans le schéma mais aucun formulaire n'est implémenté. C'est un vestige ou un travail à venir — à clarifier pour éviter la confusion.

---

## T7 — Logique cible recommandée

### Architecture cible simple et compatible avec l'existant

```
INSCRIPTION (Phase 1)
    │
    ├── Infos jeune (nom, prénom, date naissance)
    ├── Infos référent (nom, email, tel, organisation)
    ├── Choix séjour + session + transport
    ├── Options éducatives
    └── Paiement → statut auto (Stripe) ou manuel (virement/chèque)

COMPLÉMENT DOSSIER EN LIGNE (Phase 4 — accessible via token)
    │
    ├── Bloc A : Bulletin de complément (admin pur)
    │     → responsables, contacts, délégations
    │
    ├── Bloc B : Fiche de liaison jeune (éducatif)
    │     → parcours, autonomie, besoins équipe
    │
    └── Bloc C : Fiche sanitaire (santé — SENSIBLE)
          → vaccins, allergies, traitements, PAI, AEEH
          → ⚠️ Ne doit PAS contenir le quotient familial
          → ⚠️ Accès restreint côté admin (audit log souhaitable)

STATUT DE COMPLÉTUDE (cible)
    │
    ├── Inscription : en_attente → validee / refusee / annulee
    ├── Paiement : pending_payment → paid / failed
    ├── Fiches en ligne : 0/3 → 1/3 → 2/3 → 3/3 (auto)
    ├── Documents papier / PJ : en_attente → partiellement_recus → complets (admin)
    └── ★ Statut global synthétique (NOUVEAU) :
          "incomplet" | "en_cours" | "pret" | "validé"
          → calculé automatiquement à partir des 4 axes ci-dessus

SUIVI DU DOSSIER (Phase 2+3 — via token)
    │
    ├── Vue synthétique multi-dossiers
    ├── Statut global par dossier (badge couleur)
    ├── Préférences de communication
    └── Note pro de l'admin (lecture seule)

LECTURE ADMIN vs LECTURE PRO
    │
    ├── PRO : voit ses dossiers, statuts, note_pro, peut modifier préférences et fiches
    ├── ADMIN : voit tout, peut modifier statuts, note_pro, documents_status
    └── ADMIN sur données santé : accès nécessaire mais à journaliser
```

### Principes directeurs

1. **Le référent est autonome** : il remplit et complète en ligne, il voit l'avancement
2. **L'admin arbitre** : il valide, il note, il confirme la complétude documentaire
3. **Les données sensibles restent dans l'app** : pas dans les emails, pas dans les exports non sécurisés
4. **La complétude est hybride** : auto (fiches en ligne) + déclarative (documents papier/PJ admin)
5. **Le token est un secret** : il doit être traité comme un mot de passe (expiration, révocation à terme)

---

## T8 — Ajustements : maintenant vs plus tard

### A. Ajustements immédiats (faible risque, haute valeur)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| A1 | **Déplacer le quotient familial hors de la fiche sanitaire** — Le mettre dans le bulletin de complément ou un bloc "situation familiale" séparé | Faible | RGPD : ne pas mélanger données financières et médicales |
| A2 | **Ajouter une synchronisation indicative** : quand les 3 flags `*_completed` sont `true`, afficher un indicateur côté admin (sans écraser `documents_status` qui reste sous contrôle admin) | Faible | Réduit les oublis admin |
| A3 | **Ajouter un bandeau d'avertissement** dans la fiche sanitaire rappelant que les données sont confidentielles et traitées conformément au RGPD | Très faible | Conformité, confiance utilisateur |
| A4 | **Clarifier ou supprimer `fiche_renseignements`** — Si non utilisé, retirer le champ du calcul de complétude et documenter que c'est une future extension | Très faible | Évite la confusion |
| A5 | **Ajouter `created_at` au token d'accès** dans la vérification API, pour pouvoir implémenter l'expiration plus tard sans changer le schéma | Faible | Prépare la sécurité sans casser l'existant |

### B. Améliorations utiles (à planifier)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| B1 | **Statut global synthétique calculé** combinant inscription + paiement + fiches + documents → affiché comme badge sur chaque dossier (côté pro et admin) | Moyen | UX majeure, lisibilité |
| B2 | **Notification admin quand un référent complète une fiche** (entrée dans `notification_queue`) | Moyen | Opérationnel, réduit le suivi manuel |
| B3 | **Expiration des tokens de suivi** (ex: 12 mois après la date du séjour) avec message clair si expiré | Moyen | Sécurité |
| B4 | **Upload de pièces jointes** via Supabase Storage avec RLS, intégré dans le `DossierEnfantPanel` | Moyen-Élevé | Fonctionnel, réduit le papier |
| B5 | **Audit log** pour les accès admin aux données de santé (qui a consulté quoi, quand) | Moyen | RGPD conformité renforcée |
| B6 | **Consentement explicite** avant saisie de la fiche sanitaire (case à cocher "J'autorise le traitement de ces données de santé pour...") | Faible | RGPD, base légale renforcée |

### C. À ne pas lancer tout de suite

| # | Action | Pourquoi attendre |
|---|--------|-------------------|
| C1 | Chiffrement applicatif des données de santé (chiffrement côté app en plus du chiffrement disque) | Complexité élevée, risque de régression sur les formulaires existants, le chiffrement disque Supabase suffit dans un premier temps |
| C2 | Refonte complète de la fiche sanitaire en sous-blocs séparés (santé, admin, financier) | Trop de travail pour le gain immédiat — le A1 (déplacer quotient) suffit pour l'instant |
| C3 | Système de permissions granulaires par dossier (un token par dossier au lieu d'un token par référent) | Changement de modèle d'accès trop impactant — le système actuel est cohérent pour le cas d'usage |
| C4 | Migration vers une auth classique (email + mot de passe) pour les référents | Le magic link est adapté au public cible (pros qui accèdent ponctuellement). Une auth classique ajouterait de la friction. |

---

## Synthèse

L'espace pro GED_APP est **globalement bien construit** pour son stade de développement :

- **Architecture saine** : séparation API / UI, rôles pro/admin distincts, token-based access
- **RGPD globalement respecté** : SELECT explicite, emails propres, whitelist stricte
- **Complétude fonctionnelle** : le mécanisme 0/3 → 3/3 fonctionne pour les fiches en ligne

Les **ajustements prioritaires** sont :
1. Déplacer le quotient familial hors de la fiche sanitaire (A1)
2. Lier indicativement la complétude fiches ↔ statut admin (A2)
3. Ajouter le bandeau RGPD sur la fiche sanitaire (A3)
4. Clarifier la fiche renseignements (A4)

Ces 4 actions sont faisables **sans régression, sans refonte, et sans effet cascade**.
