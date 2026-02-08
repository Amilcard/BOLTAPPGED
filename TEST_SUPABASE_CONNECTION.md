# Test de Connexion Supabase - Résolution du Problème

## Situation Actuelle

Le nœud HTTP Request dans n8n a été configuré avec :
- URL : `https://iirfvndgzutbxwfdwawu.supabase.co/rest/v1/gd_stays?published=eq.true&limit=5&select=slug,marketing_title,emotion_tag,carousel_group,age_min,age_max`
- Headers ajoutés manuellement :
  - `apikey: [Service Role Key]`
  - `Authorization: Bearer [Service Role Key]`

**Erreur reçue** : "Clé API invalide"

## Action Immédiate Requise

Pour résoudre définitivement ce problème, vous devez :

### Étape 1 : Récupérer la Vraie Service Role Key

1. Allez sur https://supabase.com/dashboard/project/iirfvndgzutbxwfdwawu/settings/api-keys/legacy
2. Cliquez sur "Révéler" pour la clé `service_role`
3. Sélectionnez TOUTE la clé (triple-clic dans le champ)
4. Copiez-la (Ctrl+C)

### Étape 2 : Mise à Jour dans n8n

1. Dans n8n, ouvrez le nœud "Requête HTTP"
2. Scrollez jusqu'à la section "En-têtes"
3. Pour le header **apikey** :
   - Cliquez dans le champ "Valeur"
   - Sélectionnez tout (Ctrl+A)
   - Collez la Service Role Key (Ctrl+V)
4. Pour le header **Authorization** :
   - Cliquez dans le champ "Valeur"
   - Sélectionnez tout (Ctrl+A)
   - Tapez `Bearer ` (avec un espace)
   - Collez ensuite la Service Role Key

### Étape 3 : Test

1. Cliquez sur "Exécuter l'étape"
2. Vous devriez voir 5 séjours retournés dans le panneau de droite

## Alternative : Modifier le Credential Supabase Original

Si vous préférez continuer avec le nœud Supabase original au lieu de HTTP Request :

1. Allez dans **Credentials** (menu gauche dans n8n)
2. Trouvez "Compte Supabase"
3. Cliquez sur "Modifier"
4. Dans le champ "Service Role Key", collez la vraie clé récupérée depuis Supabase
5. Cliquez "Enregistrer"
6. Retournez au workflow et reconnectez le nœud Supabase d'origine
7. Testez l'exécution

## Vérification que la Connexion Fonctionne

Une fois la clé correcte configurée, vous devriez voir dans le panneau "SORTIR" :
```json
[
  {
    "slug": "exemple-sejour",
    "marketing_title": "Titre du Séjour",
    "emotion_tag": "MECANIQUE",
    "carousel_group": "ADRENALINE_SENSATIONS",
    "age_min": 8,
    "age_max": 14
  },
  ...
]
```

## Prochaines Étapes Après Résolution

1. ✅ Nœud HTTP Request fonctionnel avec les séjours Supabase
2. Connecter ce nœud au reste du workflow (nœud "Préparer Mots-clés")
3. Configurer le credential Unsplash API
4. Tester l'exécution complète du workflow
5. Vérifier que les images sont uploadées dans le bucket Storage

---

**Note Importante** : La Service Role Key est sensible et contourne toutes les règles RLS de Supabase. Ne la partagez jamais publiquement et ne la commitez pas dans Git.

**Créé le** : 2026-02-08
**Projet** : GED - Workflow n8n collecte d'images automatique
