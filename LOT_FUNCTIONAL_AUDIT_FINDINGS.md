# 🔍 AUDIT FONCTIONNEL - PROBLÈMES IDENTIFIÉS

**Date :** 3 février 2026
**Lot :** CLAUDE_FUNCTIONAL_PRODUCT_AUDIT_GED_APP_SCREENS
**Mode :** economy_secure_no_regression

---

## ✅ PROBLÈMES P0 IDENTIFIÉS

### F1 - Cacher prix en mode Kids
**Statut :** ✅ **DÉJÀ CORRIGÉ** - Aucune action requise

**Vérifié dans :**
- `components/stay-card.tsx` : Pas de prix affiché sur les cards
- `app/sejour/[id]/stay-detail.tsx` (ligne 533) : Prix conditionné à `{!isKids && mounted && (`

**Conclusion :** Les prix ne s'affichent QUE en mode Pro.

---

### F5 - Badge période "ÉTÉ" vague
**Statut :** ❌ **À CORRIGER**

**Fichier :** `components/stay-card.tsx`
**Lignes :** 28-29

**Code actuel :**
```typescript
const period = stay?.period === 'printemps' ? 'Printemps' : 'Été';
```

**Problème :**
Affiche "Été" de manière trop vague au lieu de JUILLET/AOÛT précis.

**Solution proposée :**
Calculer le badge à partir des sessions (start/end dates) :
- Si juillet uniquement → "JUILLET"
- Si août uniquement → "AOÛT"
- Si juillet + août → "JUIL+AOÛT"
- Si dates manquantes → "DATES À CONFIRMER"

**Données disponibles :**
`stay?.sessions` contient `startDate` et `endDate` pour chaque session.

---

### F9 - Programme dupliqué
**Statut :** ❌ **À CORRIGER**

**Fichier :** `app/sejour/[id]/stay-detail.tsx`
**Lignes :** 255-285

**Code actuel :**
```typescript
// Section 1 (ligne 255-268) - "Au programme" / "Programme en bref"
const miniProgramme = programme.slice(0, 5);
// Affiche les 5 premiers items

// Section 2 (ligne 270-285) - "Tout le programme" / "Programme détaillé"
// Affiche TOUS les items (y compris les 5 premiers)
```

**Problème :**
Les 5 premiers items du programme sont affichés 2 fois :
1. Dans la section "Au programme" (résumé)
2. Dans la section "Tout le programme" (complet)

**Solution proposée (Option A - Simple) :**
Supprimer la section "Au programme" (ligne 252-268). Garder uniquement "Tout le programme" avec tous les items.

**Alternative (Option B - Mieux UX mais plus complexe) :**
- Section 1 : Afficher les 5 premiers items
- Section 2 : Afficher SEULEMENT les items à partir de l'index 5 (reste du programme)

Pour le LOT FONCTIONNEL sans toucher au graphisme, **Option A** est recommandée.

---

### F10 - Mention "partenaire"
**Statut :** ❌ **À CORRIGER**

**Fichier :** `app/sejour/[id]/stay-detail.tsx`
**Ligne :** 462

**Code actuel :**
```html
<span>La connaissance du projet associatif de notre partenaire</span>
```

**Problème :**
Référence explicite au partenaire (probablement UFOVAL) à retirer.

**Solution proposée :**
Remplacer par un texte générique :
```html
<span>La connaissance du projet pédagogique et éducatif</span>
```
ou simplement retirer cette ligne si le contexte le permet.

---

## ✅ PROBLÈMES NON PRIORITAIRES OU DÉJÀ RÉSOLUS

### F2 - Prix dynamiques Pro
**Statut :** ⚠️ **À VÉRIFIER** (nécessite tests en conditions réelles)

Le code utilise déjà `getPriceBreakdown()` et `findSessionPrice()` pour calculer les prix dynamiques. À tester avec des sessions/villes réelles.

### F3 - Date de naissance Pro
**Statut :** 🔍 **NON VÉRIFIÉ** (nécessite lecture du BookingModal)

À vérifier dans `components/booking-modal.tsx`.

### F4 - Bandes d'âge précises
**Statut :** 🔍 **NON VÉRIFIÉ**

Code actuel dans stay-card.tsx (ligne 85) :
```typescript
<span className="text-xs font-medium text-gray-700">{stay?.ageMin ?? 0}-{stay?.ageMax ?? 0}</span>
```
À vérifier si les données `ageMin`/`ageMax` viennent des sessions et sont précises.

---

## 📦 PLAN DE CORRECTION S1_P0 (LOTS INDÉPENDANTS)

### Lot 1 : F5 - Badge période précis
**Fichier :** `components/stay-card.tsx`
**Lignes à modifier :** 28-35 (badge période)
**Commit :** `fix(F5): badge période précis (JUILLET/AOÛT) au lieu de ETE vague`

### Lot 2 : F10 - Retirer mention partenaire
**Fichier :** `app/sejour/[id]/stay-detail.tsx`
**Ligne à modifier :** 462
**Commit :** `fix(F10): retirer mention partenaire dans détail séjour`

### Lot 3 : F9 - Dédupliquer programme
**Fichier :** `app/sejour/[id]/stay-detail.tsx`
**Lignes à supprimer :** 252-268 (section "Au programme")
**Commit :** `fix(F9): supprimer section programme courte (duplication 5 premiers items)`

---

## 🚧 CONTRAINTES DE MODIFICATION

1. **Aucune modification CSS/graphique** : Seulement logique et conditions
2. **1 lot = 1 commit** : Modifications indépendantes et atomiques
3. **Tests avant commit** : Vérifier compilation + comportement visuel
4. **Branch work uniquement** : Pas de nouvelle branche, pas de main

---

## 📝 QUESTIONS RESTANTES (pour F2, F7)

### Q1_MARGIN_18_ALWAYS
Le +18€ correspond-il toujours à la marge GED, même sans transport ?

### Q2_TRANSPORT_NONE
Sans transport => transport_surcharge doit-il être strictement 0€ ?

**Ces questions doivent être clarifiées avant de travailler sur F2 (Prix dynamiques Pro).**

---

**Prochaine étape :** Commencer les corrections S1_P0 (F5, F10, F9) en lots indépendants.
