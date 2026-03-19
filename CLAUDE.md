# CLAUDE.md — GED_APP / Groupe & Découverte

Ce fichier est lu automatiquement par Claude Code à chaque session.

## Projet

- **Nom** : GED_APP / Groupe & Découverte
- **Repo** : https://github.com/Amilcard/BOLTAPPGED
- **App** : app.groupeetdecouverte.fr
- **Stack** : Next.js 14, Supabase, Tailwind CSS, Stripe
- **Répertoire local** : `/Users/laidhamoudi/Dev/GED_APP`

## Règle de travail — OBLIGATOIRE

**Branche unique : `main`**

```bash
# Début de chaque session — TOUJOURS
git checkout main
git pull origin main

# Fin de session — pousser sur main directement
git push origin main
```

Ne pas créer de branches, ne pas ouvrir de PR, ne pas utiliser `work` ou toute autre branche.
Vercel déploie automatiquement depuis `main`.

## Règle avant chaque push

Vérifier qu'il n'y a pas d'erreur TypeScript avant de pousser :
```bash
# Si node_modules présent :
npx tsc --noEmit

# Sinon, l'erreur apparaîtra dans GitHub Actions après le push.
```

Éviter les variables utilisées avant leur déclaration (TDZ) — erreur fréquente.

## Périmètre de travail

- Travailler UNIQUEMENT sur GED_APP dans ce répertoire.
- Ne pas confondre avec d'autres projets (Flooow, InKlusif, etc.).
- Ne pas modifier les fichiers hors du repo (`groupe-et-decouverte/`, etc.).

## Architecture clé

- **Mode kids** : parcours enfants — wishlist, souhaits, séjours
- **Mode pro** : parcours référents/travailleurs sociaux — inscription, paiement, suivi
- **Admin** : `/admin/*` — gestion demandes, séjours, sessions, utilisateurs, propositions
- **Images** : Supabase Storage — domaine `iirfvndgzutbxwfdwawu.supabase.co`
- **Paiement** : Stripe (CB) + virement + chèque
- **Auth admin** : JWT via cookie `gd_session` + `verifyAuth` sur chaque route API

## Règles de correction

- Diff minimal — ne toucher qu'aux fichiers strictement nécessaires
- Pas de refactor large sans demande explicite
- Pas d'effet cascade
- Non-régression prioritaire
- Commit + push uniquement si le fix est sûr
