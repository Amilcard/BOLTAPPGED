# Patch n8n : Détection des séjours complets (is_full)

## Pattern HTML UFOVAL identifié

Sur les pages séjour UFOVAL, les sessions sont listées dans un bloc `<div class="form-group availability">`.

- **Session disponible** : `<label class="">` (pas de classe spéciale)
- **Session complète (grisée)** : `<label class="availability-status-full">` contient `<div class="tag small tag-danger">Complet</div>`

Exemple réel (DH Experience 11-13 ans) :
- 6 sessions total, 2 complètes (12-18 juil, 2-8 août), 4 ouvertes

## Logique is_full

- **gd_stays.is_full** = `true` dès qu'au moins 1 session a la classe `availability-status-full`
- **gd_stay_sessions.is_full** = `true` pour chaque session individuelle complète (à implémenter dans un second workflow dédié)

## Détection dans le noeud "Extract Contenu"

```javascript
const fullSessions = (htmlStr.match(/availability-status-full/gi) || []).length;
result.is_full = fullSessions > 0;
result.full_sessions_count = fullSessions;
```

## Fichiers à déployer

1. **SQL** : `sql/003_add_is_full_column.sql` → exécuter dans Supabase SQL Editor
2. **n8n** : `n8n-patches/GED_UFOVAL_SCRAPE_CONTENU_ALL_v2_is_full.json` → importer dans n8n
3. **Front** : déjà en place (badge carte + bannière détail)
