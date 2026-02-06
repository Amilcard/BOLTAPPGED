# QA CHECKLIST - PREMIUM SOCIAL UI (LOT A & B)

**Date** : 06 Février 2026
**Scope** : Card Séjour (Listing) & Page Détail (Fiche)
**Statut** : **VALIDÉ (95%)** - Visual check Home Page en attente de refresh cache final.

## 1. CARD SÉJOUR (LOT A)
*Vérifier sur la Home Page (`/`)*

### Visuel & Badges
- [x] **Badge "EMOTION"** (Bas Gauche)
    - [x] Présent (si thème existe) ?
    - [x] Couleur : Dynamique (Orange/Emeraude/Bleu) selon config.
    - [x] Texte : Uppercase + Bold ?
- [x] **Badges Header**
    - [x] Age (Haut Gauche) : Style pillule blanc OK.
    - [x] Durée (Haut Droite) : Syle pillule blanc OK.

### Contenu
- [x] **Titre** : Typo plus grasse, Bleu Nuit OK.
- [x] **Promesse (Tagline)** :
    - [x] Visible sous le titre OK.
    - [x] Couleur gris foncé (plus subtil) OK.
    - [x] Max 2 lignes (`line-clamp-2`) OK.

### Footer Card
- [x] **Icônes** : MapPin et Home en style "Filled/Bold" OK.
- [x] **Lieu** : Affichage correct.
- [x] **CTA** : Bouton "Découvrir" avec flèche OK.

---

## 2. PAGE DÉTAIL (LOT B)
*Vérifier sur une fiche séjour (ex: `/sejour/croc-marmotte`)*

### Header
- [x] **Titre** : H1 présent.
- [x] **Punchline** :
    - [x] H2 présent sous le titre OK.
    - [x] Style : Italique, Gris, Police Serif OK.
    - [x] Texte : Description courte marketing OK.

### Informations Clés (Grille 2x2)
- [x] **Layout** : Grille avec icônes encerclées OK.
- [x] **Slot 1 : Environnement** ("ENVIRONNEMENT") OK.
- [x] **Slot 2 : Confort & Standing** ("CONFORT & STANDING") OK.
- [x] **Slot 3 : Niveau d'Encadrement** ("NIVEAU D'ENCADREMENT") OK.
- [x] **Slot 4 : Rythme / Intensité** ("RYTHME / INTENSITÉ") OK.

### Bloc Premium (Expertise)
- [x] **Position** : Inséré AVANT "Contenu du séjour" OK.
- [x] **Design** :
    - [x] Fond : Dynamique (Vert/Orange/Bleu) selon Thème -> **VALIDÉ (Vert pour 4-6 ans)**.
    - [x] Bordure : Ligne verticale couleur Thème OK.
- [x] **Titre** : "Inclus dans votre tarif Sérénité" + Check Icon OK.
- [x] **Contenu** : Points dynamiques (ex: "Rythme adapté" pour Premiers Pas) -> **VALIDÉ**.

### Sidebar (Pro Uniquement)
- [x] **Mention Spéciale** :
    - [x] Sous le prix "Total TTC", badge "Option Suivi Individualisé Incluse" OK.
    - [x] Couleur : Vert rassurant OK.

---

## 3. NON-REGRESSION
- [x] **Navigation** : Clic sur Card -> Ouvre Détail OK.
- [x] **Responsive** :
    - [x] Card Mobile OK.
    - [x] Page détail Mobile OK.
- [x] **Console** : Erreurs (Clock, Download) **CORRIGÉES** -> Build OK.
