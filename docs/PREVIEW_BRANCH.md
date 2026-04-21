# Preview Branch — Workflow QA Thanh / E2E

## Objectif

Tester les changements UX/fonctionnels **sans toucher la prod**, sur une URL Vercel preview branchée à une DB Supabase isolée (seed synthétique, zéro PII).

## Principe — branch éphémère pay-per-use

- Coût Supabase branch : **$0.01344/h** (~$0.32/jour si laissée 24/7)
- Créée AVANT une session de test → détruite APRÈS
- Usage typique : 4 sessions × 3h/mois → **~$0.16/mois**

## Lifecycle (3 étapes)

### 1. Créer la preview (avant session test)

```bash
./scripts/preview/create-branch.sh preview-thanh-avril
```

Ce script :
- Crée une Supabase branch `preview-thanh-avril` (DB isolée, URL/clés nouvelles)
- Applique `supabase/seed/preview.sql` (3 séjours fictifs + 1 structure test)
- Scope les env vars Vercel (`NEXT_PUBLIC_SUPABASE_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`) sur la git branch `preview/preview-thanh-avril`

Ensuite :

```bash
git checkout -b preview/preview-thanh-avril
git push origin preview/preview-thanh-avril
```

Vercel déploie une preview URL automatique → à envoyer à Thanh.

### 2. Thanh teste

Elle utilise la preview URL comme si c'était la prod. Les inscriptions, paiements (Stripe test mode), emails → tout part dans la branch, **jamais la prod**.

### 3. Détruire (après session test)

```bash
./scripts/preview/destroy-branch.sh preview-thanh-avril
git push origin --delete preview/preview-thanh-avril
git branch -D preview/preview-thanh-avril
```

Coût stoppé. Env vars nettoyées.

## Prérequis installés

- `supabase` CLI : `npm i -g supabase`
- `vercel` CLI : `npm i -g vercel`
- `jq` (parsing JSON)
- `psql` (seed SQL)
- `SUPABASE_ACCESS_TOKEN` exporté (cf. https://supabase.com/dashboard/account/tokens)
- `VERCEL_TOKEN` exporté (cf. https://vercel.com/account/tokens)

## Garde-fous anti-oubli

Une branch laissée active = $9.67/mois. Règles :

1. **Règle nommage** : toute branch preview contient une date (`preview-thanh-2026-04-21`) → visible dans `supabase branches list`.
2. **Check hebdo** : `supabase branches list --project-ref iirfvndgzutbxwfdwawu` le lundi → détruire les orphelines.
3. **Cron auto** (TODO) : GitHub Action qui détruit toute branch > 7 jours.

## Limites connues

- La DB branch **ne contient pas les données prod** (seed synthétique only).
  - Si besoin de tester contre un dump prod, utiliser `pg_dump` + anonymisation manuelle.
- Stripe en `test` mode obligatoire sur preview (clés `STRIPE_SECRET_KEY` test-scoped).
- Turnstile désactivable via env `NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA` (test key officiel Cloudflare).
