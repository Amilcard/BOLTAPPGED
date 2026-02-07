# Règles de Pricing GED - Documentation Officielle

## 📋 Formule Tarifaire

```
price_ged_total = base_price_eur + markup_duration + transport_surcharge_ged
```

Où :
- **`base_price_eur`** : Prix UFOVAL brut (sans transport, sans marge)
- **`markup_duration`** : Marge GED selon durée (règle forfait "arrondi favorable")
- **`transport_surcharge_ged`** : Supplément transport GED (0€ si sans_transport, sinon `transport_ufoval + 18€`)

---

## 🎯 Règle 1 : Markup Durée (Arrondi Favorable)

### Principe
**Forfait par tranche de durée** : les sessions dont la durée est **proche d'une durée de référence** se voient appliquer le **forfait de cette référence**.

### Tranches de Forfait

| Durée Session | Markup Appliqué | Référence | Observation DB |
|---------------|-----------------|-----------|----------------|
| **5-8 jours** | **180€** | 7j | 93% sessions à 180€ (vs 7% prorata) |
| **11-15 jours** | **240€** | 14j | 94% sessions à 240€ (vs 6% prorata) |
| **18-22 jours** | **410€** | 21j | 93% sessions à 410€ (vs 7% prorata) |

### Durées Hors Forfait
Durées **non couvertes** par les tranches ci-dessus : **markup = 0€**

Exemples :
- **3-4 jours** : 0€ (sessions très courtes)
- **9-10 jours** : 0€ (entre 2 tranches)
- **16-17 jours** : 0€ (entre 2 tranches)
- **23+ jours** : 0€ (sessions très longues)

> [!NOTE]
> Ces durées hors forfait sont **rares** en pratique (< 1% du catalogue).

---

## 🚗 Règle 2 : Markup Transport

### Formule
```typescript
transport_surcharge_ged = CASE
  WHEN transport_surcharge_ufoval = 0 THEN 0
  ELSE transport_surcharge_ufoval + 18
END
```

### Cas Spéciaux
- **"sans_transport"** : `transport_surcharge_ged = 0€` (pas de markup)
- **Toute autre ville** : `transport_surcharge_ged = transport_ufoval + 18€`

### Villes de Départ (20 total)
```
albertville, annecy, annemasse, bordeaux, chambery, clermont ferrand,
cluses, grenoble, lille, lyon, marseille, nancy, nantes, paris,
rennes, sans_transport, st etienne, toulon, toulouse, valence
```

---

## 📊 Exemples de Calcul

### Exemple 1 : Session 7j, Paris
```
Base UFOVAL     : 780€
Markup durée    : 180€ (7j → forfait ref 7j)
Transport UFOVAL: 220€
Transport GED   : 220 + 18 = 238€

TOTAL GED = 780 + 180 + 238 = 1198€
```

### Exemple 2 : Session 13j, Lyon
```
Base UFOVAL     : 1350€
Markup durée    : 240€ (13j → forfait ref 14j, "arrondi favorable")
Transport UFOVAL: 135€
Transport GED   : 135 + 18 = 153€

TOTAL GED = 1350 + 240 + 153 = 1743€
```

### Exemple 3 : Session 5j, sans_transport
```
Base UFOVAL     : 490€
Markup durée    : 180€ (5j → forfait ref 7j)
Transport UFOVAL: 0€
Transport GED   : 0€ (sans_transport)

TOTAL GED = 490 + 180 + 0 = 670€
```

---

## 🔍 Justification : Pourquoi "Arrondi Favorable" ?

### Observation DB
Sur **2888 sessions** analysées :
- **93% appliquent le forfait "arrondi favorable"** (180/240/410€)
- **7% utilisent une prorata stricte** (ex: 222€ pour 13j)

### Hypothèses
1. **Simplification commerciale** : Forfaits clairs et prévisibles pour les clients
2. **Marge uniforme** : Éviter des calculs complexes avec prorata variable
3. **Correction manuelle post-import** : Les sessions UFOVAL brutes (prorata) sont ajustées manuellement par GED

### Décision
**La DB est la source de vérité**. Le code `lib/pricing.ts` reproduit cette règle pour cohérence.

---

## 📚 Source de Vérité

- **Table DB** : `gd_session_prices` (2888 sessions)
- **Colonne clé** : `price_ged_total`
- **Audit complet** : Voir [`pricing_matrix_audit_report.md`](file:///Users/laidhamoudi/.gemini/antigravity/brain/7c701ec0-dca7-4963-9ee5-049e80b43cb7/pricing_matrix_audit_report.md)

---

## ⚙️ Implémentation Code

**Fichier** : [`lib/pricing.ts`](file:///Users/laidhamoudi/Dev/GED_APP/lib/pricing.ts)

**Fonction** : `GedPricing.getDurationSurcharge(durationDays)`

```typescript
// Groupe 7j : 5-8j → forfait 180€
if (durationDays >= 5 && durationDays <= 8) {
  return DURATION_SURCHARGE[7]; // 180€
}

// Groupe 14j : 11-15j → forfait 240€
if (durationDays >= 11 && durationDays <= 15) {
  return DURATION_SURCHARGE[14]; // 240€
}

// Groupe 21j : 18-22j → forfait 410€
if (durationDays >= 18 && durationDays <= 22) {
  return DURATION_SURCHARGE[21]; // 410€
}

// Hors forfait → 0€
return 0;
```

---

## 📅 Historique

- **2026-02-07** : Audit P0 + identification règle "arrondi favorable" + migration DB transport_surcharge_ged
- **2026-02-07** : Alignement code `lib/pricing.ts` sur règle DB + documentation officielle

**Maintenu par** : Équipe Tech GED
