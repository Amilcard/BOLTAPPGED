# FIX CRITIQUE : Incohérence affichage âges (Home vs Détail)

**Date** : 2026-02-05 12:00  
**Problème rapporté** : Aux Issambres affiche "7-8 ans" sur Home mais "7-8 ans" ET "6-17 ans" sur page détail  
**Cause racine** : Double calcul + fallback erroné dans `stay-detail.tsx`

---

## 🔴 PROBLÈME IDENTIFIÉ

### Symptôme
- **Card Home** : Badge "7-8 ans" ✅
- **Page Détail** : DEUX badges affichés simultanément :
  - "7-8 ans" (correct - depuis `uniqueAgeRanges`)
  - "6-17 ans" (incorrect - depuis fallback `stay.ageMin/ageMax`)

### Cause racine

Dans `app/sejour/[id]/stay-detail.tsx` (ligne 144-145 **AVANT fix**) :
```tsx
const uniqueAgeRanges = Array.from(new Set(
  rawSessions.map((s: any) => {
    const min = s.age_min ?? stay.ageMin ?? 0;  // ⚠️ PROBLÈME ICI
    const max = s.age_max ?? stay.ageMax ?? 0;  // ⚠️ PROBLÈME ICI
    return `${min}-${max}`;
  })
))
```

**Le problème** :
1. Si `rawSessions` contient une session valide (ex: `age_min=7, age_max=8`), elle génère "7-8"
2. **MAIS** si une autre session a `age_min=null, age_max=null`, le fallback va créer "6-17" (depuis `stay.ageMin/ageMax`)
3. Résultat : `uniqueAgeRanges = ["7-8", "6-17"]` → DEUX badges affichés !

---

## ✅ SOLUTION APPLIQUÉE

### Modification 1 : `app/sejour/[id]/stay-detail.tsx`

**Lignes 140-156** - Remplacement du calcul local par utilisation de `ageRangesDisplay` (props)

```tsx
// AVANT (BUGUÉ)
const rawSessions = (stay as any).rawSessions || [];
const uniqueAgeRanges = Array.from(new Set(
  rawSessions.map((s: any) => {
    const min = s.age_min ?? stay.ageMin ?? 0;  // ❌ Double fallback = duplication
    const max = s.age_max ?? stay.ageMax ?? 0;
    return `${min}-${max}`;
  })
));

// APRÈS (FIXÉ)
const ageRangesFromProps = (stay as any).ageRangesDisplay;
const rawSessions = (stay as any).rawSessions || [];

const uniqueAgeRanges = ageRangesFromProps
  ? ageRangesFromProps.replace(' ans', '').split(' / ')  // ✅ Source unique depuis serveur
  : Array.from(new Set(
      rawSessions
        .filter((s: any) => s.age_min != null && s.age_max != null)  // ✅ Filtre nulls
        .map((s: any) => `${s.age_min}-${s.age_max}`)
    )).sort(...)
```

**Changements clés** :
- ✅ Priorité à `ageRangesDisplay` (calculé proprement côté serveur avec `age-utils.ts`)
- ✅ Ajout `.filter()` pour ignorer sessions avec `age_min/max = null` (pas de fallback "6-17")
- ✅ Fallback uniquement si `ageRangesDisplay` absent (rétrocompatibilité)

---

### Modification 2 : `app/sejour/[id]/page.tsx`

**Lignes 12, 40-42, 79** - Calcul et injection de `ageRangesDisplay`

```tsx
// AJOUTÉ
import { getUniqueAgeRanges, formatAgeRangesDisplay } from '@/lib/age-utils';

// ...

// Calculer affichage détaillé des tranches d'âge (Option A)
const ranges = getUniqueAgeRanges(staySessions.map(s => ({ age_min: s.age_min, age_max: s.age_max })));
const ageRangesDisplay = ranges.length > 0 ? formatAgeRangesDisplay(ranges) : undefined;

// ...

const stayData = {
  // ... autres props
  ageMin,
  ageMax,
  ageRangesDisplay, // ✅ NOUVEAU - Passé au composant StayDetail
  // ...
};
```

**Avantage** : 
- Le calcul est fait **une seule fois** côté serveur
- Utilise la même logique que Home/Recherche (`age-utils.ts`)
- Garantit cohérence parfaite

---

## 🧪 VALIDATION

### Test 1 : Issambres (cas rapporté)
- **Home** : Devrait afficher "7-8 ans" (ou tranches réelles selon DB)
- **Détail** : Devrait afficher **EXACTEMENT** les mêmes tranches
- ❌ **Plus de "6-17 ans"** parasite

### Test 2 : Séjour multi-tranches (ex: Aqua'Fun)
- **Home** : "6-8 / 9-11 / 12-14 ans"
- **Détail** : "6-8 / 9-11 / 12-14 ans"
- ✅ Strictement identique

### Test 3 : Séjour mono-tranche
- **Home** : "12-14 ans"
- **Détail** : "12-14 ans"
- ✅ Pas de duplication

---

## 📊 RÉSULTAT ATTENDU

### Avant le fix
```
Home Card:     [7-8 ans]
Detail Mobile: [7-8 ans] [6-17 ans]  ⚠️ DOUBLE AFFICHAGE
Detail Meta:   7-8 / 6-17 ans        ⚠️ INCOHÉRENT
```

### Après le fix
```
Home Card:     [7-8 ans]
Detail Mobile: [7-8 ans]             ✅ COHÉRENT
Detail Meta:   7-8 ans               ✅ COHÉRENT
```

---

## 🔍 POINTS DE VIGILANCE

### Session avec âges null dans DB
Si `gd_stay_sessions` contient des lignes avec `age_min=null, age_max=null` :
- **AVANT** : Générait "0-0" ou "6-17" (fallback)
- **APRÈS** : Ces sessions sont **filtrées** et ignorées

### Rétrocompatibilité
Si `ageRangesDisplay` n'est pas passé (vieux code) :
- Le fallback calcul local s'active
- **MAIS** avec le `.filter()` pour éviter les nulls
- Pas de régression

---

## 📝 FICHIERS MODIFIÉS

1. ✏️ `app/sejour/[id]/stay-detail.tsx` (lignes 140-156)
   - Remplacement calcul `uniqueAgeRanges`
   - Utilisation `ageRangesDisplay` depuis props
   - Filtrage des sessions avec âges null

2. ✏️ `app/sejour/[id]/page.tsx` (lignes 12, 40-42, 79)
   - Import `age-utils`
   - Calcul `ageRangesDisplay` avec `getUniqueAgeRanges`
   - Injection dans `stayData`

---

## ✅ CHECKLIST VALIDATION

- [x] Compilation TypeScript sans erreurs
- [x] Serveur Next.js redémarré et pages recompilées
- [x] Logique alignée avec Home/Recherche (même `age-utils`)
- [ ] **À TESTER** : Vérifier visuellement Issambres (Home → Détail)
- [ ] **À TESTER** : Vérifier Aqua'Fun (multi-tranches)
- [ ] **À TESTER** : Vérifier tous séjours catalogue

---

## 🔄 ROLLBACK (si nécessaire)

Si le fix introduit une régression :

```bash
# Git revert des 2 derniers commits
git revert HEAD~2..HEAD
```

OU modifier manuellement :

**Dans `stay-detail.tsx` ligne 146-148**, restaurer :
```tsx
const uniqueAgeRanges = Array.from(new Set(
  rawSessions.map((s: any) => {
    const min = s.age_min ?? stay.ageMin ?? 0;
    const max = s.age_max ?? stay.ageMax ?? 0;
    return `${min}-${max}`;
  })
));
```

---

**Fix appliqué. Prêt pour validation visuelle.**
