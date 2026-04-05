# Guide GEDA-5 — Veille éditoriale GED → LinkedIn/Facebook

## Architecture du workflow

```
⏰ Trigger (12h)
  → 📋 Liste 7 flux RSS (sources.md)
    → 1️⃣ Collecte RSS (n8n natif)
      → 2️⃣ Extraction contenu (Crawl4AI)
        → 3️⃣ Filtre < 30 jours
          → 3️⃣b Filtrage éditorial (themes.md)
            → 4️⃣ Rédaction LinkedIn (IA)
            → 4️⃣b Adaptation Facebook (IA)
              → 5️⃣ Sauvegarde NocoDB (validation CEO)
                → 6️⃣ Publication Postiz
```

## Test étape par étape

### Étape 1 — Importer le workflow

1. Ouvrir n8n : <https://srv1307641.hstgr.cloud>
2. Menu → Import from file → `GEDA5_VEILLE_EDITORIALE_v1.json`
3. Le workflow apparaît avec 10 noeuds, tous déconnectés des credentials

### Étape 2 — Tester la collecte RSS (noeuds 📋 + 1️⃣)

1. Cliquer sur le noeud "📋 Liste des 7 flux RSS"
2. Execute Node → doit retourner 7 items (un par flux)
3. Cliquer sur "1️⃣ Collecte RSS"
4. Execute Node → doit retourner les articles récents de chaque flux
5. **Si un flux échoue** : le retirer temporairement du noeud 📋

### Étape 3 — Tester Crawl4AI (noeud 2️⃣)

1. Vérifier que Crawl4AI tourne : `docker ps | grep crawl4ai`
2. Execute Node sur un article
3. Doit retourner le contenu texte extrait
4. **Si timeout** : augmenter le timeout ou skip les articles longs

### Étape 4 — Tester le filtrage (noeuds 3️⃣ + 3️⃣b)

1. Execute les deux noeuds
2. Vérifier que les articles exclus (grèves, paywall) sont bien filtrés
3. Vérifier que les articles pertinents passent avec `_matched_keywords`
4. **Ajuster les mots-clés** dans le noeud 3️⃣b si trop/pas assez de résultats

### Étape 5 — Configurer les credentials IA (noeud 4️⃣)

1. Dans n8n : Settings → Credentials → Add → OpenAI
2. Coller votre API key OpenAI
3. Associer le credential au noeud "4️⃣ Rédaction post LinkedIn"
4. Execute Node → doit retourner un post LinkedIn formaté
5. **Alternative** : remplacer le noeud OpenAI par Anthropic (Claude) si préféré

### Étape 6 — Configurer NocoDB (noeud 5️⃣)

1. Ouvrir NocoDB : <https://crm.srv1307641.hstgr.cloud>
2. Créer une base "GED Social"
3. Créer une table "Posts" avec colonnes :
   - `title` (texte)
   - `source` (texte)
   - `source_url` (URL)
   - `pub_date` (date)
   - `linkedin_post` (texte long)
   - `facebook_post` (texte long)
   - `status` (select : EN ATTENTE VALIDATION / VALIDÉ / PUBLIÉ / REJETÉ)
   - `matched_keywords` (texte)
   - `relevance_score` (nombre)
   - `created_at` (date)
4. Récupérer le TABLE_ID dans l'URL NocoDB
5. Settings → API Tokens → créer un token
6. Mettre à jour le noeud 5️⃣ : URL + credential xc-token

### Étape 7 — Configurer Postiz (noeud 6️⃣)

1. Ouvrir Postiz : <https://social.srv1307641.hstgr.cloud>
2. Créer un compte
3. Connecter le compte LinkedIn GED
4. Connecter le compte Facebook GED
5. Récupérer l'API key Postiz
6. Mettre à jour le noeud 6️⃣ avec l'endpoint et le credential

## Credentials à configurer (résumé)

| Noeud | Service | Type | Placeholder dans le JSON |
|---|---|---|---|
| 4️⃣ + 4️⃣b | OpenAI (ou Anthropic) | API Key | `OPENAI_CREDENTIAL_ID` |
| 5️⃣ | NocoDB | xc-token header | `NOCODB_CREDENTIAL_ID` |
| 6️⃣ | Postiz | API Key header | `POSTIZ_CREDENTIAL_ID` |

## Flux RSS intégrés (depuis sources.md)

| Source | URL |
|---|---|
| ONPE | <https://onpe.france-enfance-protegee.fr/feed/> |
| Les Pros de la Petite Enfance | <https://www.lesprosdelapetiteenfance.fr/feed> |
| Vie-publique.fr | <https://www.vie-publique.fr/actualites-feeds.xml> |
| Le Media Social | <https://www.lemediasocial.fr/rss> |
| La Gazette des Communes | <https://www.lagazettedescommunes.com/feed/> |
| Solidarités.gouv.fr | <https://solidarites.gouv.fr/rss> |
| Education.gouv.fr | <https://www.education.gouv.fr/rss> |

## Règles éditoriales embarquées (depuis themes.md)

**Inclure :** séjours, colos, vacances, PE, ASE, MECS, Pass'Colo, VACAF, CAF, financement, réforme
**Exclure :** grèves, crises, coupes budgétaires, polémique, paywall, commercial

## Validation CEO

Le workflow s'arrête au noeud 5️⃣ (NocoDB). Le CEO :
1. Ouvre NocoDB
2. Lit le post proposé
3. Change le statut à "VALIDÉ" ou "REJETÉ"
4. Un second workflow (webhook NocoDB → Postiz) publie les posts validés

Ce second workflow est volontairement séparé pour éviter toute publication automatique non validée.
