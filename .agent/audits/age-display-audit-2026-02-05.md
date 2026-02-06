# AUDIT EXHAUSTIF : Affichage des âges dans GED_APP
**Date** : 2026-02-05  
**Mode** : LECTURE SEULE (no code changes in this batch)  
**Objectif** : Cartographier toutes les surfaces d'affichage d'âges, identifier les incohérences, proposer une stratégie de correction minimale

---

## 1. INVENTAIRE COMPLET DES AFFICHAGES D'ÂGES

### 1.1 Composant StayCard (Cards du catalogue)
**Fichier** : `components/stay-card.tsx`  
**Ligne** : 63  
**Format** : Badge image overlay `"X-Y ans"`  
**Code** :
```tsx
{stay?.ageMin ?? 0}-{stay?.ageMax ?? 0} ans
```
**Source de données** :
- Champs `stay.ageMin` et `stay.ageMax` (props)
- Ces props sont calculées **en amont** dans `app/page.tsx` (Home) et `app/recherche/page.tsx` (Search)

**Risque** : ⚠️ **MOYEN** - Affiche un range global calculé (min des mins, max des maxs) qui peut masquer l'existence de plusieurs tranches d'âge distinctes

---

### 1.2 Page Séjour - Header (Overlay mobile)
**Fichier** : `app/sejour/[id]/stay-detail.tsx`  
**Lignes** : 286-289  
**Format** : Badge mobile-only
**Code** :
```tsx
{uniqueAgeRanges.length > 0 
   ? uniqueAgeRanges.join(' / ') 
   : `${stay?.ageMin}-${stay?.ageMax}`
}
```
**Source de données** :
- **Préférence 1** : `uniqueAgeRanges` (calculé local depuis `rawSessions`, lignes 142-152)
- **Fallback** : `stay.ageMin/ageMax` (props globales)

**Risque** : ✅ **FAIBLE** - Logique correcte avec priorité aux tranches réelles

---

### 1.3 Page Séjour - Meta Row (Desktop/Mobile)
**Fichier** : `app/sejour/[id]/stay-detail.tsx`  
**Lignes** : 341-343  
**Format** : Texte dans meta row sous le titre
**Code** :
```tsx
{uniqueAgeRanges.length > 0 
   ? uniqueAgeRanges.map((r: any) => `${r} ans`).join(' / ') 
   : `${stay?.ageMin}-${stay?.ageMax} ans`
}
```
**Source de données** :
- Identique à 1.2 (même logique de fallback)

**Risque** : ✅ **FAIBLE** - Cohérent avec overlay

---

### 1.4 Calcul de `uniqueAgeRanges` (Page Séjour)
**Fichier** : `app/sejour/[id]/stay-detail.tsx`  
**Lignes** : 140-152  
**Logique** :
```tsx
const rawSessions = (stay as any).rawSessions || [];
const uniqueAgeRanges = Array.from(new Set(
  rawSessions.map((s: any) => {
    const min = s.age_min ?? stay.ageMin ?? 0;
    const max = s.age_max ?? stay.ageMax ?? 0;
    return `${min}-${max}`;
  })
)).sort(...)
```
**Source DB** : `gd_stay_sessions.age_min` et `gd_stay_sessions.age_max`  
**Passé via** : Prop `rawSessions` depuis `app/sejour/[id]/page.tsx` (ligne 106)

**Risque** : ⚠️ **MOYEN** - Le calcul utilise un fallback `stay.ageMin/ageMax` si `s.age_min/max` null, créant potentiellement des doublons

---

### 1.5 Calcul de `ageMin/ageMax` (Server-Side - Page Séjour)
**Fichier** : `app/sejour/[id]/page.tsx`  
**Lignes** : 34-39  
**Logique** :
```tsx
const ageMin = staySessions.length > 0
  ? Math.min(...staySessions.map(s => s.age_min || 6))
  : 6;
const ageMax = staySessions.length > 0
  ? Math.max(...staySessions.map(s => s.age_max || 17))
  : 17;
```
**Source DB** : `gd_stay_sessions.age_min` et `gd_stay_sessions.age_max`  
**Injecté dans** : `stayData.ageMin` et `stayData.ageMax` (lignes 77-78)

**Risque** : ⚠️ **MOYEN** - Fallback hardcodé `6` et `17` si champs null

---

### 1.6 Calcul de `ageMin/ageMax` (Server-Side - Home/Recherche)
**Fichiers** :
- `app/page.tsx` (lignes 11-31, 54-55)
- `app/recherche/page.tsx` (lignes 11-31, 52-53)

**Logique** :
```tsx
const agesMap = new Map<string, { ageMin: number; ageMax: number }>();
for (const row of agesData) {
  const existing = agesMap.get(row.stay_slug);
  if (!existing) {
    agesMap.set(row.stay_slug, { ageMin: row.age_min, ageMax: row.age_max });
  } else {
    agesMap.set(row.stay_slug, {
      ageMin: Math.min(existing.ageMin, row.age_min),
      ageMax: Math.max(existing.ageMax, row.age_max)
    });
  }
}
const ages = agesMap.get(sejour.slug) || { ageMin: 6, ageMax: 17 };
```
**Source DB** : `gd_stay_sessions.age_min` et `gd_stay_sessions.age_max`  
**Query** : `supabaseGed.from('gd_stay_sessions').select('stay_slug, age_min, age_max')`

**Risque** : ⚠️ **MOYEN** - Fallback hardcodé `{ ageMin: 6, ageMax: 17 }` si séjour introuvable dans sessions

---

### 1.7 Filtres d'âge (Home/Recherche)
**Fichier** : `app/home-content.tsx`  
**Lignes** : 14-20, 111, 149-152  
**Tranches de référence (AGE_GROUPS)** :
```tsx
{ label: '6-8 ans', min: 6, max: 8 },
{ label: '9-11 ans', min: 9, max: 11 },
{ label: '12-14 ans', min: 12, max: 14 },
{ label: '15-17 ans', min: 15, max: 17 },
```
**Filtre appliqué** :
```tsx
if (!ageMatchesFilter(stay.ageMin ?? 0, stay.ageMax ?? 99, filters.ages)) {
  return false;
}
```
**Source de données** : Props `stay.ageMin/ageMax` (calculées depuis sessions côté serveur)

**Risque** : ✅ **FAIBLE** - Logique overlap correcte

---

### 1.8 Options de filtre (Sidebar)
**Fichier** : `config/filters.ts`  
**Lignes** : 11-16  
**Options** :
```tsx
{ value: '3-7', label: '3-7 ans', minAge: 3, maxAge: 7 },
{ value: '8-11', label: '8-11 ans', minAge: 8, maxAge: 11 },
{ value: '12-14', label: '12-14 ans', minAge: 12, maxAge: 14 },
{ value: '15+', label: '15 ans et +', minAge: 15, maxAge: 99 },
```

**Risque** : ⚠️ **MINEUR** - Tranches de filtre (3-7, 8-11, 12-14, 15+) ≠ tranches de présentation (6-8, 9-11, 12-14, 15-17) → incohérence UX

---

### 1.9 Admin Panel
**Fichier** : `app/admin/sejours/page.tsx`  
**Lignes** : 76, 116-117  
**Affichage** : `{stay.ageMin}-{stay.ageMax} ans`  
**Valeurs par défaut** : `ageMin: 6, ageMax: 12`

**Risque** : ✅ **HORS SCOPE** - Panel admin, pas d'impact utilisateur final

---

## 2. SOURCE OF TRUTH ACTUELLE

### 2.1 Base de données Supabase
**Table principale** : `gd_stay_sessions`  
**Colonnes** :
- `stay_slug` (FK vers `gd_stays`)
- `age_min` (integer)
- `age_max` (integer)
- `start_date`, `end_date`

**Règle métier** :
- Un séjour peut avoir **plusieurs sessions** avec des tranches d'âge différentes
- Exemple : "Aqua'Fun" peut avoir :
  - Session 1 : 6-8 ans
  - Session 2 : 9-11 ans
  - Session 3 : 12-14 ans

### 2.2 Calculs dérivés
**Trois approches coexistent actuellement** :

1. **Range global** (Home/Recherche) :
   - `ageMin = MIN(sessions.age_min)`
   - `ageMax = MAX(sessions.age_max)`
   - Exemple : "6-14 ans" (masque les tranches intermédiaires)

2. **Tranches uniques** (Page Séjour) :
   - Liste dédupliquée : `["6-8", "9-11", "12-14"]`
   - Affichage : "6-8 / 9-11 / 12-14 ans"

3. **Fallbacks hardcodés** :
   - Si aucune session : `{ ageMin: 6, ageMax: 17 }`

---

## 3. INCOHÉRENCES ET RISQUES IDENTIFIÉS

### 🔴 RISQUE CRITIQUE

**RC1 : Affichage différent Home vs Détail**
- **Home (StayCard)** : "6-14 ans"
- **Détail (stay-detail)** : "6-8 / 9-11 / 12-14 ans"
- **Impact** : L'utilisateur voit une info simplifiée en catalogue, mais découvre 3 tranches distinctes en détail → confusion

### 🟠 RISQUE MOYEN

**RM1 : Fallbacks hardcodés non alignés**
- Page Séjour : `6` et `17`
- Home/Recherche : `{ ageMin: 6, ageMax: 17 }`
- Admin : `6` et `12`
- **Impact** : Valeurs par défaut incohérentes si données sessions manquantes

**RM2 : Tranches de filtre ≠ tranches de présentation**
- Filtres : 3-7, 8-11, 12-14, 15+
- Carousels : 6-8, 9-11, 12-14, 15-17
- **Impact** : Un séjour "6-8 ans" match le filtre "3-7" → résultat inattendu

**RM3 : Double fallback dans `uniqueAgeRanges`**
```tsx
const min = s.age_min ?? stay.ageMin ?? 0;
```
- Si `age_min` null ET `ageMin` null, fallback = 0 (?!)
- **Impact** : Pourrait afficher "0-X ans" si données corrompues

### 🟡 RISQUE MINEUR

**RMI1 : Commentaires obsolètes**
- `config/filters.ts:99` mentionne `stay.ageMin/ageMax` comme champs DB
- **Réalité** : Ces champs sont calculés côté serveur depuis `gd_stay_sessions`

---

## 4. PLAN CORRECTIF MINIMAL (NO REGRESSION)

### Phase 1 : Unification de la source de vérité
**Objectif** : Toujours calculer depuis `gd_stay_sessions`, jamais depuis champs stay

**Actions** :
1. ✅ **DÉJÀ FAIT** : Home/Recherche calculent depuis sessions (OK)
2. ✅ **DÉJÀ FAIT** : Page Séjour calcule depuis sessions (OK)
3. ❌ **À VÉRIFIER** : S'assurer qu'aucun champ `age_min/max` n'existe dans `gd_stays` (éviter confusion)

### Phase 2 : Harmonisation de l'affichage
**Décision stratégique requise** :

**Option A (Recommandé)** : Afficher les tranches uniques partout
- Home (StayCard) : "6-8 / 9-11 / 12-14 ans" (ou "6-8, 9-11, 12-14 ans")
- Détail : Identique
- **Avantage** : Cohérence totale, transparence maximale
- **Inconvénient** : Badge card peut être long (limite espace)

**Option B (Pragmatique)** : Range global + indication "plusieurs âges"
- Home (StayCard) : "6-14 ans" + icône/chip "3 tranches"
- Détail : Liste complète "6-8 / 9-11 / 12-14 ans"
- **Avantage** : Cards épurées, détail exhaustif
- **Inconvénient** : Nécessite ajout visuel (chip/icon)

**Option C (Hybride)** : Condensation intelligente
- Si range continu (ex: 6-8, 9-11, 12-14) → "6-14 ans"
- Si gaps (ex: 6-8, 12-14) → "6-8 / 12-14 ans"
- **Avantage** : Optimal selon contexte
- **Inconvénient** : Logique plus complexe

### Phase 3 : Correction des fallbacks
**Fichiers à modifier** :
1. `app/sejour/[id]/page.tsx:35,38` : Remplacer `|| 6` et `|| 17` par lever une erreur ou log warning
2. `app/page.tsx:35` : Idem pour `{ ageMin: 6, ageMax: 17 }`
3. `app/recherche/page.tsx:35` : Idem
4. `app/sejour/[id]/stay-detail.tsx:144-145` : Supprimer `?? stay.ageMin ?? 0`

**Nouveau fallback recommandé** :
```tsx
if (staySessions.length === 0) {
  console.warn(`[AGE] No sessions found for stay ${slug}, using default range`);
  return { ageMin: 6, ageMax: 17 }; // Documenté comme "valeur technique par défaut"
}
```

### Phase 4 : Alignement tranches de filtre
**Fichier** : `config/filters.ts`  
**Modification** :
```tsx
export const AGE_OPTIONS = [
  { value: '6-8', label: '6-8 ans', minAge: 6, maxAge: 8 },
  { value: '9-11', label: '9-11 ans', minAge: 9, maxAge: 11 },
  { value: '12-14', label: '12-14 ans', minAge: 12, maxAge: 14 },
  { value: '15-17', label: '15-17 ans', minAge: 15, maxAge: 17 },
] as const;
```
**Impact** : Cohérence parfaite filtre ↔ carousels ↔ détail

### Phase 5 : Documentation
**Créer** : `docs/age-display-logic.md`  
**Contenu** :
- Source unique : `gd_stay_sessions.age_min/max`
- Calcul : Range global OU tranches uniques (décision Option A/B/C)
- Fallback : `6-17` si aucune session (cas edge, logged)
- Tests : Vérifier cohérence Home ↔ Détail

---

## 5. WORK ITEMS (PRIORISATION)

### 🔥 P0 (Critique - Regression risk)
**Aucun** : Système actuel fonctionne, incohérences sont UX uniquement

### 🟠 P1 (Important - User confusion)
1. **Décision stratégique** : Valider Option A/B/C avec stakeholder
2. **Harmonisation StayCard** : Implémenter option choisie dans `stay-card.tsx`
3. **Alignement filtres** : Modifier `AGE_OPTIONS` pour matcher carousels

### 🟡 P2 (Nice to have - Code quality)
4. **Cleanup fallbacks** : Unifier valeurs par défaut avec warning logs
5. **Documentation** : Créer `age-display-logic.md`
6. **Tests E2E** : Vérifier cohérence affichage Home → Détail

---

## 6. FICHIERS À MODIFIER (selon Option A)

### Si Option A retenue (tranches uniques partout)

**1. `components/stay-card.tsx` (ligne 63)**
```tsx
// AVANT
{stay?.ageMin ?? 0}-{stay?.ageMax ?? 0} ans

// APRÈS (nécessite passer sessions en props)
{stay?.ageRangesDisplay ?? `${stay?.ageMin}-${stay?.ageMax} ans`}
```

**2. `app/page.tsx` (après ligne 55)**
```tsx
// Calculer ageRangesDisplay pour chaque stay
const uniqueAgeRanges = getUniqueAgeRanges(agesData.filter(s => s.stay_slug === sejour.slug));
return {
  // ... existing fields
  ageRangesDisplay: uniqueAgeRanges.length > 0 ? uniqueAgeRanges.join(' / ') : undefined,
}
```

**3. Créer utilitaire** : `lib/age-utils.ts`
```tsx
export function getUniqueAgeRanges(sessions: { age_min: number; age_max: number }[]): string[] {
  return Array.from(new Set(
    sessions.map(s => `${s.age_min}-${s.age_max}`)
  )).sort();
}
```

---

## 7. ROLLBACK STRATEGY

**Aucune modification dans ce lot** : Audit read-only  
**Si modifications futures** :
- Commit atomique par fichier
- Feature flag `FEATURE_UNIFIED_AGE_DISPLAY` (env var)
- Revert possible en 1 click via Git

---

## 8. CONCLUSION

### État actuel
✅ Source de données : **Correcte** (`gd_stay_sessions`)  
⚠️ Affichage : **Incohérent** (range global vs tranches)  
⚠️ Fallbacks : **Non alignés** (6, 17, 12 selon fichiers)

### Action immédiate recommandée
1. **Décision stakeholder** : Valider Option A (tranches) ou B (range + chip)
2. **Quick win** : Aligner `AGE_OPTIONS` avec carousels (P1)
3. **Full fix** : Unifier affichage StayCard ↔ StayDetail (P1)

### Risque régression
**FAIBLE** si modifications incrémentales + tests manuels sur :
- `/` (home)
- `/recherche`
- `/sejour/aqua-fun-aux-issambres` (exemple multi-tranches)

---

**Fin du rapport d'audit**
