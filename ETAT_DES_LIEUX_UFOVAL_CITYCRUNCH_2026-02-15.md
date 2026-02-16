# 🔍 ÉTAT DES LIEUX — Anciens contenus UFOVAL vs Refonte CityCrunch

**Date** : 15 février 2026
**Objectif** : Cartographie des pièges de régression entre contenus legacy UFOVAL et contenus premium CityCrunch
**Tonalité** : CityCrunch (direct, factuel, no bullshit)

---

## 📌 TL;DR (Too Long, Didn't Read)

**Situation actuelle** : La GED App a été migrée d'anciens contenus UFOVAL vers des contenus premium CityCrunch. Les **2 systèmes coexistent** dans la DB pour assurer le fallback.

**☑️ Ce qui est sécurisé** :
✅ 24 séjours ont des contenus premium CityCrunch (`marketing_title`, `punchline`, `expert_pitch`)
✅ Hiérarchie d'affichage blindée (Premium → CityCrunch → Legacy)
✅ Aucune régression d'affichage détectée (vérification 14/02)

**⚠️ Pièges actifs** :
❌ Champs legacy (`title`, `descriptionShort`) toujours en DB → risque fallback si NULL premium
❌ Pas de protection Supabase contre l'écrasement accidentel des champs CityCrunch
❌ Sync N8N UFOVAL nuit peut modifier les données source (mais pas CityCrunch) → risque confusion

---

## 🗂️ ARCHITECTURE DES DONNÉES (DB Supabase)

### Table `gd_stays` — Coexistence 3 niveaux de contenu

| Niveau | Champs | Source | Priorité Affichage | Statut |
|--------|--------|--------|---------------------|--------|
| **PREMIUM** | `marketing_title`, `punchline`, `expert_pitch`, `emotion_tag`, `carousel_group`, `spot_label`, `standing_label`, `expertise_label`, `intensity_label`, `price_includes_features` | CityCrunch (rédaction manuelle) | **1 = Affichage prioritaire** | ✅ Renseigné pour 24/24 séjours |
| **KIDS** | `title_kids`, `description_kids`, `programme` (JSONB) | CityCrunch Kids (rédaction manuelle) | **2 = Fallback si Premium NULL** | ⚠️ Partiel (18/24) |
| **LEGACY** | `title`, `description_short`, `accommodation`, `supervision` | UFOVAL (import partenaire) | **3 = Fallback final** | ✅ Présent pour tous |

**Protection actuelle** : Hiérarchie stricte dans le code front (cf. fichier `stay-detail.tsx` lignes 86-112).

**PIÈGE IDENTIFIÉ** :
Si un champ premium devient `NULL` (suppression accidentelle, migration ratée), le site revient automatiquement au contenu legacy UFOVAL → **régression silencieuse**.

---

## 🛡️ SAUVEGARDES & VÉRIFICATIONS

### 📁 Où sont commises les dernières sauvegardes ?

#### 1. **Vérifications 2026-02-14**
📄 **`VERIFICATION_NOMS_PRIX_2026-02-14.md`** (217 lignes)
**Contenu** :
- ✅ Vérification que "croc marmotte" n'apparaît plus (remplacé par "ALPOO KIDS")
- ✅ Hiérarchie titres : `marketing_title` > `title_kids` > `title`
- ✅ Logique pricing : Base + Surcoût durée + Transport + Options
- ✅ Pas de prix hardcodés (source unique = `gd_session_prices`)

**Conclusion** : Aucun ancien nom détecté. Affichage premium OK.

#### 2. **Corrections fonctionnelles**
📄 **`CORRECTIONS_RESUME.md`** (293 lignes)
**Fixes appliqués** :
- F7 : Bug "Sans transport" (+18€ au lieu de 0€) → **CORRIGÉ**
- F5 : Badge période vague → **EN ATTENTE**
- F9 : Programme dupliqué → **EN ATTENTE**
- F10 : Mention partenaire → **EN ATTENTE**

#### 3. **Analyses contextuelles**
📄 **`SYNTHESE_ANALYSE_CONTEXT_ET_BUGS.md`** (282 lignes)
📄 **`LOT_FUNCTIONAL_AUDIT_FINDINGS.md`** (167 lignes)

**Dates clés** :
- 03/02/2026 : Analyse pricing + bugs
- 14/02/2026 : Vérification noms + prix

---

## ⚠️ PIÈGES DE RÉGRESSION IDENTIFIÉS

### PIÈGE #1 : Fallback automatique vers UFOVAL

**Symptôme** : Un champ premium `NULL` → affichage du contenu legacy UFOVAL.

**Exemple réel (évité de justesse)** :
```typescript
// stay-detail.tsx ligne 87
const displayTitle = (stay as any)?.marketingTitle || (stay as any)?.titleKids || stay?.title;
```

**Si `marketingTitle` = NULL** :
"ALPOO KIDS" → "croc-marmotte" ❌

**Mitigation actuelle** :
- Migration SQL `004_update_marketing_titles.sql` : tous les `marketing_title` renseignés
- Backup intermédiaire : `title_kids` (18/24 séjours)

**🚨 RISQUE RÉSIDUEL** :
Si quelqu'un fait un `UPDATE gd_stays SET marketing_title = NULL WHERE slug = 'croc-marmotte'` → régression immédiate.

---

### PIÈGE #2 : Duplication description/punchline

**Symptôme** : Le même texte s'affiche en H2 **et** en Body.

**Cause** : Fallback en cascade sans protection anti-duplication.

**Code actuel** :
```typescript
// ligne 90-91 : H2 = punchline > descriptionKids > descriptionShort
const displaySubtitle = (stay as any)?.punchline || (stay as any)?.descriptionKids || stay?.descriptionShort;

// ligne 95-99 : Body = expertPitch > descriptionMarketing > punchline > descriptionKids > descriptionShort
let displayDesc = (stay as any)?.expertPitch || ... || (stay as any)?.punchline || ...
```

**🛡️ PROTECTION ACTIVE** (lignes 103-112) :
```typescript
if (displayDesc === displaySubtitle) {
  // Si identiques, forcer un autre contenu ou utiliser programme
}
```

**Exemple régression évitée** :
Si `expertPitch` = NULL et `descriptionMarketing` = NULL → Body = punchline → **DOUBLON** → protection active remplace par les 2 premiers points du programme.

---

### PIÈGE #3 : Sync N8N nuit écrase les données source

**Workflow actuel** :
Chaque nuit, un workflow N8N sync les données UFOVAL → table `gd_stays`.

**Champs modifiés par N8N** (source : `LOT8_FINAL_WORKFLOW_VERIFICATION_REPORT.md`) :
- ✅ `title`, `description_short`, `price_base`, `accommodation`, `supervision` (legacy)
- ❌ **PAS** `marketing_title`, `punchline`, `expert_pitch` (CityCrunch protégé)

**🚨 PIÈGE IDENTIFIÉ** :
Si UFOVAL change le `title` de "Croc' Marmotte" → "Marmotte Express", le champ `gd_stays.title` sera écrasé.
→ Si jamais `marketing_title` devient NULL, on affichera "Marmotte Express" au lieu de "ALPOO KIDS".

**Recommandation** :
Ajouter un champ `source_title` séparé pour garder l'historique UFOVAL sans écraser `title` (qui sert de fallback final).

---

### PIÈGE #4 : Missing fields → crash visuel

**Symptôme** : Si un champ JSONB (`programme`, `price_includes_features`) est mal formaté → crash JS.

**Code vulnérable** :
```typescript
// stay-detail.tsx ligne 81
const programme = Array.isArray(stay?.programme) ? stay.programme : [];
```

**Protection actuelle** : Fallback `[]` si pas array.

**🚨 RISQUE** :
Si `programme` = `null` ou `"corrupted"` → `[]` → section "Contenu du séjour" vide → UX cassée.

**Logs de migration** :
Migration `002_fill_premium_data_24_stays.sql` injecte des `programme` valides. Mais si quelqu'un fait un `UPDATE` manuel avec du JSON invalide → **boom**.

---

## 📋 CHECKLIST DES NOMS LEGACY À NE JAMAIS AFFICHER

**Source** : `docs/NAMING_RULES.md`

| ❌ Ancien Titre (UFOVAL) | ✅ Nouveau Titre (CityCrunch) | Slug | Statut Vérif |
|--------------------------|-------------------------------|------|--------------|
| Moto Moto | **MX RIDER ACADEMY** | moto-moto | ✅ OK |
| Aqua' Fun | **AZUR DIVE & JET** | aqua-fun | ✅ OK |
| Annecy Élément | **ALPINE SKY CAMP** | annecy-element | ✅ OK |
| Croc' Marmotte | **ALPOO KIDS** | croc-marmotte | ✅ OK (vérifié 14/02) |
| Yamakasi Parkour | **URBAN MOVE ACADEMY** | yamakasi | ✅ OK |
| Les P'tits Puisotins | **MY LITTLE FOREST** | les-ptits-puisotins-1 | ✅ OK |
| ... | ... | ... | ... |

**Total** : 24 séjours renommés.

**Commande de vérification** (navigateur DevTools) :
```javascript
document.body.innerText.match(/Moto Moto|Annecy Element|Croc' Marmotte/g)
// Résultat attendu : null (aucun match)
```

**Dernière vérification** : 14/02/2026 → ✅ **AUCUN ancien nom détecté**.

---

## 🔧 ZONES DE CODE CRITIQUES (No Touch)

### 1. Hiérarchie d'affichage (stay-detail.tsx)

**Lignes sensibles** :
```typescript
// Ligne 87 : Titre H1
const displayTitle = (stay as any)?.marketingTitle || (stay as any)?.titleKids || stay?.title;

// Ligne 90 : Sous-titre H2
const displaySubtitle = (stay as any)?.punchline || (stay as any)?.descriptionKids || stay?.descriptionShort;

// Ligne 95 : Body
let displayDesc = (stay as any)?.expertPitch || (stay as any)?.descriptionMarketing || (stay as any)?.punchline || ...
```

**⚠️ RÈGLE D'OR** :
Ne **JAMAIS** inverser l'ordre de priorité. Premium doit **TOUJOURS** être en premier.

---

### 2. Mapping Supabase → camelCase (supabaseGed.ts)

**Lignes 42-73** :
```typescript
.select('*, marketing_title, punchline, expert_pitch, programme, ...')
// Puis mapping manuel :
marketingTitle: stay.marketing_title,
punchline: stay.punchline,
// ...
```

**⚠️ PIÈGE** :
Si vous oubliez `marketing_title` dans le `SELECT` → le champ revient `undefined` → fallback vers legacy → **régression**.

---

### 3. Migration SQL premium (sql/002_fill_premium_data_24_stays.sql)

**Exemple ligne 277-289** (ALPOO KIDS) :
```sql
UPDATE gd_stays SET
  marketing_title = 'ALPOO KIDS',
  punchline = 'Première fois : Marmottes, Confitures et Piscine.',
  expert_pitch = 'La montagne, ce n''est pas que pour les skieurs de l''extrême ! ...',
  emotion_tag = 'COCOONING',
  carousel_group = 'MA_PREMIERE_COLO',
  spot_label = 'Savoie - Beaufortain',
  ...
WHERE slug = 'croc-marmotte';
```

**🚨 ATTENTION** :
Ce fichier a été exécuté **1 fois**. Si vous le rejouez sans `WHERE slug = ...` → écrasement massif.

---

## 🎯 RECOMMANDATIONS (Action Plan)

### COURT TERME (< 1 semaine)

1. **Créer un script de vérification automatique**
   - Check que tous les `marketing_title` != NULL (24/24 séjours)
   - Check que aucun ancien nom UFOVAL n'apparaît dans le DOM
   - Exécuter avant chaque déploiement

2. **Ajouter des constraints SQL**
   ```sql
   ALTER TABLE gd_stays ADD CONSTRAINT check_marketing_title_not_null
   CHECK (published = false OR marketing_title IS NOT NULL);
   ```
   → Empêche de publier un séjour sans `marketing_title`.

3. **Documenter les champs "read-only" pour N8N**
   - Créer une liste explicite des champs que N8N ne doit **jamais** toucher
   - Ajouter une validation dans le workflow N8N

### MOYEN TERME (1-2 semaines)

4. **Créer une table `gd_stays_source_ufoval`**
   - Séparer complètement les données partenaire (UFOVAL) des données GED
   - Avantage : plus de risque d'écrasement accidentel
   - Workflow N8N écrit uniquement dans `gd_stays_source_ufoval`
   - GED App lit uniquement `gd_stays`

5. **Ajouter un audit log**
   - Logger tous les `UPDATE` sur `gd_stays` (trigger Supabase)
   - Permet de tracer qui a modifié quoi et quand
   - Restauration rapide en cas de régression

### LONG TERME (> 1 mois)

6. **Migration complète : supprimer les champs legacy**
   - Une fois que tous les fallbacks sont renseignés (premium + kids)
   - Supprimer `title`, `description_short`, etc.
   - Plus de risque de régression car plus de fallback vers UFOVAL

---

## 📊 TABLEAU DE BORD (État actuel)

| Indicateur | Valeur | Statut |
|------------|--------|--------|
| Séjours avec `marketing_title` | 24/24 | ✅ 100% |
| Séjours avec `punchline` | 24/24 | ✅ 100% |
| Séjours avec `expert_pitch` | 24/24 | ✅ 100% |
| Séjours avec `title_kids` | 18/24 | ⚠️ 75% |
| Anciens noms UFOVAL affichés | 0/24 | ✅ 0% |
| Bugs pricing actifs | 0 | ✅ Corrigés |
| Risque régression | **MOYEN** | ⚠️ Fallback legacy actif |

---

## 🔗 RÉFÉRENCES

**Docs projet** :
- `docs/NAMING_RULES.md` : Liste complète des anciens/nouveaux noms
- `docs/CAROUSEL_RULES.md` : Règles de routing carrousels
- `docs/PRICING_RULES.md` : Logique de calcul des prix

**Vérifications récentes** :
- `VERIFICATION_NOMS_PRIX_2026-02-14.md` : Audit noms + prix (217 lignes)
- `SYNTHESE_ANALYSE_CONTEXT_ET_BUGS.md` : Analyse bugs (282 lignes)
- `LOT_FUNCTIONAL_AUDIT_FINDINGS.md` : Audit fonctionnel (167 lignes)

**Code critique** :
- `app/sejour/[id]/stay-detail.tsx` : Hiérarchie affichage (lignes 86-112)
- `lib/supabaseGed.ts` : Mapping DB → Front (lignes 42-104)
- `sql/002_fill_premium_data_24_stays.sql` : Migration contenus premium
- `sql/004_update_marketing_titles.sql` : Update noms marketing

**Workflows N8N** :
- `LOT8_FINAL_WORKFLOW_VERIFICATION_REPORT.md` : Sécurité CityCrunch
- `N8N_IMAGE_COLLECTOR_GUIDE.md` : Collecte images (pas de risque contenu)

---

## ✅ CONCLUSION

**Ce qui marche** : La hiérarchie d'affichage Premium > Kids > Legacy protège bien contre les régressions visuelles. Aucun ancien nom UFOVAL n'est affiché (vérifié 14/02).

**Ce qui est fragile** : La coexistence de 3 niveaux de contenus dans la même DB crée un risque de régression silencieuse si les champs premium deviennent NULL.

**Prochaines étapes** :
1. Ajouter constraints SQL (`marketing_title NOT NULL` si `published = true`)
2. Créer script de vérification automatique (CI/CD)
3. Séparer DB source UFOVAL / DB GED (moyen terme)

---

**Auteur** : Antigravity (Deepmind)
**Tonalité** : CityCrunch (no fluff, facts only)
**Date** : 15/02/2026
