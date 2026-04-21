# CI hardening — PR blocking + audit data hebdo

**Date** : 2026-04-21
**Statut** : accepté

## Contexte

État CI avant ce chantier :

| Workflow | Trigger | Bloquant ? |
|---|---|---|
| `typecheck.yml` | push main/work | oui sur push |
| `eslint.yml` | push + PR main | **non** (`continue-on-error: true`) |
| `bundle-check.yml` | push + PR main | oui (next build fail = job fail) |

Trous identifiés :
- **TSC non bloquant sur PR** : une PR peut introduire des erreurs TS qui ne seront détectées qu'après merge sur `main`
- **Pas de Jest unit en CI** : tests unitaires existent (`npm run test:unit`) mais tournent uniquement en local via Husky pre-commit → bypass possible avec `--no-verify`
- **Audit data manuel uniquement** : `npm run audit:data` existe mais personne ne le lance → dérives data non détectées

## Options considérées

- **A) Modifier workflows existants** (étendre `on:` de typecheck, retirer `continue-on-error` d'eslint) — contre : change comportement existant, risque de casser des PR en cours
- **B) Créer nouveaux workflows qui complètent** — pro : zéro régression sur l'existant, rollback propre par suppression de fichier ; contre : duplication partielle (install npm 2×)
- **C) Workflow consolidé unique** — pro : DRY ; contre : gros blast radius si pète

## Décision

**Option B.** Deux nouveaux workflows :

1. **`ci-pr-blocking.yml`** — PR → main : TSC + Jest unit, bloquant
2. **`audit-data-weekly.yml`** — cron dimanche 06:00 UTC + dispatch manuel, upload artifact JSON 90j

Workflows existants **intouchés**.

### Cron : GitHub Actions plutôt que Vercel Cron

La recommandation plugin Vercel suggère `vercel.json > crons`. **Rejetée** pour ce cas :

- Script `audit-data-integrity.ts` écrit `test-reports/*.json` via `fs` → ne fit pas un contexte serverless
- `actions/upload-artifact` fournit rétention 90j out-of-box (audit trail RGPD-friendly)
- Vercel Cron imposerait : port TS script → route API + nouveau secret `CRON_SECRET` dédié + surface HTTP publique
- Gain fonctionnel nul pour un job interne hebdo

Réversible si besoin futur : déplacer vers Vercel Cron quand un job réellement stateless émerge.

## Conséquences

- **Positives**
  - PR qui casse TSC ou Jest ne peut plus être merged accidentellement
  - Audit data hebdo automatique, fail visible dans GitHub Actions
  - Rétention artifact 90j = traçabilité intégrité data
  - Zéro impact sur workflows existants (ajoutés, pas modifiés)
- **Négatives**
  - Install npm dupliqué entre jobs (temps CI +1-2min par PR)
  - Secrets GitHub à provisionner : `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (production)
- **Révisable si**
  - Temps CI > 10min → consolider en un seul workflow
  - Audit hebdo trop spam → passer à mensuel
  - Besoin d'alerter → brancher Slack sur le fail du job audit

## Prochaines étapes hors scope ADR

- Provisionner secrets GitHub (action user, pas code)
- Activer branch protection `main` : require PR, require `ci-pr-blocking` + `bundle-check` status checks
- Monitoring rapport audit : dashboard admin `/admin/data-integrity` (backlog)
