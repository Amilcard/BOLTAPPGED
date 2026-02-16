# CHECKLIST QUALITÉ & UI FORMULAIRES

**Objectif** : Garantir des formulaires Kids/Pro robustes, accessibles et rassurants, sans modification lourde du backend.

## 1. UX & Microcopy (Ton)

### Kids (Souhait)
- [ ] **Titre Modale** : Remplacer "Ajouté à Mes souhaits !" par **"Ce séjour te plaît ?"** à l'ouverture (état initial).
- [ ] **Labels** : "Ton prénom" (au lieu de "Prénom").
- [ ] **Helper** : Sous le message, ajouter "Explique pourquoi tu veux y aller (ex: pour la piscine, avec les copains...)".
- [ ] **Feedback** : Après clic, afficher "C'est noté ! Tu peux le montrer à ton éducateur." + Pluie de confettis (Lottie ou CSS).

### Pro (Inscription)
- [ ] **Titre Étapes** : "Étape 1/4 : Session", "Étape 2/4 : Transport", "Étape 3/4 : Structure", "Étape 4/4 : Enfant".
- [ ] **Rappel Prix** : Ajouter un bandeau sticky ou un footer compact dans la modale : "Total estimé : {px}€ TTC".
- [ ] **Labels** : "Téléphone (portable de préférence)" pour faciliter les SMS.

## 2. Validation & Feedback Visuel (UI Only)

### Règles Globales
- [ ] **Inline Validation** : Validation au `onBlur` (quand on quitte le champ), pas à chaque touche (trop agressif), ni juste à la fin.
- [ ] **Messages d'erreur** :
    -   ❌ "Champ invalide"
    -   ✅ "Il manque le @ dans l'email"
    -   ✅ "Le téléphone doit contenir 10 chiffres"
- [ ] **État Disabled** : Bouton "Continuer" grisé tant que l'étape n'est pas valide visuellement.

### Règles Spécifiques Pro
- [ ] **Téléphone** : Nettoyage automatique des espaces à la saisie (ex: "06 12..." -> "0612...") pour éviter les erreurs de format.
- [ ] **Date Naissance** : Calcul de l'âge en temps réel affiché à côté ("12 ans") pour confirmer que c'est cohérent avec le séjour (6-12 ans).

## 3. Accessibilité (A11y)

- [ ] **Focus Management** :
    -   Ouverture modale -> Focus sur le premier champ (Prénom / Org).
    -   Erreur soumission -> Focus sur le premier champ en erreur.
- [ ] **ARIA** :
    -   `aria-invalid="true"` sur les champs en erreur.
    -   `aria-describedby="error-msg-id"` pour lier le message d'erreur au champ.
- [ ] **Clavier** : Navigation Tab logique. Validation avec Entrée.

## 4. Gaps à Combler (UI Dummy -> Functional Later)

Puisque nous ne pouvons pas modifier la base de données maintenant :
- [ ] **Adresse Structure** : Ajouter le champ visuellement. Si le backend ne le gère pas, concaténer dans le champ "Organisation" ou envoyer dans un champ "metadata" json si existant. Sinon, stocker dans `localStorage` pour pré-remplir le prochain email.
- [ ] **Sexe Enfant** : Ajouter Select (Fille/Garçon). Concaténer au Nom ou Prénom (ex: "Thomas [M]") pour que l'info passe quand même temporairement.

---

**Priorité d'Implémentation UI** :
1.  Renommage Labels & Titres (Rapide).
2.  Ajout Validation JS (Email/Tel) (Moyen).
3.  Ajout Champs Manquants (Adresse/Sexe) avec stratégie de "Pass-through" (Concaténation) pour ne pas casser le back (Critique).
