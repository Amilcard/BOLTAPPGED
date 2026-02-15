# Diagnostic Complet — Workflow n8n Images Séjours

**Date** : 2026-02-08
**Projet** : GED APP / Flooow Inklusif
**Fichier workflow corrigé** : `n8n-flooow-image-v5-fiable.json`

---

## 1. PROBLÈME ARCHITECTURAL MAJEUR DÉCOUVERT

Le frontend (stay-detail.tsx, page.tsx, stay-card.tsx) lit les images depuis **`gd_stays.images`** — un simple tableau JSON dans la table des séjours. La table `sejours_images` créée par le SQL 006 n'est connectée à RIEN côté front.

**Conséquence** : même si les workflows v2/v3/v4 fonctionnaient, aucune image n'apparaîtrait sur le site.

**Solution v5** : le workflow remplit `sejours_images` (métadonnées/tracking) PUIS synchronise automatiquement les meilleures images vers `gd_stays.images` via un PATCH REST.

---

## 2. LES 18 BUGS IDENTIFIÉS ET CORRIGÉS

### Critiques (workflow ne peut pas tourner)

| # | Bug | Workflow(s) | Correction v5 |
|---|-----|-------------|----------------|
| 1 | Bucket `flooow-sejours-images` inexistant (le vrai = `ged-sejours-images`) | v2, v3, v4 | Bucket corrigé partout |
| 2 | Chemins fichier mapping en placeholder (`/path/to/...`) | v2, v3 | Supprimé — lecture directe depuis BDD |
| 3 | `operation: executeQuery` invalide sur node Supabase n8n | v2, v3, v4 | Remplacé par HTTP Request REST API |
| 4 | Colonnes SQL inexistantes (`visual_score`, `visual_mood`, etc.) | v3 | Colonnes alignées avec schéma 006 |
| 5 | Credentials incohérents (`supabase-ged` vs `supabase-flooow`) | v2/v3 vs v4 | Un seul credential `supabase-service-role` |

### Majeurs (données incorrectes)

| # | Bug | Correction v5 |
|---|-----|----------------|
| 6 | `age_range`, `storage_path`, `public_url` jamais calculés (v4) | Tous calculés dans le normaliseur |
| 7 | `const visualScore` réassigné (v3 Pexels) → crash JS | Code réécrit proprement |
| 8 | Merge `combineAll` = produit cartésien au lieu de concaténation | Supprimé — flux linéaire Unsplash uniquement |
| 9 | Merge v3 : inputs sans index → données perdues | Supprimé |
| 10 | Injection SQL via interpolation directe | REST API JSON — plus de SQL brut |

### Modérés (risques fonctionnels)

| # | Bug | Correction v5 |
|---|-----|----------------|
| 11 | download_url Unsplash sans `client_id` → 401 | `client_id` ajouté au download |
| 12 | Propriété binaire non spécifiée (v4) | `outputPropertyName: "image_data"` explicite |
| 13 | Paramètres vides envoyés à Unsplash (v3) | Supprimés |
| 14 | Nom query param Unsplash non vérifié | Credential nommé `client_id` explicitement |

### Incohérences

| # | Bug | Correction v5 |
|---|-----|----------------|
| 15 | 24 séjours mapping vs LIMIT 5 | LIMIT 30 pour couvrir tous les séjours |
| 16 | Check d'existence filtre `source='unsplash'` en dur | Filtre dynamique par source |
| 17 | Mapping dit 24 séjours mais n'en contient que 22 | Non bloquant |
| 18 | `public_url` jamais construite | Construite : `https://...supabase.co/storage/v1/object/public/ged-sejours-images/{path}` |

---

## 3. CRITÈRES DE SÉLECTION DURCIS

### Problème : images non conformes au projet

Les mots-clés actuels ("motocross mud action", "surfer silhouette sunset") sont **trop génériques** et ramènent :
- Des photos américaines (Arizona, Californie)
- Des images catalogue/stock posées
- Des photos superficielles sans rapport avec la France
- Des visages reconnaissables (non RGPD)

### Solution : 6 filtres durcis dans le normaliseur v5

**Filtre 1 — Dimensions** : min 1200×800px

**Filtre 2 — Ratio paysage** : entre 1.3:1 et 2.1:1 (rejet des portraits et carrés)

**Filtre 3 — Anti-stock / Anti-catalogue** : blacklist de 15 termes
- `group posing`, `team building`, `corporate`, `stock photo`, `staged`
- `classroom`, `cafeteria`, `indoor office`, `smiling camera`
- `thumbs up`, `business meeting`, `presentation slide`
- `woman laptop`, `man suit`, `handshake`

**Filtre 4 — Anti-superficiel** : rejet des patterns trop génériques
- `beautiful woman`, `handsome man`, `happy people`
- `business`, `office`, `laptop`, `desk`
- `abstract`, `background texture plain`

**Filtre 5 — Score qualité 1-10** avec bonus/malus :
- Base : 5
- +1 si likes > 50, +1 si likes > 200, +1 si likes > 500
- +1 si ratio proche 16:9 (cinématographique)
- **+2 si description contient un terme géographique France** (france, alps, french, bretagne, corsica, provence, atlantic, mediterranean)
- -2 si "group of people", -1 si "smiling"

**Filtre 6 — Score minimum** : rejet si qualité < 4/10

### Mots-clés ancrés France

Chaque emotion_tag a 3 mots-clés incluant un ancrage géographique France :

| Emotion | Exemple mot-clé |
|---------|----------------|
| MÉCANIQUE | `motocross mud france enduro` |
| AÉRIEN | `paragliding french alps lake annecy` |
| GLISSE | `surfer silhouette sunset atlantic france` |
| PASSION | `horse riding beach sunset brittany france` |
| NATURE | `dune pilat arcachon basin france` |
| SURVIE | `camping bonfire forest france night` |
| DOUCEUR | `child back view forest sunlight gentle` |
| AVENTURE | `corsica turquoise coast aerial drone` |

20 emotion_tags couverts avec 60 mots-clés au total.

---

## 4. CONFIGURATION N8N — 2 CREDENTIALS À CRÉER

### Credential 1 : Supabase Service Role

```
Type : Header Auth
Nom : Supabase Service Role
ID : supabase-service-role

Header Name : Authorization
Header Value : Bearer eyJhbGciOiJIUzI1NiI... (votre service_role key complète)
```

**Où trouver la clé** : https://supabase.com/dashboard/project/iirfvndgzutbxwfdwawu/settings/api → Service Role Key → Révéler

### Credential 2 : Unsplash client_id

```
Type : Query Auth
Nom : Unsplash client_id
ID : unsplash-client-id

Query Parameter Name : client_id
Query Parameter Value : (votre Access Key Unsplash)
```

**Où trouver la clé** : https://unsplash.com/oauth/applications → votre app → Access Key

---

## 5. IMPORT DU WORKFLOW

1. Ouvrir n8n
2. Menu → Import from File
3. Sélectionner `n8n-flooow-image-v5-fiable.json`
4. Configurer les 2 credentials ci-dessus
5. Exécuter manuellement pour tester
6. Activer le schedule une fois validé

---

## 6. VÉRIFICATION POST-IMPORT

### Test 1 : GET Séjours
- Exécuter le premier nœud seul
- Vérifier qu'il retourne les séjours avec `slug`, `emotion_tag`, `carousel_group`

### Test 2 : Unsplash Search
- Vérifier que les résultats contiennent des images pertinentes
- Vérifier que le credential `client_id` fonctionne

### Test 3 : Upload Storage
- Vérifier dans Supabase Dashboard → Storage → `ged-sejours-images`
- Les dossiers `ADRENALINE_SENSATIONS/moto-moto/` etc. doivent apparaître

### Test 4 : Sync gd_stays
- Vérifier que `gd_stays.images` est mis à jour
- Ouvrir le site et vérifier que les images apparaissent

---

## 7. ARCHITECTURE V5 — FLUX DE DONNÉES

```
Schedule Hebdo (dimanche 3h)
    │
    ▼
GET Séjours (REST API → gd_stays)
    │
    ▼
Mots-clés France Durcis (Code node — 20 emotions × 3 keywords)
    │
    ▼
Unsplash Search (HTTP Request avec client_id)
    │
    ▼
Normaliser + 6 Filtres Durcis (anti-stock, France, qualité)
    │
    ▼
Vérifier Doublon (REST API → sejours_images)
    │
    ▼
Garder Nouveaux (IF vide)
    │
    ▼
Télécharger Image (avec client_id Unsplash)
    │
    ▼
Upload Storage REST (bucket: ged-sejours-images)
    │
    ▼
INSERT Métadonnées REST (→ sejours_images)
    │
    ▼
Préparer Sync (top 6 images/séjour par qualité)
    │
    ▼
SYNC → gd_stays.images (PATCH REST)   ← LE PONT MANQUANT
    │
    ▼
Statistiques + Log
```
