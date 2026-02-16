# Dépannage : Connexion Supabase dans n8n

## Problème Actuel

**Erreur** : "L'autorisation a échoué. Veuillez vérifier vos identifiants : Clé API invalide"
**Statut** : Le credential Supabase a été créé avec les bonnes informations mais la connexion échoue toujours.

---

## ✅ Ce qui a été Testé

1. ✅ **Service Role Key copiée** depuis Supabase Settings → API Keys → Legacy
2. ✅ **Host URL configurée** : `https://iirfvndgzutbxwfdwawu.supabase.co`
3. ✅ **Credential créé** dans n8n avec les bonnes valeurs
4. ✅ **Bucket Storage créé** : `ged-sejours-images` (visible et accessible)
5. ✅ **Table `gd_stays` existe** avec 40 colonnes

---

## 🔍 Causes Possibles

### 1. Problème de Format de l'URL

Le node Supabase dans n8n peut attendre un format d'URL spécifique.

**À tester** :
```
# Format actuel
https://iirfvndgzutbxwfdwawu.supabase.co

# Format alternatif 1 (avec /rest/v1)
https://iirfvndgzutbxwfdwawu.supabase.co/rest/v1

# Format alternatif 2 (sans https://)
iirfvndgzutbxwfdwawu.supabase.co

# Format alternatif 3 (Project URL de Supabase)
https://iirfvndgzutbxwfdwawu.supabase.co
```

**Action** : Essayer chaque format dans n8n Credentials

---

### 2. Row Level Security (RLS) Bloque l'Accès

Supabase a peut-être RLS activé sur la table `gd_stays`, ce qui bloque l'accès même avec le Service Role Key.

**Vérification** :
```sql
-- Se connecter à Supabase via psql
psql postgresql://postgres:DBUM6aLeioZ1j9eC@db.iirfvndgzutbxwfdwawu.supabase.co:5432/postgres

-- Vérifier si RLS est activé
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'gd_stays';

-- Si rowsecurity = true, désactiver RLS temporairement
ALTER TABLE gd_stays DISABLE ROW LEVEL SECURITY;

-- Puis retester n8n
```

---

### 3. Service Role Key Tronquée ou Incorrecte

La clé JWT peut ne pas avoir été complètement copiée.

**Vérification** :
```bash
# La clé service_role doit :
# - Commencer par : eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
# - Contenir 3 parties séparées par des points : header.payload.signature
# - Faire environ 200-300 caractères

# Exemple de format correct :
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpcmZ2bmRnenV0Ynh3ZmR3YXd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzI4Njg2MCwiZXhwIjoyMDUyODYyODYwfQ.SIGNATURE_ICI
```

**Action** :
1. Retourner sur https://supabase.com/dashboard/project/iirfvndgzutbxwfdwawu/settings/api-keys/legacy
2. Cliquer sur "Révéler" pour service_role
3. Sélectionner TOUTE la clé (Ctrl+A dans le champ)
4. Copier (Ctrl+C)
5. Coller dans n8n en s'assurant qu'aucun caractère n'est coupé

---

### 4. Permissions API Supabase

Les permissions de l'API Supabase peuvent bloquer les requêtes externes.

**Vérification** :
1. Aller sur Supabase Dashboard → Settings → API
2. Vérifier que "Enable Data API" est activé
3. Vérifier que le schéma "public" est exposé
4. Vérifier qu'il n'y a pas de restriction IP

---

### 5. Version du Node Supabase

Le node Supabase dans n8n peut être obsolète ou incompatible.

**Alternative** : Utiliser le node **HTTP Request** au lieu du node Supabase

#### Configuration HTTP Request pour Supabase

**Node Configuration** :
```
Method: GET
URL: https://iirfvndgzutbxwfdwawu.supabase.co/rest/v1/gd_stays
Authentication: Generic Credential Type → Header Auth

Headers:
  apikey: [Service Role Key]
  Authorization: Bearer [Service Role Key]
  Content-Type: application/json

Query Parameters:
  published: eq.true
  limit: 5
  select: slug,marketing_title,emotion_tag,carousel_group,age_min,age_max
```

---

## 🛠️ Solution Recommandée

### Option 1 : Utiliser HTTP Request (RECOMMANDÉ)

Remplacer le node "Get Séjours depuis DB" (Supabase) par un node **HTTP Request** :

1. **Supprimer** le node Supabase actuel
2. **Ajouter** un node "HTTP Request"
3. **Configurer** :
   ```
   Method: GET
   URL: https://iirfvndgzutbxwfdwawu.supabase.co/rest/v1/gd_stays?published=eq.true&limit=5&select=slug,marketing_title,emotion_tag,carousel_group,age_min,age_max

   Authentication: Header Auth
   Header Name: apikey
   Header Value: [Service Role Key copiée depuis Supabase]

   Additional Headers:
   - Authorization: Bearer [Service Role Key]
   ```

4. **Tester** l'exécution

#### Avantages :
- ✅ Connexion directe à l'API REST Supabase
- ✅ Pas de dépendance au node Supabase de n8n
- ✅ Plus de contrôle sur les paramètres
- ✅ Debugging plus facile (on voit exactement la requête HTTP)

---

### Option 2 : Désactiver RLS sur gd_stays

Si vous voulez continuer avec le node Supabase :

```sql
-- Se connecter via psql
psql postgresql://postgres:DBUM6aLeioZ1j9eC@db.iirfvndgzutbxwfdwawu.supabase.co:5432/postgres

-- Désactiver RLS
ALTER TABLE public.gd_stays DISABLE ROW LEVEL SECURITY;

-- Vérifier
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'gd_stays';
```

Puis **retester n8n**.

---

### Option 3 : Créer une Policy Supabase pour service_role

Si RLS doit rester activé :

```sql
-- Créer une policy qui autorise service_role à tout faire
CREATE POLICY "Service role can do everything"
ON public.gd_stays
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

---

## 📊 Test de Connexion Manuelle

### Test via curl

```bash
# Tester l'API Supabase directement
curl -X GET \
  'https://iirfvndgzutbxwfdwawu.supabase.co/rest/v1/gd_stays?published=eq.true&limit=5&select=slug,marketing_title' \
  -H "apikey: [VOTRE_SERVICE_ROLE_KEY]" \
  -H "Authorization: Bearer [VOTRE_SERVICE_ROLE_KEY]"

# Si ça fonctionne, vous devriez voir du JSON avec les séjours
# Si ça échoue, le problème est dans Supabase lui-même (RLS, permissions, etc.)
```

### Test via psql

```bash
# Connexion directe à PostgreSQL
psql postgresql://postgres:DBUM6aLeioZ1j9eC@db.iirfvndgzutbxwfdwawu.supabase.co:5432/postgres

# Une fois connecté
\dt public.*
SELECT slug, marketing_title FROM gd_stays WHERE published = true LIMIT 5;

# Si ça fonctionne, la base de données est accessible
# Le problème est donc dans la configuration n8n ou l'API REST
```

---

## 🎯 Plan d'Action Immédiat

1. **[5 min]** Tester Option 1 : Remplacer par HTTP Request node
   - C'est la solution la plus rapide et fiable
   - Évite tous les problèmes de configuration du node Supabase

2. **[2 min]** Si HTTP Request fonctionne mais pas Supabase node :
   - Utiliser HTTP Request pour tous les nodes Supabase du workflow
   - Mettre à jour également les nodes Upload et Insert

3. **[10 min]** Si aucune solution ne fonctionne :
   - Tester la connexion via curl (voir ci-dessus)
   - Vérifier les logs Supabase Dashboard → Logs
   - Contacter le support Supabase si nécessaire

---

## 📝 Checklist de Dépannage

- [ ] Service Role Key complète copiée (commence par `eyJhbGci...`)
- [ ] URL testée avec différents formats
- [ ] RLS vérifié et désactivé si nécessaire
- [ ] Test curl réussi
- [ ] Test psql réussi
- [ ] HTTP Request node testé comme alternative
- [ ] Logs Supabase vérifiés

---

## 📞 Support

Si aucune solution ne fonctionne :

1. **Support Supabase** : https://supabase.com/support
2. **Forum n8n** : https://community.n8n.io/
3. **Documentation Supabase REST API** : https://supabase.com/docs/guides/api

---

**Mis à jour** : 2026-02-08
**Statut** : En attente de résolution - Utiliser HTTP Request node en priorité
