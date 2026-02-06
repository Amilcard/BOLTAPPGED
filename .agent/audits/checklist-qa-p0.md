# CHECKLIST QA - VALIDATION UI P0

**Date** : 06 Février 2026
**Scope** : Formulaires Kids (Souhait) & Pro (Inscription)
**Statut** : Prêt pour validation manuelle

## 1. FORMULAIRE KIDS (Souhait)

### UI & Copy
- [ ] **Titre** : La modale s'ouvre avec "Ce séjour te plaît ?" (au lieu de "Ajouté").
- [ ] **Feedback** : Après succès, le titre devient "C'est noté !".

### Champs & Validation
- [ ] **Prénom** : Champ requis. Si vide -> Bouton désactivé.
- [ ] **Prénom Référent** : Champ présent (optionnel).
- [ ] **Email** :
    - [ ] Saisie "toto" -> Erreur "Il manque le @...".
    - [ ] Saisie "toto@gmail.com" -> Erreur disparaît.
- [ ] **Message** :
    - [ ] Saisie "Bonjour" (7 chars) -> Erreur "Ajoute un peu de détail (au moins 20 caractères)".
    - [ ] Saisie longue -> Erreur disparaît.
- [ ] **Submit** : Le bouton "Enregistrer ma demande" est grisé tant que le formulaire est invalide.

---

## 2. FORMULAIRE PRO (Inscription)

### Champs Manquants (Ajoutés)
- [ ] **Étape 3 (Structure)** : Champ "Adresse postale" présent.
    - [ ] Validation : Requis, min 10 caractères.
- [ ] **Étape 4 (Enfant)** : Champ "Sexe" présent (Select).
    - [ ] Options : Fille, Garçon, Autre.
    - [ ] Validation : Requis.

### Validation Stricte
- [ ] **Email** : "toto" refuse la soumission / affiche erreur inline.
- [ ] **Téléphone** :
    - [ ] "coucou" -> Erreur "Téléphone invalide".
    - [ ] "0612345678" -> OK.
    - [ ] "06 12 34 56 78" -> OK.

### UX & Navigation
- [ ] **Labels Étapes** :
    - [ ] 1/5 : Choisir une session
    - [ ] 2/5 : Ville de départ
    - [ ] 3/5 : Informations de la structure
    - [ ] 4/5 : Informations de l'enfant
    - [ ] 5/5 : Validation
- [ ] **Sticky Recap** :
    - [ ] En haut de la modale, vérifiez la présence du récap (Date / Ville / Total).

### Données (Pass-Through)
- [ ] **Vérification** : Après soumission, vérifier dans l'admin (ou logs) que :
    - [ ] L'adresse est bien dans le champ `notes` (ex: `[ADRESSE]: 12 rue de la Paix...`).
    - [ ] Le sexe est bien dans le champ `childNotes` (ex: `[SEXE]: F`).

---

## 3. FICHIERS MODIFIÉS

- `components/booking-modal.tsx` (Pro)
- `components/wishlist-modal.tsx` (Kids)
