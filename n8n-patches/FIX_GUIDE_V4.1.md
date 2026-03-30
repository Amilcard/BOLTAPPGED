# Guide Fix v4.1 — Workflow "01 UFOVAL is_full SESSIONS v4"

## Diagnostic

Le workflow tourne vert mais ne met PAS a jour `gd_session_prices.is_full` car :

1. **Le Manual Trigger lance le mauvais flow** (Flow 1 = gd_stays, pas gd_session_prices)
2. **Les erreurs POST AJAX sont avalees** (`catch(e) { // Skip silencieusement }`)
3. **Pas de RESET global** — les anciens `is_full=true` restent indefiniment

---

## FIX 1 : Remplacer le code du noeud "Scrape Toutes Sessions UFOVAL"

1. Ouvrir n8n > Workflow "01 UFOVAL is_full SESSIONS v4" (ID: xkRGhkq8Ada0QMlJHx_F3)
2. Double-cliquer le noeud **"Scrape Toutes Sessions UFOVAL"**
3. Remplacer TOUT le code par le contenu de `FIX_SCRAPE_V4_CORRIGE.js`
4. Sauvegarder

**Ce qui change** :
- `catch(e)` → log l'erreur dans `errors[]` (visible dans Summary1)
- Ajout `debug {}` par sejour (hasCookies, hasFormAction, hasCsrfToken, durations)
- Ajout `_summary` en dernier item (totalSejours, totalSessionsFound, sejoursWithErrors)
- Aucun changement sur le parsing ou la logique de detection is_full

---

## FIX 2 : Ajouter un noeud RESET avant PATCH

### Pourquoi ?
Si le scraping ne trouve aucune session pour un sejour (erreur silencieuse), les anciens `is_full=true` restent.

### Comment :
1. Ajouter un noeud **HTTP Request** entre "Flatten Sessions" et "Filter Valid Sessions"
2. Nom : `RESET is_full=false`
3. Config :
   - Method: PATCH
   - URL: `https://iirfvndgzutbxwfdwawu.supabase.co/rest/v1/gd_session_prices?is_full=eq.true`
   - Headers:
     - apikey: `[votre service_role key]`
     - Authorization: `Bearer [votre service_role key]`
     - Content-Type: `application/json`
     - Prefer: `return=minimal`
   - Body: `{"is_full": false}`
4. **Ce noeud doit s'executer UNE SEULE FOIS** (pas en boucle). Placer AVANT le Flatten ou utiliser un noeud "Execute Once".

**Alternative plus simple** : Ajouter au debut du noeud "Scrape Toutes Sessions UFOVAL" (apres `const output = [];`) :

```javascript
// RESET: mettre tous les is_full a false AVANT de scraper
try {
  await this.helpers.httpRequest({
    method: 'PATCH',
    url: 'https://iirfvndgzutbxwfdwawu.supabase.co/rest/v1/gd_session_prices?is_full=eq.true',
    headers: {
      'apikey': '[SERVICE_ROLE_KEY]',
      'Authorization': 'Bearer [SERVICE_ROLE_KEY]',
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: { is_full: false },
    json: true
  });
} catch (e) {
  // Log mais ne pas bloquer
}
```

---

## FIX 3 : Ajouter Manual Trigger au Flow 2

1. Dans le workflow, ajouter un noeud **"Manual Trigger"** (ou renommer l'existant)
2. Connecter sa sortie au noeud **"Get Sejours publies"** (meme entree que "Toutes les 6h")
3. Maintenant quand tu cliques "Executer", les DEUX triggers se lancent et le Flow 2 tourne

---

## Test apres fix

1. Avant le test, noter l'etat actuel :
```bash
curl -s "https://iirfvndgzutbxwfdwawu.supabase.co/rest/v1/gd_session_prices?is_full=eq.true&select=stay_slug,start_date,end_date,is_full" \
  -H "apikey: [KEY]" -H "Authorization: Bearer [KEY]"
```

2. Executer le workflow manuellement via n8n UI

3. Verifier :
   - Summary1 affiche `totalSessionsFound > 0`
   - `sejoursWithErrors` est vide ou minimal
   - Les `is_full=true` stales ont ete resetes

4. Re-verifier la BDD :
```bash
curl -s "https://iirfvndgzutbxwfdwawu.supabase.co/rest/v1/gd_session_prices?is_full=eq.true&select=stay_slug,start_date,end_date,is_full" \
  -H "apikey: [KEY]" -H "Authorization: Bearer [KEY]"
```

---

## Fichiers

- `FIX_SCRAPE_V4_CORRIGE.js` — Code JS corrige a coller dans n8n
- `code_Scrape_BACKUP.js` — Backup du code original (sur VPS: /tmp/)
- `wf_is_full_v4.json` — Export du workflow complet (sur VPS: /tmp/)
