# Workflow n8n : Sync is_full par session depuis UFOVAL

## Objectif

Scraper automatiquement le site UFOVAL pour détecter quelles **sessions individuelles** sont complètes ("Complet") et mettre à jour `gd_session_prices.is_full` dans Supabase.

**Différence avec le workflow existant** : Le workflow `GED_UFOVAL_SCRAPE_CONTENU_ALL_v2_is_full` ne met à jour que `gd_stays.is_full` (global). Ce nouveau workflow met à jour **chaque session** dans `gd_session_prices`.

---

## SECURITE CONTENUS CITYCRUNCH

### Workflows SAFE (ne touchent PAS aux contenus)

| Workflow | Cible | Champs PATCH | Safe ? |
|----------|-------|--------------|--------|
| `GED_UFOVAL_SESSION_IS_FULL_v1.json` | `gd_session_prices` | `is_full` uniquement | OUI |
| `GED_UFOVAL_SCRAPE_CONTENU_ALL_v3_SAFE.json` | `gd_stays` | `is_full`, `updated_at` uniquement | OUI |

### Workflow DANGEREUX (ECRASE les contenus CityCrunch)

| Workflow | Cible | Champs PATCH | Safe ? |
|----------|-------|--------------|--------|
| `GED_UFOVAL_SCRAPE_CONTENU_ALL_v2_is_full.json` | `gd_stays` | `title`, `accroche`, `programme`, `images`, `centre_name`, `location_city`, `location_region`, `ged_theme`, `is_full` | **NON** |

**NE JAMAIS activer ni executer manuellement le workflow v2** sauf si vous voulez volontairement ecraser vos contenus CityCrunch par les contenus bruts UFOVAL.

**Remplacement recommande** : Supprimer `v2_is_full` de n8n et utiliser `v3_SAFE` a la place.

---

## Architecture du workflow principal (SESSION_IS_FULL_v4)

```
Trigger (6h / Manuel)
  → Get Séjours publiés (Supabase REST)
    → Scrape Toutes Sessions UFOVAL (Code node v4)
      Pour chaque séjour:
        1. GET page UFOVAL (source_url) avec returnFullResponse
           → Capturer les cookies (PHPSESSID)
        2. Extraire: form action, CSRF token, durées disponibles
        3. Sessions de la durée par défaut (dans le HTML GET)
        4. Pour chaque autre durée (7j, 14j, 21j):
           - POST AJAX avec cookies de session
           - Parser le HTML retourné pour les sessions complètes
           - Convertir les dates françaises en ISO (YYYY-MM-DD)
        5. Retourner toutes les sessions avec is_full
      → Flatten Sessions (1 item par session)
        → Filter Valid Sessions
          → PATCH gd_session_prices.is_full (Supabase REST)
            → Summary
```

### Decouverte critique : Cookie PHPSESSID requis

Le POST AJAX d'UFOVAL retourne **404 sans cookie de session**. Le workflow v4 resout cela :

1. GET avec `returnFullResponse: true` + `json: false`
2. Extraction du `Set-Cookie` header → PHPSESSID
3. Renvoi du cookie dans le header `Cookie` de chaque POST

## Mecanisme UFOVAL

Le site UFOVAL utilise un mecanisme AJAX pour afficher les sessions par duree :

1. **Page initiale** (GET) : contient les sessions de la **duree par defaut** (6 jours)
2. **Formulaire cache** : `<form action="/fr/stay/{ufovalId}/update-availabilities-cart-form">`
3. **Token CSRF** : `<input name="stay_duration[_token]" value="...">`
4. **Durees** : `<select id="stay_duration_duration">` avec options 6/7/14/21 jours
5. **POST AJAX** : Envoyer `stay_duration[duration]=14` + token + `X-Requested-With: XMLHttpRequest` + **Cookie PHPSESSID**
6. **Reponse JSON** : `{ "html": "<form>...</form>" }` (n8n auto-parse en objet)

### Format des sessions dans le HTML

```html
<!-- Session disponible -->
<label class="" for="cart_step_availability_availability_1370">
  <div class="date-range">
    <div class="week-day">dimanche</div>
    <div class="date h6">5 juil.</div>
  </div>
  au
  <div class="date-range">
    <div class="week-day">samedi</div>
    <div class="date h6">11 juil.</div>
  </div>
</label>

<!-- Session complete -->
<label class="availability-status-full" for="...">
  <div class="date-range">...</div>
  <div class="tag small tag-danger">Complet</div>
</label>
```

### Parsing v4 (robuste + cookies)

L'approche v4 utilise :
- **NFD normalize** : `text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')` pour gerer les accents (aout)
- **Strip HTML** : `label.replace(/<[^>]*>/g, ' ')` pour parser le texte brut
- **Recherche "au"** : Filtre les `<label>` contenant ` au `
- **Prefix 4-char** : `match[2].substring(0, 4)` pour matcher les mois francais
- **Cookie forwarding** : GET `returnFullResponse` → extraire `Set-Cookie` → envoyer `Cookie` sur POST
- **Auto-parse JSON** : n8n parse automatiquement la reponse JSON du POST en objet

### Conversion dates francaises → ISO

| UFOVAL | ISO |
|--------|-----|
| "dimanche 5 juil. au samedi 18 juil." | 2026-07-05 → 2026-07-18 |
| "dimanche 2 aout au samedi 8 aout" | 2026-08-02 → 2026-08-08 |

## Fichiers

| Fichier | Usage | Safe contenus ? |
|---------|-------|-----------------|
| `GED_UFOVAL_SESSION_IS_FULL_v1.json` | Workflow principal v4 (par session, cookies) | OUI |
| `GED_UFOVAL_SESSION_IS_FULL_DEBUG.json` | Debug v4 (1 sejour, logs detailles) | OUI |
| `GED_UFOVAL_SCRAPE_CONTENU_ALL_v3_SAFE.json` | is_full global sur gd_stays (SAFE) | OUI |
| `GED_UFOVAL_SCRAPE_CONTENU_ALL_v2_is_full.json` | ANCIEN - ECRASE les contenus CityCrunch | **NON** |

## Deploiement

### Prerequis
- `gd_session_prices.is_full` doit exister (SQL `003_add_is_full_column.sql` deja execute)
- Les sejours publies doivent avoir un `source_url` valide pointant vers ufoval.fol74.org

### Etape 1 : Tester avec le workflow DEBUG

**Objectif** : Verifier que les cookies + POST fonctionnent sur le VPS.

1. Importer `GED_UFOVAL_SESSION_IS_FULL_DEBUG.json` dans n8n
2. Cliquer sur "Manual Trigger" → Executer
3. Verifier la sortie :
   - DIAG 1 : GET OK, cookies extraits, formAction trouve, token trouve
   - DIAG 2 : POST OK, sessionsFound >= 1

### Etape 2 : Deployer le workflow principal

1. Importer `GED_UFOVAL_SESSION_IS_FULL_v1.json` dans n8n
2. Verifier que les credentials Supabase sont corrects
3. Tester avec "Manual Trigger"
4. Verifier le noeud "Summary" → doit afficher le nombre de sessions mises a jour
5. Si OK, activer le trigger "Toutes les 6h"

### Etape 3 : Remplacer l'ancien workflow contenus

1. **DESACTIVER** `GED_UFOVAL_SCRAPE_CONTENU_ALL_v2_is_full` dans n8n
2. Importer `GED_UFOVAL_SCRAPE_CONTENU_ALL_v3_SAFE.json` a la place
3. Ce workflow ne met a jour QUE `is_full` + `updated_at` sur `gd_stays`
4. Vos contenus CityCrunch (titre, accroche, programme, images) ne seront JAMAIS ecrases

### Test rapide
1. Lancer le workflow manuellement
2. Verifier le noeud "Summary" → nombre de sessions mises a jour > 0
3. Verifier dans Supabase : `SELECT * FROM gd_session_prices WHERE is_full = true`
4. Verifier l'app : les sessions marquees completes doivent s'afficher correctement

## Summary node (v4)

Le noeud Summary gere le format de sortie de n8n correctement :
- n8n **deplie** les arrays retournes par le PATCH Supabase
- Chaque `item.json` est soit un objet `{stay_slug, is_full, ...}` (session mise a jour), soit un objet vide `{}` (pas de correspondance en BDD)
- Le Summary compte `stay_slug` pour les mises a jour et `Object.keys(data).length === 0` pour les non-matches

## Correction du workflow existant (is_full global)

Le fichier `GED_UFOVAL_SCRAPE_CONTENU_ALL_v2_is_full.json` a ete corrige :
- **Avant** : `is_full = fullSessions > 0` (au moins 1 session complete → sejour marque complet)
- **Apres** : `is_full = (totalSessions > 0 && totalSessions === fullSessions)` (TOUTES les sessions doivent etre completes)
- **Compteur** : change de `form-group availability` (1 seul match) a `radio-container` (correct, 1 par session)

**ATTENTION** : Ce workflow v2 ecrase AUSSI les contenus (title, accroche, programme, images). Utiliser v3_SAFE a la place.

## Limites connues

1. **Sessions manquantes en BDD** : Certaines sessions UFOVAL n'existent pas dans `gd_session_prices` car elles n'ont jamais ete importees. Le PATCH retournera un objet vide pour ces sessions.

2. **CSRF token** : Le token est reutilisable pour toutes les durees d'un meme sejour dans une meme session HTTP.

3. **Delais** : 500ms entre chaque POST de duree, 1s entre chaque sejour. Pour 24 sejours x 4 durees = ~2min d'execution.

4. **Pas de Browserless necessaire** : L'approche POST AJAX pure fonctionne sans navigateur headless.

5. **Cookie PHPSESSID** : Expire apres ~30min d'inactivite cote serveur. Le workflow fait un GET frais par sejour, donc le cookie est toujours valide.
