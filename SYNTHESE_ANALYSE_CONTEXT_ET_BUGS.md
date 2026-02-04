# 📊 SYNTHÈSE - Analyse contexte projet + Bugs identifiés

**Date** : 3 février 2026
**Session** : Analyse complète documentation + code pricing
**Statut** : ✅ Analyse terminée - Prêt pour corrections

---

## 🎯 CE QUI A ÉTÉ FAIT

### 1. Lecture de la documentation ✅

**Documents lus** :
- ✅ `UFOVAL_N8N_WORKFLOW_STATUS.md` - Workflow n8n UFOVAL → Supabase
- ✅ `LOT8_FINAL_WORKFLOW_VERIFICATION_REPORT.md` - Sécurité champs CityCrunch
- ✅ `LOT8_WORKFLOWS_COMPARISON_ANALYSIS.md` - Comparaison 2 workflows n8n
- ✅ `LOT8_FIX_N8N_PAYLOAD_INSTRUCTIONS.md` - Instructions fix payload n8n
- ✅ `lib/pricing.ts` - Module de calcul des prix GED (340 lignes)
- ✅ `lib/pricing.test.ts` - Tests unitaires du pricing
- ✅ `lib/supabaseGed.ts` - API Supabase + mapping données (190 lignes)
- ✅ `app/sejour/[id]/stay-detail.tsx` - Page détail séjour (partie concernée)
- ✅ `components/booking-modal.tsx` - Modal de réservation Pro (partie concernée)

**Documents en deadlock** (non accessibles) :
- ❌ `docs/UFOVAL_SCRAPING_WORKFLOW_EXPLAINED.md`
- ❌ `docs/APP_DATA_ALIGNMENT_ANALYSIS.md`
- ❌ `docs/UFOVAL_N8N_SUPABASE_UPSERT_IMPLEMENTATION.md`
- ❌ Autres docs dans `/docs` (problèmes système de fichiers)

### 2. Compréhension logique pricing ✅

**Architecture prix GED** :

```
Prix UFOVAL de base (ex: 615€)
  ↓
+ Surcoût durée GED
  • 7j : +180€
  • 14j : +310€
  • 21j : +450€
  • 6, 8, 12, 13j : prorata sur 14j (base 310€)
  ↓
+ Supplément ville de départ (si ville GED)
  • 12€ fixe pour 10 villes : Paris, Lyon, Rennes, etc.
  • 0€ si "Sans transport"
  ↓
- Promo 5% (appliquée sur le total)
  ↓
= Prix final GED
```

**Options éducatives (ajoutées au moment du booking)** :
- Option ZEN : +49€
- Option ULTIME : +79€

**Exemple de calcul** :
```
Session 7j UFOVAL : 615€
  + Surcoût 7j : 180€
  + Ville Paris : 12€
  = Sous-total : 807€
  - Promo 5% : -40€
  = Prix GED : 767€
```

### 3. Bug critique identifié 🚨

**BUG : "Sans transport" affiche +18€ au lieu de 0€**

**Localisation** :
- **Fichier** : `lib/supabaseGed.ts`
- **Fonction** : `getDepartureCitiesFormatted()`
- **Ligne** : 118-120

**Code bugué** :
```typescript
// Pour extra_eur on veut juste le surcoût transport (sans transport = 0)
cityMap.set(row.city_departure, row.transport_surcharge_ged || 0)
```

**Problème** :
- Le code ne vérifie PAS si la ville est "sans_transport"
- Il prend directement `transport_surcharge_ged` depuis la BDD
- Pour "sans_transport", cette valeur est **18€** au lieu de **0€**

**Conséquence** :
- L'utilisateur Pro qui sélectionne "Sans transport" voit "+18€" dans le prix
- Le prix total est incorrect (18€ de trop)

---

## 🔧 CORRECTIONS À FAIRE

### URGENT - Bug pricing "Sans transport"

**Priorité** : 🔴 CRITIQUE
**Fichier** : `lib/supabaseGed.ts`
**Ligne** : 120

**Fix à appliquer** :
```typescript
// AVANT (bugué)
cityMap.set(row.city_departure, row.transport_surcharge_ged || 0)

// APRÈS (corrigé)
const extraEur = row.city_departure === 'sans_transport'
  ? 0  // ✅ Sans transport = 0€
  : (row.transport_surcharge_ged || 0);
cityMap.set(row.city_departure, extraEur)
```

**Test à faire après fix** :
1. Ouvrir un séjour en mode Pro
2. Sélectionner "Sans transport"
3. Vérifier : pas de ligne "Transport : +18€" ou affichage "Transport : 0€"
4. Vérifier : prix total = sessionPrice + optionPrice (sans les 18€)

### IMPORTANT - Corrections UI (issues F5 et F10)

#### F5 : Badge période vague

**Priorité** : 🟡 IMPORTANTE
**Fichier** : `components/stay-card.tsx`
**Ligne** : 28-29

**Problème actuel** :
```typescript
const period = stay?.period === 'printemps' ? 'Printemps' : 'Été';
```
→ Affiche toujours "Été" de manière générique

**Fix à faire** :
Calculer le badge depuis les dates réelles des sessions :
- JUILLET si toutes les sessions sont en juillet
- AOÛT si toutes les sessions sont en août
- JUIL+AOÛT si mix

#### F10 : Mention partenaire à retirer

**Priorité** : 🟢 MINEURE
**Fichier** : `app/sejour/[id]/stay-detail.tsx`
**Ligne** : 462

**Code à supprimer** :
```html
<span>La connaissance du projet associatif de notre partenaire</span>
```

---

## ❓ QUESTIONS MÉTIER À CLARIFIER

### Q1 : Marge GED - Incohérence 12€ vs 18€

**Constat** :
- `lib/pricing.ts` ligne 63 : `DEPARTURE_SUPPLEMENT: 12` (supplément ville)
- `lib/supabaseGed.ts` ligne 118 : commentaire dit "+18€ GED"
- Données BDD : `transport_surcharge_ged = 18` pour "sans_transport"

**Questions** :
1. La marge GED totale est-elle **12€** ou **18€** ?
2. Les 18€ incluent-ils autre chose que le transport (ex: frais de gestion) ?
3. Structure du prix :
   - Option A : Prix UFOVAL + surcoût durée + **12€ ville** + options ?
   - Option B : Prix UFOVAL + surcoût durée + **18€ marge globale** (dont 12€ ville) ?

**Impact** :
- Si la marge est 18€ (pas 12€), alors le code `pricing.ts` est incorrect
- Si la marge est 12€, alors les données BDD pour "sans_transport" sont incorrectes

### Q2 : Colonne transport_surcharge_ged - Que contient-elle ?

**Hypothèses** :
1. **Hypothèse A** : Surcoût transport UFOVAL + marge GED (18€)
   → Pour "sans_transport", devrait être **18€** (marge seule, pas de transport UFOVAL)
   → Mais alors "sans transport" devrait avoir une marge ?

2. **Hypothèse B** : Surcoût transport total (UFOVAL + ville)
   → Pour "sans_transport", devrait être **0€** (pas de transport du tout)
   → C'est ce que le commentaire ligne 119 suggère ✅

**Recommandation** : Valider avec les specs métier

---

## 📂 DOCUMENTS CRÉÉS

1. **`LOT9_BUG_SANS_TRANSPORT_18EUR_ANALYSIS.md`** (ce fichier)
   - Analyse complète du bug "sans transport"
   - Solution proposée avec code corrigé
   - Tests à effectuer
   - Questions métier à clarifier

2. **`SYNTHESE_ANALYSE_CONTEXT_ET_BUGS.md`** (ce document)
   - Résumé de l'analyse globale
   - Liste des corrections à faire
   - Questions en suspens

---

## 🎯 PROCHAINES ACTIONS RECOMMANDÉES

### Phase 1 : Fix critique pricing (< 1h)

1. ✅ Vérifier données BDD :
   ```sql
   SELECT city_departure, transport_surcharge_ged
   FROM gd_session_prices
   WHERE city_departure = 'sans_transport'
   LIMIT 5;
   ```

2. ✅ Appliquer fix code : `lib/supabaseGed.ts` ligne 120

3. ✅ Tester localement : Vérifier "Sans transport" affiche 0€

4. ✅ Commit : `git commit -m "fix(pricing): Sans transport 0€ au lieu de +18€ (LOT9)"`

### Phase 2 : Clarification métier (< 2h)

5. Clarifier la question : marge GED = 12€ ou 18€ ?

6. Documenter la logique pricing finale (base + durée + transport + options)

7. Si nécessaire : corriger les données BDD ou le code `pricing.ts`

### Phase 3 : Corrections UI (< 1h)

8. Fix F5 : Badge période dynamique (stay-card.tsx ligne 28-29)

9. Fix F10 : Retirer mention partenaire (stay-detail.tsx ligne 462)

10. Commit : `git commit -m "fix(ui): Badge période dynamique + retrait mention partenaire (LOT9)"`

---

## 📊 ÉTAT D'AVANCEMENT

| Tâche | Statut | Priorité |
|-------|--------|----------|
| Lecture docs MD | ✅ Terminé | Haute |
| Compréhension pricing | ✅ Terminé | Haute |
| Identification bug "sans transport" | ✅ Terminé | Critique |
| **Vérification données BDD** | ⏳ En attente | Critique |
| **Fix code supabaseGed.ts** | ⏳ En attente | Critique |
| Clarification métier 12€ vs 18€ | ⏳ En attente | Haute |
| Fix F5 badge période | ⏳ En attente | Moyenne |
| Fix F10 mention partenaire | ⏳ En attente | Basse |

---

## 🔑 POINTS CLÉS RETENUS

1. ✅ **Architecture pricing bien comprise** :
   - Base UFOVAL + surcoût durée + transport ville + options éducatives
   - Promo 5% sur le total (avant options)

2. ✅ **Bug critique identifié et solution proposée** :
   - "Sans transport" affiche +18€ au lieu de 0€
   - Fix simple : vérification `row.city_departure === 'sans_transport' ? 0 : ...`

3. ⚠️ **Incohérence pricing à clarifier** :
   - pricing.ts dit 12€ (DEPARTURE_SUPPLEMENT)
   - supabaseGed.ts dit 18€ GED
   - Besoin de validation métier

4. ✅ **Sécurité CityCrunch confirmée** :
   - Les workflows n8n ne touchent PAS aux champs CityCrunch
   - Aucun risque d'écrasement (voir LOT8_FINAL_WORKFLOW_VERIFICATION_REPORT.md)

5. ✅ **Issues F1, F9 déjà résolues** :
   - F1 (masquage prix Kids) : déjà fixé dans le code
   - F9 (programme "dupliqué") : intentionnel, pas un bug

---

**✅ PRÊT POUR LES CORRECTIONS** : Tous les éléments nécessaires sont identifiés et documentés.

---

*Document généré le 3 février 2026 - Synthèse analyse contexte et bugs*
