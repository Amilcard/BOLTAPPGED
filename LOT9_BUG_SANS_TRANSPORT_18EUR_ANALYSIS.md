# 🔴 BUG CRITIQUE - "Sans transport" affiche +18€ au lieu de 0€

**Date** : 3 février 2026
**Lot** : LOT9_BUG_SANS_TRANSPORT_18EUR
**Statut** : 🚨 BUG IDENTIFIÉ - Solution proposée

---

## 🎯 RÉSUMÉ DU PROBLÈME

Quand un utilisateur Pro sélectionne "Sans transport" dans le booking modal, le prix affiché indique **+18€** au lieu de **0€**.

**Impact** :
- Affichage incorrect du prix transport
- Confusion pour les utilisateurs Pro
- Prix final incorrect dans les estimations

---

## 🔍 ANALYSE TECHNIQUE

### Fichiers concernés

1. **`lib/supabaseGed.ts`** (ligne 106-131) - `getDepartureCitiesFormatted()`
2. **`app/sejour/[id]/stay-detail.tsx`** (ligne 58-60) - Mapping des villes
3. **`components/booking-modal.tsx`** (ligne 60-61) - Calcul `extraVille`
4. **Table Supabase** : `gd_session_prices` (colonne `transport_surcharge_ged`)

### Flux des données

```
BDD Supabase (gd_session_prices)
  ↓
  transport_surcharge_ged = 18 pour "sans_transport"
  ↓
lib/supabaseGed.ts → getDepartureCitiesFormatted()
  ↓
  extra_eur = row.transport_surcharge_ged || 0  // ❌ BUG ICI
  ↓
stay-detail.tsx → departureCities
  ↓
  extra_eur: dc.extra_eur || 0
  ↓
enrichment.departures
  ↓
booking-modal.tsx
  ↓
  extraVille = selectedCityData?.extra_eur ?? 0
  ↓
Affichage : "+18€" au lieu de "0€"
```

---

## 🐛 CAUSE RACINE

### Code problématique (lib/supabaseGed.ts ligne 118-120)

```typescript
// transport_surcharge_ged = surcoût UFOVAL + 18€ GED
// Pour extra_eur on veut juste le surcoût transport (sans transport = 0)
cityMap.set(row.city_departure, row.transport_surcharge_ged || 0)
```

**Problème** :
- Le commentaire dit clairement : "sans transport = 0"
- Mais le code ne fait AUCUNE vérification si la ville est "sans_transport"
- Il prend directement `row.transport_surcharge_ged` qui contient **18€** pour "sans_transport"

### Données en BDD (hypothèse)

Table `gd_session_prices` :

| city_departure | transport_surcharge_ged | Commentaire |
|----------------|-------------------------|-------------|
| `paris` | 220 | Surcoût UFOVAL + 18€ GED |
| `lyon` | 210 | Surcoût UFOVAL + 18€ GED |
| `sans_transport` | **18** | ⚠️ Devrait être **0** |

Le problème peut être :
1. **Code applicatif** : Ne filtre pas "sans_transport" pour mettre 0€
2. **Données BDD** : `transport_surcharge_ged` = 18 pour "sans_transport" (devrait être 0)

---

## ✅ SOLUTION PROPOSÉE

### Option A : Fix dans le code applicatif (RECOMMANDÉ)

**Fichier** : `lib/supabaseGed.ts`
**Ligne** : 118-120

#### Code actuel (BUGUÉ)

```typescript
for (const row of data || []) {
  if (row.city_departure && !cityMap.has(row.city_departure)) {
    // transport_surcharge_ged = surcoût UFOVAL + 18€ GED
    // Pour extra_eur on veut juste le surcoût transport (sans transport = 0)
    cityMap.set(row.city_departure, row.transport_surcharge_ged || 0)
  }
}
```

#### Code corrigé (SOLUTION)

```typescript
for (const row of data || []) {
  if (row.city_departure && !cityMap.has(row.city_departure)) {
    // transport_surcharge_ged = surcoût UFOVAL + 18€ GED
    // Pour extra_eur on veut juste le surcoût transport (sans transport = 0)
    const extraEur = row.city_departure === 'sans_transport'
      ? 0  // ✅ Sans transport = 0€
      : (row.transport_surcharge_ged || 0);
    cityMap.set(row.city_departure, extraEur)
  }
}
```

### Option B : Fix dans les données BDD

**Table** : `gd_session_prices`
**Action** : UPDATE pour mettre `transport_surcharge_ged = 0` où `city_departure = 'sans_transport'`

```sql
UPDATE gd_session_prices
SET transport_surcharge_ged = 0
WHERE city_departure = 'sans_transport';
```

**⚠️ Problème** : Si les données sont régénérées par n8n, le bug reviendra.

---

## 🎯 RECOMMANDATION FINALE

**Faire les DEUX fixes** :

1. ✅ **Fix code applicatif** (Option A) - Protège contre les données incorrectes
2. ✅ **Fix données BDD** (Option B) - Corrige la source du problème
3. ✅ **Vérifier n8n workflow** - S'assurer que le scraping/enrichment met bien `transport_surcharge_ged = 0` pour "sans_transport"

---

## 📊 TESTS À EFFECTUER

### Test 1 : Vérification données actuelles

```sql
-- Vérifier la valeur actuelle pour "sans_transport"
SELECT
  stay_slug,
  city_departure,
  transport_surcharge_ged,
  base_price_eur,
  price_ged_total
FROM gd_session_prices
WHERE city_departure = 'sans_transport'
LIMIT 5;
```

**Résultat attendu** : `transport_surcharge_ged` devrait être **0** (ou NULL)
**Résultat actuel probable** : `transport_surcharge_ged` = **18**

### Test 2 : Après fix code applicatif

1. Déployer le code corrigé (lib/supabaseGed.ts ligne 118-120)
2. Ouvrir un séjour en mode Pro
3. Sélectionner "Sans transport"
4. **Résultat attendu** : Affichage "Transport : 0€" ou aucune ligne transport
5. **Prix total** : Devrait être `sessionPrice + optionPrice` (sans les 18€)

### Test 3 : Vérification API

```typescript
// Dans la console navigateur, tester l'API
const { getDepartureCitiesFormatted } = await import('@/lib/supabaseGed');
const cities = await getDepartureCitiesFormatted('slug-exemple');
const sansTransport = cities.find(c => c.city === 'sans_transport');
console.log('Sans transport extra_eur:', sansTransport?.extra_eur);
// Attendu : 0
```

---

## 🔧 QUESTIONS MÉTIER À CLARIFIER

### Q1 : Que représente le "18€" ?

**Hypothèse 1** : Marge totale GED (durée + gestion)
- Dans `lib/pricing.ts`, la marge ville GED est de **12€** (ligne 63)
- Donc 18€ ≠ 12€ → Il y a une autre marge ?

**Hypothèse 2** : 18€ = Surcoût durée proratisé + marge fixe
- Mais le surcoût durée est déjà dans `base_price_eur`

**Hypothèse 3** : 18€ = Marge GED différente selon le contexte
- Peut-être que la marge GED n'est PAS 12€ mais 18€ dans certains cas ?

### Q2 : Logique pricing complète

```
Prix UFOVAL de base (ex: 615€)
  +
Surcoût durée GED (ex: +180€ pour 7j)
  +
Supplément ville (ex: +12€ si Paris)
  =
Prix de base GED (avant promo)
  -
Promo 5%
  =
Prix final GED
```

**Question** : Les 18€ dans `transport_surcharge_ged` incluent-ils :
- a) Seulement le surcoût transport ville (devrait être 12€ selon pricing.ts)
- b) Le surcoût transport + autre marge (18€ = 12€ + 6€ ?)
- c) Une marge globale GED différente de 12€

### Q3 : Comportement attendu "Sans transport"

**Option 1** : "Sans transport" = Prix de base (sans surcoût transport)
→ `extra_eur = 0€` ✅

**Option 2** : "Sans transport" = Prix de base + marge GED (18€)
→ `extra_eur = 18€` mais alors **changer le label** en "Marge GED : +18€"

---

## 📝 NOTES TECHNIQUES

### Différence pricing.ts vs supabaseGed.ts

**lib/pricing.ts** (ligne 63) :
```typescript
DEPARTURE_SUPPLEMENT: 12, // euros - Supplément fixe par ville GED
```

**lib/supabaseGed.ts** (ligne 118) :
```typescript
// transport_surcharge_ged = surcoût UFOVAL + 18€ GED
```

**Incohérence** : 12€ vs 18€ → Quelle est la bonne valeur ?

### Structure enrichment.departures

```typescript
interface DepartureCity {
  city: string;        // "paris" | "lyon" | "sans_transport"
  extra_eur: number;   // Surcoût transport (0 si sans_transport)
}
```

---

## ⏭️ PROCHAINES ÉTAPES

### Immédiat (< 1h)

1. ✅ **Vérifier données BDD** : Quel est le `transport_surcharge_ged` actuel pour "sans_transport" ?
2. ✅ **Appliquer fix code** : Modifier `lib/supabaseGed.ts` ligne 118-120
3. ✅ **Tester localement** : Vérifier que "Sans transport" affiche 0€
4. ✅ **Commit** : `git commit -m "fix(pricing): Sans transport affiche 0€ au lieu de +18€ (LOT9)"`

### Court terme (cette semaine)

5. Clarifier la question métier : 12€ ou 18€ pour la marge GED ?
6. Vérifier et corriger les données BDD si nécessaire
7. Vérifier le workflow n8n d'enrichissement des prix

### Moyen terme (ce mois)

8. Documenter la logique pricing complète (base + durée + transport + options)
9. Créer des tests unitaires pour `getDepartureCitiesFormatted()`
10. Ajouter validation : "sans_transport" doit toujours avoir `extra_eur = 0`

---

## ✅ DEFINITION OF DONE

- [x] Bug identifié et analysé (code + données)
- [x] Cause racine trouvée (lib/supabaseGed.ts ligne 120)
- [x] Solution proposée (fix code + fix BDD)
- [ ] Données BDD vérifiées (quel est le `transport_surcharge_ged` actuel ?)
- [ ] Code corrigé et testé localement
- [ ] Commit créé avec message descriptif
- [ ] Testé en staging/prod
- [ ] Questions métier clarifiées (12€ vs 18€)

---

**🚨 ACTION REQUISE** : Appliquer le fix code dans `lib/supabaseGed.ts` et vérifier les données BDD avant de déployer.

---

*Document généré le 3 février 2026 - Lot 9 : Bug "Sans transport" +18€*
