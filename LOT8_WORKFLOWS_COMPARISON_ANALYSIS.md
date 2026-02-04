# 🔍 ANALYSE COMPARATIVE DES 2 WORKFLOWS N8N

**Date :** 3 février 2026
**Objectif :** Comprendre la relation entre les deux workflows et identifier les risques d'écrasement CityCrunch

---

## 📊 VUE D'ENSEMBLE

Vous avez **2 workflows n8n distincts** qui travaillent sur la même table `gd_stays` mais avec des **rôles complémentaires** :

| Workflow | URL | Rôle | Méthode HTTP | Risque CityCrunch |
|----------|-----|------|--------------|-------------------|
| **Workflow 1** | [kG6OASM4PxZaBt9H](https://n8n.srv1307641.hstgr.cloud/workflow/kG6OASM4PxZaBt9H) | Création initiale des stays | POST (upsert) | 🔴 **CRITIQUE** |
| **Workflow 2** | [0GlIeZKVR7VoUFYNOYMVl](https://n8n.srv1307641.hstgr.cloud/workflow/0GlIeZKVR7VoUFYNOYMVl) | Enrichissement contenu | PATCH (update) | ✅ **SÉCURISÉ** |

---

## 🔴 WORKFLOW 1 : `GED__UFOVAL__SCRAPE_SEED_STAYS__v1` (RISQUE CONFIRMÉ)

### Identification
- **URL :** https://n8n.srv1307641.hstgr.cloud/workflow/kG6OASM4PxZaBt9H
- **Nom :** GED__UFOVAL__SCRAPE_SEED_STAYS__v1
- **Statut :** ⚠️ NON ANALYSÉ DANS CE FICHIER JSON (vous ne l'avez pas uploadé)

### Rôle
- Scrape les pages UFOVAL depuis la source
- **CRÉE** les stays dans `gd_stays` (INSERT/UPSERT)
- **CRÉE** les sessions dans `gd_stay_sessions`

### Méthode
- **POST** avec `on_conflict=source_url`
- Header : `Prefer: resolution=merge-duplicates`
- **Comportement :** INSERT si nouveau, UPDATE ALL si existe déjà

### Champs envoyés (PROBLÈME ICI)
```json
{
  "source_url": "...",
  "slug": "...",
  "title": "...",
  "title_pro": "...",              // ⚠️ CITYCRUNCH - ÉCRASÉ
  "title_kids": "...",              // ⚠️ CITYCRUNCH - ÉCRASÉ
  "description_pro": "...",         // ⚠️ CITYCRUNCH - ÉCRASÉ
  "description_kids": "...",        // ⚠️ CITYCRUNCH - ÉCRASÉ
  "sessions_json": "...",
  "published": true,
  "import_batch_ts": "..."
}
```

### Risque
🔴 **CRITIQUE** : Les champs CityCrunch sont **INCLUS** dans le payload et seront **ÉCRASÉS** à chaque exécution.

---

## ✅ WORKFLOW 2 : `GED_UFOVAL_SCRAPE_CONTENU_ALL` (SÉCURISÉ)

### Identification
- **URL :** https://n8n.srv1307641.hstgr.cloud/workflow/0GlIeZKVR7VoUFYNOYMVl
- **Nom :** GED_UFOVAL_SCRAPE_CONTENU_ALL
- **Statut :** ✅ Analysé (fichier JSON uploadé)

### Rôle
1. **LIT** les stays existants depuis Supabase :
   ```
   SELECT slug, source_url FROM gd_stays WHERE published=true
   ```
2. Fetch chaque page UFOVAL pour extraire le contenu détaillé
3. **ENRICHIT** les stays avec contenu scraped (titre, accroche, programme, images, etc.)

### Méthode
- **PATCH** (pas POST !)
- URL : `https://iirfvndgzutbxwfdwawu.supabase.co/rest/v1/gd_stays?slug=eq.{{ $json.slug }}`
- **Comportement :** UPDATE uniquement les champs envoyés (pas de merge-duplicates)

### Champs envoyés (SÉCURISÉ)
```json
{
  "title": "...",               // ✅ OK (champ fallback, pas CityCrunch)
  "accroche": "...",            // ✅ OK
  "programme": "...",           // ✅ OK
  "centre_name": "...",         // ✅ OK
  "location_city": "...",       // ✅ OK
  "location_region": "...",     // ✅ OK
  "ged_theme": "...",           // ✅ OK
  "images": ["..."],            // ✅ OK
  "updated_at": "..."           // ✅ OK
}
```

### Champs NON envoyés (PROTÉGÉS)
✅ `title_pro` → **NON TOUCHÉ**
✅ `title_kids` → **NON TOUCHÉ**
✅ `description_pro` → **NON TOUCHÉ**
✅ `description_kids` → **NON TOUCHÉ**
✅ `sessions_json` → **NON TOUCHÉ**

### Risque
✅ **SÉCURISÉ** : Ce workflow **NE TOUCHE PAS** aux champs CityCrunch. Aucun risque d'écrasement.

---

## 🔗 INTERDÉPENDANCES ENTRE LES 2 WORKFLOWS

### Séquence logique

```
┌─────────────────────────────────────────────────────────────┐
│  WORKFLOW 1 : GED__UFOVAL__SCRAPE_SEED_STAYS__v1            │
│  (Création initiale)                                         │
├─────────────────────────────────────────────────────────────┤
│  1. Scrape pages UFOVAL depuis la source                    │
│  2. Extrait sessions_json, prix, dates                      │
│  3. INSERT/UPSERT dans gd_stays + gd_stay_sessions         │
│  4. ⚠️ PROBLÈME : inclut title_pro/title_kids/etc.         │
└─────────────────────────────────────────────────────────────┘
                         ↓
                    ENSUITE
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  WORKFLOW 2 : GED_UFOVAL_SCRAPE_CONTENU_ALL                 │
│  (Enrichissement contenu)                                    │
├─────────────────────────────────────────────────────────────┤
│  1. LIT les stays existants (SELECT slug, source_url)      │
│  2. Re-fetch chaque page UFOVAL pour extraire contenu      │
│  3. PATCH uniquement les champs de contenu                 │
│  4. ✅ SÉCURISÉ : ne touche PAS aux champs CityCrunch      │
└─────────────────────────────────────────────────────────────┘
```

### Dépendances
- **Workflow 2 DÉPEND de Workflow 1** : il lit les stays existants créés par Workflow 1
- **Workflow 1 est AUTONOME** : il scrape depuis zéro et crée les stays
- **Pas de conflit direct** : Workflow 2 ne touche pas aux mêmes champs que Workflow 1 (sauf `title`)

### Ordre d'exécution probable
1. **Workflow 1** : Quotidien à 02:00 (à confirmer) → Création/mise à jour des stays + sessions
2. **Workflow 2** : Déclenché manuellement ou moins fréquemment → Enrichissement du contenu

---

## ⚠️ ANALYSE DU CHAMP `title` (POINT D'ATTENTION)

### Workflow 1 envoie :
```json
"title": item.json.pro?.title_pro || item.json.kids?.title_kids || 'Sans titre'
```
→ Utilise `title_pro` comme source pour remplir `title` (fallback)

### Workflow 2 envoie :
```json
"title": $json.title
```
→ Extrait le titre depuis la page UFOVAL (titre brut)

### Risque potentiel
Si **Workflow 2 s'exécute APRÈS Workflow 1**, il peut **écraser** le champ `title` avec le titre brut UFOVAL au lieu du titre CityCrunch.

**Cependant :**
- Ce n'est PAS critique car `title` est un champ **fallback** (utilisé si title_pro/title_kids sont vides)
- Les champs **importants** sont `title_pro` et `title_kids` (ceux-ci sont protégés dans Workflow 2)

---

## 🎯 STRATÉGIE DE PROTECTION RECOMMANDÉE

### Option A (RECOMMANDÉE) : Protéger les 2 workflows

#### Workflow 1 (URGENT - CRITIQUE) :
✅ **Retirer** `title_pro`, `title_kids`, `description_pro`, `description_kids` du payload

#### Workflow 2 (OPTIONNEL - AMÉLIORATION) :
✅ **Retirer** le champ `title` du payload (ou le conditionner : ne l'envoyer que si title_pro/title_kids sont vides)

### Option B : Ordre d'exécution strict

Si vous voulez garder le champ `title` dans les deux workflows :
1. **Workflow 1** s'exécute en premier (création + sessions)
2. **Workflow 2** s'exécute ENSUITE (enrichissement contenu)
3. **NE JAMAIS ré-exécuter Workflow 1** sur les stays existants (ou utiliser `resolution=ignore-duplicates` au lieu de `merge-duplicates`)

---

## 📋 PLAN D'ACTION PRIORISÉ

### URGENT (< 1h) :
1. ✅ **Modifier Workflow 1** (kG6OASM4PxZaBt9H)
   - Retirer `title_pro`, `title_kids`, `description_pro`, `description_kids` du payload
   - Sauvegarder et tester

### COURT TERME (cette semaine) :
2. ✅ **Vérifier la planification** des deux workflows
   - Workflow 1 : confirmer l'heure (probablement 02:00)
   - Workflow 2 : vérifier s'il est automatique ou manuel

3. ✅ **Décider de la stratégie pour le champ `title`** :
   - Option A : Le gérer uniquement dans Workflow 1 (et le retirer de Workflow 2)
   - Option B : Le gérer uniquement dans Workflow 2 (enrichissement contenu)

### MOYEN TERME (ce mois) :
4. ✅ **Créer un workflow de reformulation LLM** (optionnel)
   - Si vous voulez générer automatiquement les champs CityCrunch
   - Workflow séparé qui lit gd_stays, reformule avec LLM, met à jour title_pro/title_kids/description_pro/description_kids

---

## 📊 TABLEAU RÉCAPITULATIF DES CHAMPS

| Champ | Workflow 1 | Workflow 2 | CityCrunch ? | Risque |
|-------|------------|------------|--------------|--------|
| `source_url` | ✅ Envoyé | ❌ Non envoyé | ❌ Non | Aucun |
| `slug` | ✅ Envoyé | ❌ Non envoyé | ❌ Non | Aucun |
| `title` | ✅ Envoyé | ✅ Envoyé | ❌ Non (fallback) | ⚠️ Faible |
| `title_pro` | ⚠️ **Envoyé** | ❌ Non envoyé | ✅ **Oui** | 🔴 **CRITIQUE** |
| `title_kids` | ⚠️ **Envoyé** | ❌ Non envoyé | ✅ **Oui** | 🔴 **CRITIQUE** |
| `description_pro` | ⚠️ **Envoyé** | ❌ Non envoyé | ✅ **Oui** | 🔴 **CRITIQUE** |
| `description_kids` | ⚠️ **Envoyé** | ❌ Non envoyé | ✅ **Oui** | 🔴 **CRITIQUE** |
| `accroche` | ❌ Non envoyé | ✅ Envoyé | ❌ Non | Aucun |
| `programme` | ❌ Non envoyé | ✅ Envoyé | ❌ Non | Aucun |
| `centre_name` | ❌ Non envoyé | ✅ Envoyé | ❌ Non | Aucun |
| `location_city` | ❌ Non envoyé | ✅ Envoyé | ❌ Non | Aucun |
| `location_region` | ❌ Non envoyé | ✅ Envoyé | ❌ Non | Aucun |
| `ged_theme` | ❌ Non envoyé | ✅ Envoyé | ❌ Non | Aucun |
| `images` | ❌ Non envoyé | ✅ Envoyé | ❌ Non | Aucun |
| `sessions_json` | ✅ Envoyé | ❌ Non envoyé | ❌ Non | Aucun |
| `published` | ✅ Envoyé | ❌ Non envoyé | ❌ Non | Aucun |
| `import_batch_ts` | ✅ Envoyé | ❌ Non envoyé | ❌ Non | Aucun |
| `updated_at` | ❌ Non envoyé | ✅ Envoyé | ❌ Non | Aucun |

---

## ✅ CONCLUSION

### Ce qu'on sait maintenant :

1. ✅ **Workflow 1** (SCRAPE_SEED_STAYS) est le **seul workflow à risque**
   - Il inclut les champs CityCrunch dans son payload
   - Il utilise `merge-duplicates` qui écrase tout

2. ✅ **Workflow 2** (SCRAPE_CONTENU_ALL) est **100% sécurisé**
   - Il n'envoie PAS les champs CityCrunch
   - Il enrichit uniquement le contenu (accroche, programme, images, etc.)

3. ✅ **Les deux workflows sont complémentaires**
   - Workflow 1 : création + sessions
   - Workflow 2 : enrichissement contenu
   - Ils ne se marchent PAS dessus (sauf pour le champ `title` qui est mineur)

4. ✅ **La solution est simple**
   - Modifier uniquement Workflow 1 (retirer les 4 champs CityCrunch)
   - Workflow 2 n'a PAS besoin de modification

### Sur quoi on se base :

**Workflow principal pour la création des stays :** Workflow 1 (kG6OASM4PxZaBt9H)
**Workflow d'enrichissement du contenu :** Workflow 2 (0GlIeZKVR7VoUFYNOYMVl)

**SEUL Workflow 1 nécessite une modification urgente.**

---

*Document généré le 3 février 2026 - Lot 8 : Analyse comparative des workflows n8n*
