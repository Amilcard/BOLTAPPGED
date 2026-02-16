# ANALYSE PROBLÈME PRICING UX - 2026-02-05

## 🔍 DIAGNOSTIC

### Problème Identifié

**Symptôme** : Quand l'utilisateur sélectionne Paris (+288€), le prix "À partir de" reste inchangé et le total TTC n'est pas visible immédiatement.

**Cause Racine** :
1. Le bloc "Estimation tarifaire" est **caché par défaut** (ligne 581-588)
2. L'utilisateur doit cliquer "Voir l'estimation tarifaire" pour voir le total
3. Le prix "À partir de" est **statique** (ne change jamais, ce qui est correct)
4. Mais **aucun affichage du total TTC dynamique** n'est visible sans action utilisateur

### Comportement Actuel (Problématique)

```
┌─────────────────────────────────────────┐
│ SIDEBAR (Desktop)                       │
├─────────────────────────────────────────┤
│ Sessions disponibles                    │
│ [x] 4 juillet 2026                      │ ← User sélectionne
│ [ ] 18 juillet 2026                     │
├─────────────────────────────────────────┤
│ Villes de départ                        │
│ [x] Paris +288€                         │ ← User sélectionne
│ [ ] Lyon +188€                          │
├─────────────────────────────────────────┤
│ [Voir l'estimation tarifaire] ← CACHÉ  │ ← User doit cliquer !
├─────────────────────────────────────────┤
│ [Réserver ce séjour]                    │
└─────────────────────────────────────────┘

❌ PROBLÈME: Le total TTC (890 + 288 = 1178€) n'est PAS visible
```

### Comportement Attendu (Solution)

```
┌─────────────────────────────────────────┐
│ SIDEBAR (Desktop)                       │
├─────────────────────────────────────────┤
│ 📌 Tarif de référence                   │ ← NOUVEAU
│ À partir de 890€                        │
│ sans transport                          │
├─────────────────────────────────────────┤
│ Sessions disponibles                    │
│ [x] 4 juillet 2026                      │
│ [ ] 18 juillet 2026                     │
├─────────────────────────────────────────┤
│ Villes de départ                        │
│ [x] Paris +288€                         │
│ [ ] Lyon +188€                          │
├─────────────────────────────────────────┤
│ 💰 Ce que vous allez payer              │ ← NOUVEAU (toujours visible)
│ Session: 890€                           │
│ Transport: +288€ (Paris)                │
│ ───────────────────                     │
│ Total TTC: 1178€                        │
├─────────────────────────────────────────┤
│ [Réserver ce séjour]                    │
└─────────────────────────────────────────┘

✅ SOLUTION: Total TTC visible en temps réel
```

---

## 📋 AUDIT COMPLET

### Localisation du Code

| Élément | Fichier | Lignes | État Actuel |
|---------|---------|--------|-------------|
| **État session** | `stay-detail.tsx` | 47 | `preSelectedSessionId` (useState) |
| **État ville** | `stay-detail.tsx` | 48 | `preSelectedCity` (useState) |
| **Calcul minPrice** | `stay-detail.tsx` | 76 | `getMinSessionPrice()` ✅ |
| **Calcul cityExtra** | `stay-detail.tsx` | 78-79 | `selectedCityData?.extra_eur` ✅ |
| **Calcul sessionPrice** | `stay-detail.tsx` | 86-88 | `findSessionPrice()` ✅ |
| **Breakdown total** | `stay-detail.tsx` | 90-95 | `getPriceBreakdown()` ✅ |
| **Affichage "À partir de"** | `stay-detail.tsx` | 603-605 | Caché dans "Estimation tarifaire" ❌ |
| **Affichage total TTC** | `stay-detail.tsx` | 607-620 | Caché dans "Estimation tarifaire" ❌ |
| **Sélection session** | `stay-detail.tsx` | 520-560 | Boutons radio ✅ |
| **Sélection ville** | `stay-detail.tsx` | 469-510 | Boutons chips ✅ |

### Wiring État → Calcul → Affichage

```
┌──────────────────────────────────────────────────────────────┐
│ ÉTAT (useState)                                              │
├──────────────────────────────────────────────────────────────┤
│ preSelectedSessionId: string                                 │
│ preSelectedCity: string                                      │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ CALCULS DÉRIVÉS (useMemo implicite via re-render)           │
├──────────────────────────────────────────────────────────────┤
│ minSessionPrice = getMinSessionPrice(sessions)              │ ✅ Correct
│ selectedCityData = departures.find(preSelectedCity)         │ ✅ Correct
│ cityExtraEur = selectedCityData?.extra_eur ?? 0             │ ✅ Correct
│ selectedSession = sessions.find(preSelectedSessionId)       │ ✅ Correct
│ selectedSessionPrice = findSessionPrice(selectedSession)    │ ✅ Correct
│ priceBreakdown = getPriceBreakdown({...})                   │ ✅ Correct
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ AFFICHAGE (Problème ici)                                    │
├──────────────────────────────────────────────────────────────┤
│ "À partir de" → CACHÉ dans "Estimation tarifaire"           │ ❌ Pas visible
│ "Total TTC" → CACHÉ dans "Estimation tarifaire"             │ ❌ Pas visible
│ User doit cliquer "Voir l'estimation tarifaire"             │ ❌ UX friction
└──────────────────────────────────────────────────────────────┘
```

**Conclusion** : Le wiring état → calcul est **correct** ✅  
Le problème est **uniquement l'affichage** (UI caché) ❌

---

## 🎯 SOLUTION PROPOSÉE

### Changements UI (Minimal, No Regression)

#### 1. Remplacer "Encadrement" par "Tarif de référence"

**Localisation** : Section "Informations clés" (lignes 380-410)

**Avant** :
```tsx
<div className="flex items-center gap-3">
  <Shield className="w-5 h-5 text-primary" />
  <div>
    <div className="text-xs text-gray-500">ENCADREMENT</div>
    <div className="font-semibold text-gray-900">Équipe Groupe & Découverte</div>
  </div>
</div>
```

**Après** :
```tsx
<div className="flex items-center gap-3">
  <Tag className="w-5 h-5 text-primary" />
  <div>
    <div className="text-xs text-gray-500">TARIF (RÉFÉRENCE)</div>
    <div className="font-semibold text-gray-900">
      À partir de {minSessionPrice}€
    </div>
    <div className="text-[10px] text-gray-500">sans transport</div>
  </div>
</div>
```

#### 2. Ajouter Bloc "Ce que vous allez payer" (Toujours Visible)

**Localisation** : AU-DESSUS du CTA (avant ligne 637)

**Nouveau Bloc** :
```tsx
{/* === TOTAL TTC DYNAMIQUE === */}
{isPro && (
  <div className="bg-gradient-to-br from-primary/5 to-accent/5 border-2 border-primary/20 rounded-xl p-4 mb-4">
    <div className="flex items-center gap-2 mb-3">
      <Tag className="w-4 h-4 text-primary" />
      <span className="text-sm font-bold text-gray-900">Ce que vous allez payer</span>
    </div>
    
    {priceBreakdown.baseSession !== null ? (
      <div className="space-y-2">
        {/* Base session */}
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Session</span>
          <span className="font-semibold text-gray-900">{priceBreakdown.baseSession}€</span>
        </div>
        
        {/* Transport */}
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Transport</span>
          <span className="font-semibold text-gray-900">
            {cityExtraEur > 0 ? `+${cityExtraEur}€` : '0€'}
            <span className="text-xs text-gray-500 ml-1">
              ({preSelectedCity || 'Sans transport'})
            </span>
          </span>
        </div>
        
        {/* Séparateur */}
        <div className="border-t border-gray-200 my-2" />
        
        {/* Total TTC */}
        <div className="flex justify-between items-center">
          <span className="text-base font-bold text-gray-900">Total TTC</span>
          <span className="text-xl font-bold text-accent">{priceBreakdown.total}€</span>
        </div>
      </div>
    ) : (
      <div className="text-sm text-gray-500 text-center py-2">
        Sélectionnez une session pour afficher le total
      </div>
    )}
  </div>
)}
```

#### 3. Supprimer Bloc "Estimation tarifaire" Caché

**Localisation** : Lignes 580-634

**Action** : ❌ **SUPPRIMER** (remplacé par bloc toujours visible)

---

## 🧪 TESTS DE VALIDATION

### Test 1 : Aucun Choix

**État** :
- `preSelectedSessionId = ''`
- `preSelectedCity = ''`

**Attendu** :
- ✅ Carte "Tarif de référence" : "À partir de 890€ sans transport"
- ✅ Bloc "Ce que vous allez payer" : "Sélectionnez une session..."
- ✅ CTA "Réserver" visible

### Test 2 : Session Choisie, Ville = Sans Transport

**État** :
- `preSelectedSessionId = 'aqua-fun-0'`
- `preSelectedCity = 'Sans transport'`

**Attendu** :
- ✅ Session : 890€
- ✅ Transport : 0€ (Sans transport)
- ✅ Total TTC : 890€

### Test 3 : Session Choisie, Ville = Paris (+288€)

**État** :
- `preSelectedSessionId = 'aqua-fun-0'`
- `preSelectedCity = 'Paris'`

**Attendu** :
- ✅ Session : 890€
- ✅ Transport : +288€ (Paris)
- ✅ Total TTC : 1178€
- ✅ "À partir de" reste 890€ (référence immuable)

### Test 4 : Ville Choisie PUIS Session

**Actions** :
1. User clique Paris (+288€)
2. User clique Session 4 juillet

**Attendu** :
- ✅ Total TTC = 890 + 288 = 1178€ (dès sélection session)
- ✅ Pas de reset du choix ville

---

## 📊 IMPACT & RISQUES

### Impact Positif

- ✅ **UX améliorée** : Total TTC visible en temps réel
- ✅ **Transparence** : Détail session + transport clair
- ✅ **Cohérence** : Même comportement sur tous séjours
- ✅ **Confiance PRO** : Prix fiable, pas de surprise

### Risques (Mitigation)

| Risque | Probabilité | Mitigation |
|--------|-------------|------------|
| Régression Kids | Faible | Bloc visible uniquement si `isPro` |
| Régression Mobile | Faible | Bloc responsive (déjà dans sidebar) |
| Calcul incorrect | Très faible | Logique existante inchangée |
| UI surchargée | Faible | Design épuré, couleurs subtiles |

---

## 🎯 DEFINITION OF DONE

- [x] Audit complet effectué
- [ ] Carte "Tarif de référence" visible dans Infos clés
- [ ] Bloc "Ce que vous allez payer" toujours visible au-dessus CTA
- [ ] Total TTC se met à jour en temps réel (session + ville)
- [ ] Comportement identique sur tous séjours (4 testés)
- [ ] Aucune régression Kids/Pro/Mobile
- [ ] Tests manuels validés (4 cas)

---

## 📝 FICHIERS À MODIFIER

1. `app/sejour/[id]/stay-detail.tsx` (lignes 380-410, 580-650)
   - Remplacer "Encadrement" par "Tarif de référence"
   - Supprimer bloc "Estimation tarifaire" caché
   - Ajouter bloc "Ce que vous allez payer" toujours visible

**Total** : 1 fichier, ~80 lignes modifiées (suppression + ajout)

**Effort estimé** : 🟢 30 min
