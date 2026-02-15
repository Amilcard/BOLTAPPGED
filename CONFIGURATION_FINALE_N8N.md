# Configuration Finale - Workflow n8n GED Images

## ✅ Éléments Déjà Configurés

### Infrastructure Supabase
- ✅ **Base de données** : Table `gd_stays` (40 colonnes) existe et contient les séjours
- ✅ **Storage** : Bucket `ged-sejours-images` créé (public)
- ✅ **Credentials** : Host et Service Role Key enregistrés dans n8n

### Workflow n8n
- ✅ **Workflow importé** : "Mon flux de travail" avec 10 nœuds
- ✅ **Nœuds configurés** :
  - Schedule Hebdo (trigger chaque dimanche à 3h)
  - Get Séjours depuis DB (operation: Get Many)
  - Préparer Mots-clés (Code node avec mapping émotions)
  - Tous les autres nœuds de traitement d'images

---

## ⚠️ Configuration à Finaliser

### 1. Corriger le Credential Supabase

**Problème actuel** : La connexion Supabase échoue avec "Could not connect with these settings"

**Solution** :
1. Dans n8n, aller dans **Credentials** (menu gauche)
2. Trouver "Compte Supabase"
3. Vérifier les paramètres :

```
Host : https://iirfvndgzutbxwfdwawu.supabase.co
Service Role Key : [À récupérer depuis Supabase]
```

**Pour obtenir la vraie Service Role Key** :
1. Aller sur https://supabase.com/dashboard/project/iirfvndgzutbxwfdwawu/settings/api
2. Cliquer sur l'onglet **"Clés API héritage anonyme, service_role"**
3. Cliquer sur le bouton **"Révéler"** à côté de "service_role"
4. Copier la clé complète (commence par `eyJhbGciOiJIUzI1NiI...`)
5. Retourner dans n8n Credentials et remplacer la clé
6. Cliquer **"Save"** puis **"Test"** pour vérifier la connexion

---

### 2. Configurer le Credential Unsplash API

Le nœud "Unsplash" nécessite une API key Unsplash.

**Étapes** :
1. Créer un compte sur https://unsplash.com/developers
2. Créer une nouvelle application
3. Copier l'**Access Key** (client_id)
4. Dans n8n, créer un nouveau credential **"HTTP Query Auth"** :
   - Name: `Unsplash`
   - Query Parameter Name: `client_id`
   - Query Parameter Value: `[Votre Access Key]`
5. Sauvegarder
6. Dans le nœud "Unsplash", sélectionner ce credential

---

### 3. Mettre à Jour les Nœuds Upload/Storage

Les nœuds qui utilisent Supabase Storage doivent pointer vers le bon bucket.

**Nœuds à vérifier** :
- "Upload Supabase" (nœud 9)
- "Insert DB" (nœud 10)

**Configuration du nœud Upload** :
```
Operation: upload
Bucket Name: ged-sejours-images
File Name: ={{ $json.carousel_group }}/{{ $json.slug }}/{{ $json.source }}_{{ $json.source_id }}.jpg
Binary Data: true
```

---

### 4. Finaliser le Nœud "Get Séjours depuis DB"

**Configuration actuelle** :
- Operation: Get Many
- Table: gd_stays
- Limite: 5
- Filtre: published = true

**À vérifier** :
1. Ouvrir le nœud "Get Séjours depuis DB"
2. Dans "Nom ou ID de la table", taper manuellement : `gd_stays`
3. S'assurer que Limite = 5
4. Dans Filtres :
   - Nom du champ : `published`
   - Condition : Égales (=)
   - Valeur : `true`

**Note** : Le message "Error fetching options from Supabase" disparaîtra une fois le credential Supabase corrigé.

---

## 🧪 Tests à Effectuer

### Test 1 : Connexion Supabase
```bash
# Via psql (sur votre machine locale)
psql postgresql://postgres:DBUM6aLeioZ1j9eC@db.iirfvndgzutbxwfdwawu.supabase.co:5432/postgres

# Vérifier les séjours
SELECT slug, marketing_title, emotion_tag FROM gd_stays WHERE published = true LIMIT 5;
```

### Test 2 : Workflow n8n
1. Ouvrir le workflow dans n8n
2. Cliquer sur **"Execute workflow"** (bouton orange)
3. Observer les résultats dans chaque nœud
4. Vérifier que :
   - Le nœud "Get Séjours" retourne 5 séjours
   - Le nœud "Préparer Mots-clés" génère les keywords
   - Le nœud "Unsplash" retourne des images
   - Les images sont uploadées dans Storage

### Test 3 : Vérifier Storage
1. Aller sur https://supabase.com/dashboard/project/iirfvndgzutbxwfdwawu/storage/files
2. Ouvrir le bucket `ged-sejours-images`
3. Vérifier la structure des dossiers :
```
ged-sejours-images/
  ├── ADRENALINE_SENSATIONS/
  │   ├── moto-moto/
  │   └── quad-quad/
  ├── ALTITUDE_AVENTURE/
  └── OCEAN_FUN/
```

---

## 📋 Checklist Finale

- [ ] Credential Supabase : connexion OK
- [ ] Credential Unsplash : API key configurée
- [ ] Nœud "Get Séjours" : retourne 5 séjours
- [ ] Nœud "Unsplash" : retourne des images
- [ ] Bucket Storage : images uploadées correctement
- [ ] Table `sejours_images` : lignes insérées
- [ ] Workflow : exécution complète sans erreur

---

## 🔧 Dépannage

### Erreur : "Could not connect with these settings"
➜ Vérifier que le Service Role Key est correct (JWT token complet)

### Erreur : "Error fetching options from Supabase"
➜ Le credential Supabase n'est pas valide, voir section 1

### Erreur : "Unauthorized" sur Unsplash
➜ Vérifier l'API key Unsplash

### Erreur : "Bucket not found"
➜ Vérifier que le bucket `ged-sejours-images` existe et est public

### Aucune image uploadée
➜ Vérifier que les séjours dans `gd_stays` ont bien les colonnes :
   - `slug` (VARCHAR)
   - `marketing_title` (VARCHAR)
   - `emotion_tag` (VARCHAR - valeurs: MÉCANIQUE, AÉRIEN, SURVIE, etc.)
   - `carousel_group` (VARCHAR)
   - `published` (BOOLEAN = true)

---

## 📚 Resources

- **Documentation n8n** : https://docs.n8n.io/
- **API Unsplash** : https://unsplash.com/documentation
- **API Supabase** : https://supabase.com/docs/guides/api
- **Workflow JSON source** : `/sessions/eloquent-brave-maxwell/mnt/GED_APP/n8n-flooow-simple-v4.json`

---

## 🎯 Prochaines Étapes (Après Config)

1. **Installer les scripts SQL** :
   ```bash
   cd /sessions/eloquent-brave-maxwell/mnt/GED_APP
   chmod +x install_ged_complete.sh
   ./install_ged_complete.sh
   ```

2. **Activer le Schedule** :
   - Dans n8n, activer le workflow pour qu'il s'exécute automatiquement chaque dimanche

3. **Monitoring** :
   - Vérifier les logs d'exécution dans n8n (onglet "Executions")
   - Surveiller le nombre d'images collectées

4. **Optimisation** :
   - Augmenter la limite de 5 à 24 séjours (après tests)
   - Ajuster les mots-clés de recherche si nécessaire
   - Configurer les règles de qualité visuelle

---

**Date de création** : 2026-02-08
**Projet** : GED (Groupe et Découverte) - Collecte automatique d'images pour séjours
