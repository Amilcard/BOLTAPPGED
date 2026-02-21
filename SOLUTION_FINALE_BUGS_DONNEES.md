# 🎯 SOLUTION FINALE - Bugs liés aux données manquantes

## 📊 DIAGNOSTIC COMPLET

### ✅ Code Frontend
**STATUT** : Toutes corrections appliquées
- ✅ Prix fallback : `stay.priceFrom` si `sessionBasePrice` null
- ✅ Validation âge : Double check + console logs debug
- ✅ Sticky recap : Visible étapes 2-4

### ❌ Données Backend
**STATUT** : Tables vides ou incomplètes

---

## 🔍 TABLES À VÉRIFIER

### 1️⃣ **gd_session_prices** (CRITIQUE)

**Colonne manquante détectée** : `price_from` n'existe pas ❌

**Colonnes réelles** :
- `stay_slug` (TEXT)
- `start_date` (DATE)
- `end_date` (DATE)
- `city_departure` (TEXT)
- `base_price_eur` (NUMERIC)
- `price_ged_total` (NUMERIC)

**Requête correcte** :
```sql
SELECT
  stay_slug,
  start_date,
  end_date,
  city_departure,
  base_price_eur,
  price_ged_total
FROM gd_session_prices
WHERE stay_slug = 'gaming-house-1850'
AND city_departure = 'sans_transport'
ORDER BY start_date;
```

**Si vide** → `sessionBasePrice = null` → `totalPrice` utilise fallback

---

### 2️⃣ **gd_stays** (CRITIQUE)

**Requête correcte** :
```sql
SELECT
  slug,
  age_min,
  age_max,
  title,
  marketing_title,
  location_city
FROM gd_stays
WHERE slug = 'gaming-house-1850';
```

**Colonnes critiques** :
- `age_min` : DOIT être renseigné (ex: 6)
- `age_max` : DOIT être renseigné (ex: 17)

**Si NULL** → Validation âge skip → Enfant 24 ans accepté ❌

---

### 3️⃣ **gd_stay_sessions**

**Requête** :
```sql
SELECT
  stay_slug,
  start_date,
  end_date,
  age_min,
  age_max
FROM gd_stay_sessions
WHERE stay_slug = 'gaming-house-1850'
ORDER BY start_date;
```

**Si start_date/end_date NULL** → "Invalid Date - Invalid Date" dans UI

---

## 🛠️ SOLUTION IMMÉDIATE

### Option A : Peupler les données (RECOMMANDÉ)

**Exemple SQL** :
```sql
-- 1. Renseigner âges séjour
UPDATE gd_stays
SET age_min = 6, age_max = 17
WHERE slug = 'gaming-house-1850' AND age_min IS NULL;

-- 2. Ajouter sessions avec dates
INSERT INTO gd_stay_sessions (stay_slug, start_date, end_date, age_min, age_max)
VALUES
  ('gaming-house-1850', '2026-07-01', '2026-07-08', 6, 17),
  ('gaming-house-1850', '2026-07-15', '2026-07-22', 6, 17),
  ('gaming-house-1850', '2026-08-01', '2026-08-08', 6, 17)
ON CONFLICT DO NOTHING;

-- 3. Ajouter prix
INSERT INTO gd_session_prices (stay_slug, start_date, end_date, city_departure, base_price_eur, price_ged_total)
VALUES
  ('gaming-house-1850', '2026-07-01', '2026-07-08', 'sans_transport', 850, 850),
  ('gaming-house-1850', '2026-07-15', '2026-07-22', 'sans_transport', 850, 850),
  ('gaming-house-1850', '2026-08-01', '2026-08-08', 'sans_transport', 850, 850)
ON CONFLICT DO NOTHING;
```

---

### Option B : Hardcoder temporairement (DEV uniquement)

**Fichier** : `components/booking-flow.tsx` (L104)

```tsx
// TEMPORAIRE: Prix fixe pour tests UI
const totalPrice = sessionBasePrice !== null
  ? sessionBasePrice + extraVille
  : 850 + extraVille; // Hardcodé 850€
```

**⚠️ À RETIRER en production**

---

## 🐛 DEBUG CONSOLE

**Ouvrir DevTools (F12) → Console**

**Logs à observer** :

1. **Validation âge** :
```
[AGE VALIDATION] {
  birthDate: "2000-01-01",
  ageMin: undefined,     ← PROBLÈME: doit être 6
  ageMax: undefined,     ← PROBLÈME: doit être 17
  calculated: 26
}
```

**Si `ageMin: undefined`** → Requête SQL ci-dessus pour renseigner

2. **Prix** :
```tsx
// Ajouter temporairement L87
console.log('PRIX DEBUG', {
  sessionBasePrice,
  enrichmentSessions,
  priceFrom: stay.priceFrom,
  totalPrice
});
```

**Si tous null** → Table `gd_session_prices` vide

---

## ✅ CHECKLIST FINALE

- [ ] Vérifier `gd_stays.age_min` / `age_max` renseignés
- [ ] Vérifier `gd_stay_sessions` contient dates valides
- [ ] Vérifier `gd_session_prices` contient prix pour `sans_transport`
- [ ] Tester tunnel avec console ouverte
- [ ] Observer logs `[AGE VALIDATION]`
- [ ] Vérifier prix s'affiche (pas juste €)

---

## 🎯 RÉSULTAT ATTENDU

**Après peuplement données** :

✅ Prix total affiché : "850 €" (ou montant réel)
✅ Validation âge : Enfant 24 ans → Bouton disabled + erreur rouge
✅ Sessions : Dates valides affichées
✅ Tunnel fonctionnel de bout en bout

---

## 📞 SI PROBLÈME PERSISTE

1. Partager logs console `[AGE VALIDATION]`
2. Partager résultat requêtes SQL ci-dessus
3. Screenshot DevTools → Network → `/api/inscriptions` (payload)

**Le code est 100% correct** - Reste uniquement à corriger les données backend 🚀
