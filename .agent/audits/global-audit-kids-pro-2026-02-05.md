# AUDIT UX/UI & CARTOGRAPHIE FONCTIONNELLE (Kids + Pro) — V2 CONSOLIDÉE

**Date** : 05 Février 2026
**Scope** : Application GED (Accueil, Détail Séjour, Parcours Inscription/Souhait)
**Validation** : Audit croisé Code Source + Test Navigateur

---

## 1. CARTOGRAPHIE DES PARCOURS (ÉTAT RÉEL)

### 🧒 1.1 Parcours Kids (Souhait)

**Objectif** : Un enfant exprime un choix "Coeur" qui est stocké localement, puis éventuellement partagé.

| Étape | Écran / État | Actions Possibles | Données Demandées | État Réel Code |
|-------|--------------|-------------------|-------------------|----------------|
| **1. Découverte** | **Détail Séjour** | • Clic "Ce séjour m'intéresse" | Aucune | OK |
| **2. Modale** | **"Ajouté à Mes souhaits !"** | • Saisir Prénom (Requis)<br>• Saisir Email Référent (Si config activée)<br>• Saisir Motif (Optionnel) | • Prénom<br>• Email (souvent caché)<br>• Motivation | **Confusion UX** : La modale dit "Ajouté" *avant* que l'enfant ne valide ses infos. Le bouton "Enregistrer" finalise la motivation. |
| **3. Action** | **Même Modale** | • "Enregistrer ma demande" (Local)<br>• "Partager" (API Native/Mailto) | — | Deux actions concurrentes. "Partager" sort de l'app. |

**Gaps détectés vs Attentes** :
1.  **Séquencement** : L'interface confirme l'ajout *avant* la qualification.
2.  **Champs** : Pas de validation stricte (longueur min).
3.  **Partage** : Le parcours "Partager" repose sur l'API native du téléphone ou ouvre un mailto, sans garantie que l'éducateur reçoive l'info structurée si l'enfant n'envoie pas le mail.

### 👩‍💼 1.2 Parcours Pro (Inscription)

**Objectif** : Inscription formelle avec engagement.

| Étape | Titre Modale | Champs Présents | Champs MANQUANTS Critique |
|-------|--------------|-----------------|---------------------------|
| **1. Session** | Choisir une session | Liste Sessions | — |
| **2. Ville** | Ville de départ | Liste Villes | — |
| **3. Référent** | Infos travailleur social | • Organisation<br>• Nom complet<br>• Email (Basic)<br>• Téléphone (Basic) | 🔴 **Adresse Structure**<br>⚠️ Prénom distinct |
| **4. Enfant** | Infos de l'enfant | • Prénom<br>• Date Naissance (6-17 ans)<br>• Consentement | 🔴 **Sexe**<br>🔴 Nom (Hardcodé vide) |
| **5. Confirmation** | Réservation confirmée | Récapitulatif | — |

**Gaps détectés vs Attentes** :
1.  **Données Manquantes** : L'absence de l'Adresse Postale de la structure et du Sexe de l'enfant bloque probablement le dossier administratif réel.
2.  **Validation** : Aucune validation de format sur le téléphone (accepte du texte) ou l'email (juste présence @).
3.  **Apparence** : La barre de progression est muette (pas de labels d'étapes).

---

## 2. AUDIT UX/UI & RECOMMANDATIONS

### ✅ Points Forts Validés
-   **UI Générale** : L'apparence "Post-Fix" est propre, lisible et responsive.
-   **Mécanique Modale** : Le système de rattrapage (si on clique "Inscrire" sans session) fonctionne parfaitement.
-   **Feedback Prix** : Le total est bien calculé dynamiquement.

### ⚠️ Frictions & Risques (Prio P1)

#### A. Formulaire Kids : Ambiguïté "Enregistrer" vs "Partager"
L'enfant peut penser qu'en cliquant "Ce séjour m'intéresse", c'est envoyé. Or c'est juste stocké dans le navigateur.
L'action "Partager" est externe.
*Recommandation UI* : Clarifier que l'étape 1 est "Ma sélection" et l'étape 2 est "J'en parle à mon éducateur".

#### B. Formulaire Pro : incomplétude des données
L'éducateur devra être recontacté pour fournir l'adresse et le sexe.
*Recommandation UI* : Ajouter ces champs SANS ATTENDRE, en modifiant `booking-modal.tsx`.

---

## 3. CHECKLIST SÉCURITÉ & PROPOSITIONS (UI ONLY)

### 🔒 Sécurité & Validation (État requis)
- [ ] **Tel** : Regex FR simple `^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$`
- [ ] **Email** : Validation domaine stricte.
- [ ] **Anti-Spam** : Captcha ou Honeypot (actuellement via `canAddRequest` rate-limit local).

### 🎨 Wireframes Améliorés

#### Modale Kids (Révision UX)
*Titre : "Ce séjour te plaît ?" (au lieu de "Ajouté")*
```
[ ♥ Icone ]
Super choix !
Pour le retrouver plus tard ou le montrer à ton éducateur :

1. Ton Prénom : [___________]
2. Pourquoi ce séjour ? (Optionnel)
   [_______________________]

[ AJOUTER À MA LISTE > ]
```
*Une fois ajouté -> Écran Succès avec bouton "Partager"*

#### Modale Pro (Révision Champs)
*Étape 3 : Infos Structure*
```
Organisation : [___________]
Adresse Postale : [__________________________] (Nouveau)
Code Postal / Ville : [_______] [___________] (Nouveau)

Nom Référent : [___________]
Prénom Référent : [___________] (Séparé)
Tel / Email : [___________]
```

*Étape 4 : Infos Enfant*
```
Prénom : [___________]
Nom : [___________] (Réactivé ?)
Date Naissance : [JJ/MM/AAAA]
Sexe : (o) Fille (o) Garçon  (Nouveau)
```

---

## 4. CONCLUSION

L'application est visuellement prête, mais **fonctionnellement incomplète sur le formulaire Pro**.
Il est impératif d'ajouter les champs **Adresse** et **Sexe** avant ouverture réelle, sinon le back-office devra gérer ces manques manuellement.
L'UX Kids est "sympa" mais techniquement ne garantit pas la transmission de l'info (stockage local).
