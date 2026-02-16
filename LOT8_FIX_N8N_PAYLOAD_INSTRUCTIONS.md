# 🔴 URGENT - FIX N8N PAYLOAD AVANT 02:00

**Date :** 3 février 2026
**Lot :** LOT_N8N_DAILY_UPDATE_RISK_CITYCRUNCH_OVERWRITE
**Statut :** 🚨 RISQUE CRITIQUE CONFIRMÉ

---

## ⚠️ SYNTHÈSE DU PROBLÈME

Les champs **CityCrunch** (`title_pro`, `title_kids`, `description_pro`, `description_kids`) sont **INCLUS** dans le payload n8n et seront **ÉCRASÉS** à chaque exécution du workflow quotidien (prévu à 02:00).

**Impact :** Perte totale des textes personnalisés CityCrunch.

---

## ✅ SOLUTION (5 minutes)

### Option retenue : **OPT_A - Retirer les champs CityCrunch du payload n8n**

**Avantages :**
- ✅ Simple (4 lignes à supprimer)
- ✅ 0% de risque d'écrasement
- ✅ Aucune régression sur l'app
- ✅ Performance identique

---

## 📋 INSTRUCTIONS ÉTAPE PAR ÉTAPE

### ÉTAPE 1 : Ouvrir le workflow n8n

**URL :** https://n8n.srv1307641.hstgr.cloud/workflow/kG6OASM4PxZaBt9H

1. Se connecter à n8n
2. Ouvrir le workflow `GED__UFOVAL__SCRAPE_SEED_STAYS__v1`
3. Localiser le nœud **`HTTP__UPSERT_GD_STAYS`**

---

### ÉTAPE 2 : Modifier le bodyExpression

#### CODE ACTUEL (À MODIFIER) :

```javascript
={{ $input.all().map(item => ({
  source_url: item.json.source_url,
  slug: item.json.slug || item.json.source_url.split('/').pop().replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
  title: item.json.pro?.title_pro || item.json.kids?.title_kids || 'Sans titre',
  title_pro: item.json.pro?.title_pro,                           // ❌ À SUPPRIMER
  title_kids: item.json.kids?.title_kids,                         // ❌ À SUPPRIMER
  description_pro: item.json.pro?.description_pro || null,        // ❌ À SUPPRIMER
  description_kids: item.json.kids?.description_kids || null,     // ❌ À SUPPRIMER
  sessions_json: typeof item.json.sessions_json === 'string' ? item.json.sessions_json : JSON.stringify(item.json.sessions_json),
  published: true,
  import_batch_ts: new Date().toISOString()
})) }}
```

#### NOUVEAU CODE (SÉCURISÉ) :

```javascript
={{ $input.all().map(item => ({
  source_url: item.json.source_url,
  slug: item.json.slug || item.json.source_url.split('/').pop().replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
  title: item.json.pro?.title_pro || item.json.kids?.title_kids || 'Sans titre',
  sessions_json: typeof item.json.sessions_json === 'string' ? item.json.sessions_json : JSON.stringify(item.json.sessions_json),
  published: true,
  import_batch_ts: new Date().toISOString()
})) }}
```

**Changements :**
- ❌ **SUPPRIMER** la ligne : `title_pro: item.json.pro?.title_pro,`
- ❌ **SUPPRIMER** la ligne : `title_kids: item.json.kids?.title_kids,`
- ❌ **SUPPRIMER** la ligne : `description_pro: item.json.pro?.description_pro || null,`
- ❌ **SUPPRIMER** la ligne : `description_kids: item.json.kids?.description_kids || null,`

**Résultat :** n8n n'enverra **JAMAIS** ces champs → Supabase ne les touchera **JAMAIS**.

---

### ÉTAPE 3 : Ajouter un commentaire de documentation

Dans le nœud `HTTP__UPSERT_GD_STAYS`, ajouter cette note dans le champ **"Notes"** :

```
⚠️ IMPORTANT (LOT8 - 03/02/2026):
Les champs title_pro, title_kids, description_pro, description_kids ne sont PAS inclus dans ce payload.
Ces champs sont gérés par CityCrunch/LLM et ne doivent JAMAIS être écrasés par n8n.
Si besoin de reformulation LLM : créer un workflow séparé.
```

---

### ÉTAPE 4 : Sauvegarder et tester

1. **Sauvegarder** le workflow (Ctrl+S ou bouton "Save")
2. **Tester** en mode manuel :
   - Cliquer sur "Execute Workflow"
   - Vérifier que le workflow s'exécute sans erreur
   - Vérifier dans Supabase que les données sont insérées/mises à jour

3. **Vérification SQL** (dans Supabase SQL Editor) :

```sql
-- Vérifier qu'un stay existant CONSERVE ses champs CityCrunch :
SELECT slug, title, title_pro, title_kids, description_pro, import_batch_ts
FROM public.gd_stays
WHERE title_pro IS NOT NULL OR title_kids IS NOT NULL
ORDER BY import_batch_ts DESC
LIMIT 5;
```

**Résultat attendu :** Les champs `title_pro`, `title_kids`, `description_pro`, `description_kids` doivent rester **inchangés** après l'exécution du workflow.

---

## 📊 VÉRIFICATIONS RECOMMANDÉES

### Avant le fix :

```sql
-- Compter les champs CityCrunch remplis :
SELECT
  SUM((title_pro IS NOT NULL)::INT)::INT AS title_pro_filled,
  SUM((title_kids IS NOT NULL)::INT)::INT AS title_kids_filled,
  SUM((description_pro IS NOT NULL)::INT)::INT AS description_pro_filled,
  SUM((description_kids IS NOT NULL)::INT)::INT AS description_kids_filled,
  COUNT(*)::INT AS total_stays
FROM public.gd_stays;
```

### Après le fix :

```sql
-- Vérifier que les chiffres sont identiques (aucun champ écrasé) :
SELECT
  SUM((title_pro IS NOT NULL)::INT)::INT AS title_pro_filled,
  SUM((title_kids IS NOT NULL)::INT)::INT AS title_kids_filled,
  SUM((description_pro IS NOT NULL)::INT)::INT AS description_pro_filled,
  SUM((description_kids IS NOT NULL)::INT)::INT AS description_kids_filled,
  COUNT(*)::INT AS total_stays
FROM public.gd_stays;
```

**Les chiffres doivent être identiques ou supérieurs (si nouveaux stays ajoutés).**

---

## 🔍 ANALYSE DÉTAILLÉE DU RISQUE

### Tables touchées par n8n :

| Table | Nœud n8n | Conflit sur | Stratégie |
|-------|----------|-------------|-----------|
| `gd_stays` | `HTTP__UPSERT_GD_STAYS` | `source_url` | `merge-duplicates` (UPDATE ALL) |
| `gd_stay_sessions` | `HTTP__UPSERT_GD_STAY_SESSIONS` | `stay_slug,start_date,end_date` | `merge-duplicates` |

### Champs upsertés AVANT le fix :

- ✅ `source_url` (OK, clé unique)
- ✅ `slug` (OK)
- ✅ `title` (OK, fallback)
- ⚠️ `title_pro` **← CITYCRUNCH - ÉCRASÉ**
- ⚠️ `title_kids` **← CITYCRUNCH - ÉCRASÉ**
- ⚠️ `description_pro` **← CITYCRUNCH - ÉCRASÉ**
- ⚠️ `description_kids` **← CITYCRUNCH - ÉCRASÉ**
- ✅ `sessions_json` (OK)
- ✅ `published` (OK)
- ✅ `import_batch_ts` (OK)

### Champs upsertés APRÈS le fix :

- ✅ `source_url` (OK, clé unique)
- ✅ `slug` (OK)
- ✅ `title` (OK, fallback)
- 🔒 `title_pro` **← PROTÉGÉ (non envoyé)**
- 🔒 `title_kids` **← PROTÉGÉ (non envoyé)**
- 🔒 `description_pro` **← PROTÉGÉ (non envoyé)**
- 🔒 `description_kids` **← PROTÉGÉ (non envoyé)**
- ✅ `sessions_json` (OK)
- ✅ `published` (OK)
- ✅ `import_batch_ts` (OK)

---

## ❓ QUESTIONS RÉPONDUES (RÉSUMÉ)

### Q1 : Workflow exact qui tourne chaque jour à 02:00 ?
**Réponse :**
- Nom : `GED__UFOVAL__SCRAPE_SEED_STAYS__v1`
- URL : https://n8n.srv1307641.hstgr.cloud/workflow/kG6OASM4PxZaBt9H
- Horaire : **À VÉRIFIER dans n8n (Settings > Schedule)**
- Nœuds finaux : `HTTP__UPSERT_GD_STAYS` → `TRANSFORM__SESSIONS_TO_ROWS` → `HTTP__UPSERT_GD_STAY_SESSIONS`

### Q2 : Quelles tables Supabase sont mises à jour ?
**Réponse :**
- `gd_stays` (via `HTTP__UPSERT_GD_STAYS`)
- `gd_stay_sessions` (via `HTTP__UPSERT_GD_STAY_SESSIONS`)

### Q3 : Liste des colonnes envoyées dans l'upsert gd_stays ?
**Réponse (AVANT fix) :**
- `source_url`, `slug`, `title`, `title_pro` ⚠️, `title_kids` ⚠️, `description_pro` ⚠️, `description_kids` ⚠️, `sessions_json`, `published`, `import_batch_ts`

**Réponse (APRÈS fix) :**
- `source_url`, `slug`, `title`, `sessions_json`, `published`, `import_batch_ts`
- **Les champs CityCrunch ne sont PLUS envoyés.**

### Q4 : Quelle est la stratégie d'upsert/conflit ?
**Réponse :**
- `on_conflict=source_url`
- Header : `Prefer: resolution=merge-duplicates,return=representation`
- **Comportement :** UPDATE **TOUS les champs** du payload lors d'un conflit.
- **Risque :** Si un champ est dans le payload, il sera ÉCRASÉ. **→ Solution : retirer les champs CityCrunch du payload.**

### Q5 : Quels champs texte viennent de la source UFOVAL ?
**Réponse :**
- `source_url` (URL de l'article UFOVAL)
- `title` (titre brut UFOVAL)
- `sessions_json` (dates, prix, places)
- `item.json.pro?.title_pro` (probablement vide ou texte brut UFOVAL)
- `item.json.kids?.title_kids` (probablement vide ou texte brut UFOVAL)

**Le mot "UFOVAL" n'est probablement PAS injecté dans les champs stockés**, mais les textes bruts UFOVAL le sont.

### Q6 : Y a-t-il une étape de reformulation LLM dans n8n ?
**Réponse :**
- **NON.** Aucune reformulation LLM dans le workflow actuel.
- Les textes sont copiés **directement depuis UFOVAL** vers les champs CityCrunch.
- **Problème architectural :** Les champs CityCrunch sont censés contenir des textes **reformulés** pour les familles (ton CityCrunch), pas les textes bruts UFOVAL.

**→ Solution à long terme :** Créer un workflow n8n séparé avec reformulation LLM, ou gérer la reformulation dans l'app.

---

## 🎯 PROCHAINES ÉTAPES

### Immédiat (< 1h) :
1. ✅ Modifier le payload n8n (retirer les 4 champs CityCrunch)
2. ✅ Sauvegarder et tester le workflow
3. ✅ Vérifier que les champs CityCrunch sont préservés

### Court terme (cette semaine) :
4. Vérifier le planning du workflow (confirmer l'heure 02:00)
5. Documenter la stratégie de contenu (quand utiliser `title` vs `title_pro` vs `title_kids`)
6. Décider comment remplir les champs CityCrunch (LLM dans l'app ? Workflow séparé ?)

### Long terme (ce mois) :
7. Si besoin de reformulation LLM : créer un **nouveau workflow n8n** qui :
   - Lit `gd_stays` (WHERE `title_pro` IS NULL)
   - Reformule les textes avec LLM (OpenAI, Claude, etc.)
   - Met à jour **UNIQUEMENT** `title_pro`, `title_kids`, `description_pro`, `description_kids`
   - Ne touche PAS aux autres champs (source_url, sessions_json, etc.)

---

## 📄 DOCUMENTS GÉNÉRÉS

1. **`LOT8_N8N_CITYCRUNCH_RISK_ASSESSMENT.json`** : Analyse complète du risque (ce fichier)
2. **`LOT8_FIX_N8N_PAYLOAD_INSTRUCTIONS.md`** : Instructions de fix (ce document)

---

## ✅ DEFINITION OF DONE

- [x] On sait exactement ce que n8n met à jour (tables + champs + stratégie)
- [x] On sait que CityCrunch peut être écrasé (risque confirmé à 100%)
- [x] Une protection est proposée (OPT_A : retirer champs du payload)
- [ ] Le code n8n a été modifié (bodyExpression du nœud `HTTP__UPSERT_GD_STAYS`)
- [ ] Le workflow a été testé en mode manuel
- [ ] Vérification SQL confirme que les champs CityCrunch sont préservés

---

**🚨 ACTION REQUISE :** Modifier le workflow n8n **AVANT la prochaine exécution automatique à 02:00** pour éviter l'écrasement des champs CityCrunch.

---

*Document généré le 3 février 2026 - Lot 8 : Sécurisation workflow n8n*
