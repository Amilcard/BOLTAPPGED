# IMPLÉMENTATION FIX PRICING UX - 2026-02-05

**Mode** : `economy_secure_no_regression`  
**Objectif** : Rendre le prix TTC visible en temps réel (session + ville)  
**Scope** : Composant `stay-detail.tsx` uniquement

---

## ✅ CHANGEMENTS IMPLÉMENTÉS

### 1. Carte "Tarif de référence" (Infos Clés)

**Fichier** : `app/sejour/[id]/stay-detail.tsx` (lignes 407-424)

**Avant** :
```tsx
<div className="flex flex-col items-center text-center p-4 ...">
  <Shield className="w-5 h-5" />
  <span>Encadrement</span>
  <span>{stay?.supervision}</span>
</div>
```

**Après** :
```tsx
<div className="flex flex-col items-center text-center p-4 ...">
  {isPro ? <Tag className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
  <span>{isPro ? 'Tarif (référence)' : 'Encadrement'}</span>
  {isPro && minSessionPrice !== null ? (
    <>
      <span>À partir de {minSessionPrice}€</span>
      <span className="text-[10px] text-gray-500">sans transport</span>
    </>
  ) : isPro ? (
    <span>Sur devis</span>
  ) : (
    <span>{stay?.supervision}</span>
  )}
</div>
```

**Comportement** :
- **PRO** : Affiche "Tarif (référence)" + prix minimum + "sans transport"
- **KIDS** : Affiche "Encadrement" + supervision (inchangé)

---

### 2. Bloc "Ce que vous allez payer" (Toujours Visible)

**Fichier** : `app/sejour/[id]/stay-detail.tsx` (lignes 589-634)

**Avant** :
```tsx
{/* Bloc caché par défaut */}
{!showPriceEstimation ? (
  <button onClick={() => setShowPriceEstimation(true)}>
    Voir l'estimation tarifaire
  </button>
) : (
  <div>
    <div>À partir de {minPrice}€ sans transport</div>
    {total && <div>Votre estimation : {total}€</div>}
  </div>
)}
```

**Après** :
```tsx
{/* Bloc toujours visible (PRO uniquement) */}
{isPro && (
  <div className="bg-gradient-to-br from-primary/5 to-accent/5 border-2 border-primary/20 rounded-xl p-4">
    <div className="flex items-center gap-2 mb-3">
      <Tag className="w-4 h-4 text-primary" />
      <span className="text-sm font-bold">Ce que vous allez payer</span>
    </div>
    
    {priceBreakdown.baseSession !== null ? (
      <div className="space-y-2">
        {/* Session */}
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Session</span>
          <span className="font-semibold">{priceBreakdown.baseSession}€</span>
        </div>
        
        {/* Transport */}
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Transport</span>
          <span className="font-semibold">
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
          <span className="text-base font-bold">Total TTC</span>
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

**Comportement** :
- **Toujours visible** (pas de clic requis)
- **Détail complet** : Session + Transport + Total TTC
- **Dynamique** : Se met à jour à chaque sélection (session/ville)
- **PRO uniquement** : Condition `isPro`

---

### 3. Nettoyage État

**Fichier** : `app/sejour/[id]/stay-detail.tsx` (ligne 44)

**Supprimé** :
```tsx
const [showPriceEstimation, setShowPriceEstimation] = useState(false);
```

**Raison** : État non utilisé après suppression du bloc caché

---

## 🎯 RÉSULTAT VISUEL

### Avant (Problématique)

```
┌─────────────────────────────────────────┐
│ SIDEBAR                                 │
├─────────────────────────────────────────┤
│ Informations clés                       │
│ [Lieu] [Hébergement] [Encadrement] ... │
├─────────────────────────────────────────┤
│ Sessions disponibles                    │
│ [x] 4 juillet 2026                      │
├─────────────────────────────────────────┤
│ Villes de départ                        │
│ [x] Paris +288€                         │
├─────────────────────────────────────────┤
│ [Voir l'estimation tarifaire] ← CACHÉ  │ ❌
├─────────────────────────────────────────┤
│ [Réserver ce séjour]                    │
└─────────────────────────────────────────┘
```

### Après (Solution)

```
┌─────────────────────────────────────────┐
│ SIDEBAR                                 │
├─────────────────────────────────────────┤
│ Informations clés                       │
│ [Lieu] [Hébergement] [Tarif (réf)] ... │ ✅ Nouveau
│                      À partir de 890€   │
│                      sans transport     │
├─────────────────────────────────────────┤
│ Sessions disponibles                    │
│ [x] 4 juillet 2026                      │
├─────────────────────────────────────────┤
│ Villes de départ                        │
│ [x] Paris +288€                         │
├─────────────────────────────────────────┤
│ 💰 Ce que vous allez payer              │ ✅ Toujours visible
│ Session: 890€                           │
│ Transport: +288€ (Paris)                │
│ ───────────────────                     │
│ Total TTC: 1178€                        │ ✅ En temps réel
├─────────────────────────────────────────┤
│ [Réserver ce séjour]                    │
└─────────────────────────────────────────┘
```

---

## 🧪 TESTS DE VALIDATION

### Test 1 : Aucun Choix

**État** :
- `preSelectedSessionId = ''`
- `preSelectedCity = ''`

**Résultat Attendu** :
- ✅ Carte "Tarif (référence)" : "À partir de 890€ sans transport"
- ✅ Bloc "Ce que vous allez payer" : "Sélectionnez une session..."
- ✅ CTA "Réserver" visible

### Test 2 : Session Choisie, Ville = Sans Transport

**État** :
- `preSelectedSessionId = 'aqua-fun-0'` (890€)
- `preSelectedCity = ''` (défaut = Sans transport)

**Résultat Attendu** :
- ✅ Session : 890€
- ✅ Transport : 0€ (Sans transport)
- ✅ Total TTC : 890€

### Test 3 : Session + Paris (+288€)

**État** :
- `preSelectedSessionId = 'aqua-fun-0'` (890€)
- `preSelectedCity = 'Paris'` (+288€)

**Résultat Attendu** :
- ✅ Session : 890€
- ✅ Transport : +288€ (Paris)
- ✅ Total TTC : 1178€
- ✅ "À partir de" reste 890€ (référence immuable)

### Test 4 : Ville Choisie PUIS Session

**Actions** :
1. User clique Paris (+288€)
2. User clique Session 4 juillet (890€)

**Résultat Attendu** :
- ✅ Total TTC = 1178€ (dès sélection session)
- ✅ Pas de reset du choix ville
- ✅ Détail correct : Session 890€ + Transport +288€

---

## 📊 WIRING ÉTAT → CALCUL → AFFICHAGE

### État (useState)

```tsx
preSelectedSessionId: string  // ID session sélectionnée
preSelectedCity: string       // Ville sélectionnée
```

### Calculs Dérivés (Re-render Automatique)

```tsx
minSessionPrice = getMinSessionPrice(sessions)           // Prix minimum
selectedCityData = departures.find(preSelectedCity)      // Données ville
cityExtraEur = selectedCityData?.extra_eur ?? 0          // Surcoût ville
selectedSession = sessions.find(preSelectedSessionId)    // Session sélectionnée
selectedSessionPrice = findSessionPrice(selectedSession) // Prix session
priceBreakdown = getPriceBreakdown({...})                // Breakdown complet
```

### Affichage (UI)

```tsx
// Carte "Tarif (référence)"
{minSessionPrice}€ sans transport

// Bloc "Ce que vous allez payer"
Session: {priceBreakdown.baseSession}€
Transport: +{cityExtraEur}€ ({preSelectedCity})
Total TTC: {priceBreakdown.total}€
```

**Flow** :
1. User clique session → `setPreSelectedSessionId()` → Re-render → Calculs mis à jour → UI mise à jour
2. User clique ville → `setPreSelectedCity()` → Re-render → Calculs mis à jour → UI mise à jour

---

## 🔒 NO REGRESSION

### Changements Scope

| Élément | Modifié ? | Impact |
|---------|-----------|--------|
| **Routing** | ❌ Non | Aucun |
| **Pro/Kids flows** | ✅ Oui | Bloc visible uniquement si `isPro` |
| **Supabase schema** | ❌ Non | Aucun |
| **Theme logic** | ❌ Non | Aucun |
| **UI global tokens** | ❌ Non | Aucun |
| **Calcul pricing** | ❌ Non | Logique existante inchangée |
| **État session/ville** | ❌ Non | Wiring existant inchangé |

### Tests Non-Régression

| Scénario | Attendu | Statut |
|----------|---------|--------|
| **Kids** : Carte "Encadrement" visible | ✅ Affiche supervision | À tester |
| **Kids** : Pas de bloc pricing | ✅ Bloc caché | À tester |
| **Pro** : Carte "Tarif (référence)" visible | ✅ Affiche prix min | À tester |
| **Pro** : Bloc "Ce que vous allez payer" visible | ✅ Toujours visible | À tester |
| **Mobile** : Responsive | ✅ Sidebar responsive | À tester |
| **Desktop** : Layout | ✅ Sidebar 3 colonnes | À tester |

---

## 📝 FICHIERS MODIFIÉS

1. `app/sejour/[id]/stay-detail.tsx`
   - Lignes 40-45 : Suppression état `showPriceEstimation`
   - Lignes 407-424 : Carte "Tarif (référence)" (PRO) / "Encadrement" (KIDS)
   - Lignes 589-634 : Bloc "Ce que vous allez payer" (toujours visible)

**Total** : 1 fichier, ~60 lignes modifiées

---

## 🎯 DEFINITION OF DONE

- [x] Carte "Tarif (référence)" visible dans Infos clés (PRO)
- [x] Bloc "Ce que vous allez payer" toujours visible au-dessus CTA (PRO)
- [x] Total TTC se met à jour en temps réel (session + ville)
- [x] Code compile sans erreur
- [ ] Tests manuels validés (4 cas)
- [ ] Tests non-régression validés (Kids/Mobile/Desktop)
- [ ] Comportement identique sur 4 séjours testés

---

## 🚀 PROCHAINES ÉTAPES

1. **Validation visuelle** : Tester sur `/sejour/aqua-fun`
   - Desktop : Vérifier carte + bloc pricing
   - Mobile : Vérifier responsive
   - Kids : Vérifier pas de régression

2. **Tests multi-séjours** : Vérifier sur 4 séjours différents
   - Aqua'Fun (7j)
   - Croc'Marmotte (7j)
   - Aqua'Gliss (7j)
   - Séjour multi-durées (7j + 14j)

3. **Déploiement** : Commit + Push quand validé

---

**Statut** : ✅ **Implémentation terminée**  
**Compilation** : ✅ **OK**  
**Prochaine étape** : Validation visuelle
