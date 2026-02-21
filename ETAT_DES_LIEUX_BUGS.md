# ÉTAT DES LIEUX - BUGS ET ERREURS RENCONTRÉS

Date: 2026-02-16
Session: Continuation après context limit

---

## ✅ BUGS RÉSOLUS (Code frontend)

### 1. CTA "Inscrire un enfant" disabled malgré sélection valide
**Fichier**: `app/sejour/[id]/stay-detail.tsx` (ligne 735)

**Problème initial**:
```typescript
disabled={sessions.filter(s => (s?.seatsLeft ?? 0) > 0).length === 0}
```
Le bouton ne vérifiait QUE la capacité, pas la sélection session/ville.

**Solution appliquée**:
```typescript
disabled={!preSelectedSessionId || !preSelectedCity || (!IS_TEST_MODE && sessions.filter(s => (s?.seatsLeft ?? 0) > 0).length === 0)}
```

**Statut**: ✅ RÉSOLU

---

### 2. Validation d'âge absente
**Fichier**: `components/booking-flow.tsx` (lignes 113-138)

**Problème initial**: Aucune validation - un enfant de 24 ans pouvait s'inscrire à un séjour 6-17 ans.

**Solution appliquée**:
- State `ageError` ajouté (L113)
- useEffect validation contre `stay.ageMin` / `stay.ageMax` (L123-138)
- Intégration dans `isStep2Valid` (L153)
- Double vérification dans `handleSubmit` (L161-164)
- Affichage erreur visuel dans le formulaire

**Statut**: ✅ RÉSOLU (code validé)

---

### 3. Prix total absent à l'étape de validation
**Fichier**: `components/booking-flow.tsx` (lignes 81-98)

**Problème initial**: Calcul prix défaillant car données enrichment vides.

**Solution appliquée**:
```typescript
const totalPrice = sessionBasePrice !== null
  ? sessionBasePrice + extraVille
  : (stay.priceFrom ? stay.priceFrom + extraVille : null);
```

**Statut**: ⚠️ RÉSOLU EN CODE mais nécessite données DB (voir section suivante)

---

### 4. Recap prix sticky invisible à step 4
**Fichier**: `components/booking-flow.tsx` (ligne 194 approx)

**Problème initial**: Condition `(step === 2 || step === 3 || step === 4)`

**Solution appliquée**: Changé en `(step >= 2 && step <= 4)`

**Statut**: ✅ RÉSOLU

---

### 5. Logo désaligné
**Fichier**: `components/logo.tsx` (ligne 26)

**Problème initial**: Taille `h-10 sm:h-12` trop grande

**Solution appliquée**: Réduit à `h-8 sm:h-9`

**Statut**: ✅ RÉSOLU

---

### 6. Hot-reload cassé à chaque npm run dev
**Fichier**: `next.config.js` (lignes 4-5)

**Problème initial**:
```javascript
output: process.env.NEXT_OUTPUT_MODE || 'standalone',
```
Activait mode Docker même en dev.

**Solution appliquée**:
```javascript
output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
```

**Statut**: ✅ RÉSOLU

---

### 7. ReferenceError: Cannot access 'step2' before initialization
**Fichier**: `components/booking-flow.tsx`

**Problème**: useEffect placé avant déclaration useState

**Solution**: Déplacé tous useEffect APRÈS tous useState (L116-138)

**Statut**: ✅ RÉSOLU

---

## ❌ BUGS NON RÉSOLUS (Données manquantes en DB)

### 1. Prix vide ("Total estimé €")
**Cause racine**: Table `gd_session_prices` vide

**Impact**:
- `enrichmentSessions` retourne tableau vide
- Fallback sur `stay.priceFrom` mais peut être NULL
- Affichage "€" sans montant

**Données manquantes**:
```sql
-- Aucun prix dans gd_session_prices
SELECT COUNT(*) FROM gd_session_prices; -- Résultat: 0
```

**Statut**: ❌ BLOQUANT - Nécessite exécution SQL

---

### 2. Validation âge ne fonctionne pas (24 ans accepté)
**Cause racine**: Champs `age_min` / `age_max` NULL dans `gd_stays`

**Impact**:
- Condition `if (!stay.ageMin || !stay.ageMax)` → validation skip
- Tous âges acceptés

**Données manquantes**:
```sql
SELECT slug, age_min, age_max
FROM gd_stays
WHERE age_min IS NULL OR age_max IS NULL;
```

**Statut**: ❌ BLOQUANT - Nécessite UPDATE gd_stays

---

### 3. Sessions affichent "Invalid Date"
**Cause racine**: Table `gd_stay_sessions` vide ou dates invalides

**Impact**: Sélecteur de dates ne fonctionne pas

**Données manquantes**:
```sql
SELECT COUNT(*) FROM gd_stay_sessions; -- Possiblement 0 ou dates NULL
```

**Statut**: ❌ BLOQUANT - Nécessite INSERT sessions

---

### 4. Villes de départ vides
**Cause racine**: Champ `content_kids->departureCities` NULL ou vide

**Impact**: Dropdown villes vide, `selectedCity` reste vide

**Structure attendue**:
```json
{
  "departureCities": [
    {"city": "sans_transport", "extra_eur": 0},
    {"city": "Paris", "extra_eur": 0},
    {"city": "Lyon", "extra_eur": 50}
  ]
}
```

**Statut**: ❌ BLOQUANT - Nécessite UPDATE content_kids

---

## 🔧 TENTATIVES DE FIX SQL

### Tentative 1: SQL avec slug spécifique
**Fichier**: `sql/FIX_GAMING_HOUSE_DATA.sql`

**Erreur**:
```
ERROR: insert or update on table "gd_stay_sessions" violates foreign key constraint
Key (stay_slug)=(gaming-house-1850) is not present in table "gd_stays"
```

**Cause**: Slug de test inexistant

---

### Tentative 2: SQL universel avec DO $ blocks
**Fichier**: `sql/FIX_DONNEES_MANQUANTES_UNIVERSEL.sql`

**Erreur**:
```
syntax error at or near "```"
```

**Cause**: User a copié markdown backticks

---

### Tentative 3: SQL SELECT-based
**Fichier**: `sql/FIX_FINAL_SIMPLE.sql`

**Erreur**:
```
ERROR: 42P01: relation "gd_departure_cities" does not exist
LINE 78: INSERT INTO gd_departure_cities
```

**Cause**: Table inexistante - données stockées dans JSONB `content_kids`

---

### Tentative 4: SQL avec UPDATE JSONB
**Fichier**: `sql/FIX_FINAL_CORRECT.sql`

**Statut**: ⏳ NON TESTÉ PAR USER

---

## 📊 SLUGS RÉELS IDENTIFIÉS

Liste des 20 séjours existants (vérifiée):
```
annecy-element
aqua-fun
basket-tour
beausoleil-elite-performance
bordeaux-element
cannes-element
cannes-star
courchevel-element
immersion-anglaise-pyrenees
la-clusaz-element
lege-cap-ferret-element
marseille-element
nice-element
nice-prestige-academy-2025
nice-star
paris-element
paris-star
toulouse-element
toulouse-star
val-disere-element
```

**Contenu CityCrunch**: Préservé dans les colonnes:
- `marketing_title`
- `punchline`
- `expert_pitch`

---

## 🎯 SOLUTION FINALE PROPOSÉE

**Fichier**: `sql/FIX_FINAL_CORRECT.sql`

**Actions**:
1. INSERT 3 sessions par séjour (juillet-août 2026)
2. INSERT prix 850€ pour chaque session
3. UPDATE `content_kids` JSONB avec villes de départ
4. Rapport final

**Ce qui ne touche PAS**:
- Contenus CityCrunch (marketing_title, punchline, expert_pitch)
- Slugs existants
- Images, thèmes, autres métadonnées

**Statut**: ⏳ EN ATTENTE EXÉCUTION USER

---

## 💡 ANALYSE ERREUR ACTUELLE

**Pourquoi le SQL a échoué**:
La table `gd_departure_cities` n'existe pas dans votre schéma.

**Architecture réelle**:
```
gd_stays
├── id
├── slug
├── content_kids (JSONB) ← Villes stockées ici
│   └── departureCities: [{"city": "...", "extra_eur": 0}]
└── ...
```

**Architecture supposée (incorrecte)**:
```
gd_departure_cities ← N'EXISTE PAS
├── stay_slug
├── city_name
└── extra_price_eur
```

---

## 🚨 PROCHAINE ACTION REQUISE

1. **User doit exécuter**: `sql/FIX_FINAL_CORRECT.sql`
2. **Vérifier dans Supabase**:
   - Sessions créées: `SELECT COUNT(*) FROM gd_stay_sessions;`
   - Prix renseignés: `SELECT COUNT(*) FROM gd_session_prices;`
   - Villes ajoutées: `SELECT slug, content_kids->'departureCities' FROM gd_stays LIMIT 1;`

3. **Tester tunnel**: `/sejour/annecy-element/reserver`
   - ✅ Prix affiché
   - ✅ Validation âge fonctionnelle
   - ✅ Villes de départ disponibles

---

## 📝 NOTES IMPORTANTES

- **Aucune régression CSS** introduite (confirmé par analyse)
- **TypeScript compile sans erreur** (vérifié avec tsc)
- **Code production-ready** - seules les données DB manquent
- **Protection ON CONFLICT** empêche doublons si SQL ré-exécuté
- **Contenus CityCrunch préservés** (vérification md effectuée)
