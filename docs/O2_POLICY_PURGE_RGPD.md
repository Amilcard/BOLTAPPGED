# O2 — Policy purge RGPD dossiers enfants abandonnés

**Implémentée 2026-04-21** dans `app/api/cron/rgpd-purge/route.ts` + `sql/076_rpc_purge_abandoned_dossiers.sql`.

## Règles de purge (table gd_dossier_enfant + storage)

| Critère inscription | Délai | Colonne | Purge |
|---|---|---|---|
| `status = 'refusee'` | > 90 j | `COALESCE(updated_at, created_at)` | PJ storage + row `gd_dossier_enfant` + auditLog |
| `status = 'en_attente'` (hors paiement en cours) | > 180 j | `COALESCE(updated_at, created_at)` | idem |
| `status NOT IN ('validee','refusee','en_attente')` (inactif) | > 180 j | `COALESCE(updated_at, created_at)` | idem |
| `deleted_at IS NOT NULL` (soft-deleted) | > 90 j | `deleted_at` | idem |

### Exclusions anti-régression

- `status = 'validee'` → JAMAIS purgé (séjour effectué, historique préservé).
- `payment_status IN ('pending_payment','pending_transfer','pending_check')` → dossier préservé sur `en_attente` (webhook Stripe tardif possible).
- `updated_at` NULL → fallback `created_at` via COALESCE (évite fuite RGPD sur legacy data).

## Préservation

- **`gd_inscriptions` row intacte** — préserve historique facturation / paiement Stripe.
- **`gd_dossier_enfant` row supprimée** — PII Art.9 purgée.
- **PJ storage supprimées** — bucket Supabase `dossier-documents` (pas `dossier-enfant`).

## auditLog (par dossier purgé)

```ts
await auditLog(supabase, {
  action: 'delete',
  resourceType: 'dossier_enfant',
  resourceId: inscriptionId,       // non-PII, la row inscription reste
  inscriptionId,
  actorType: 'system',
  metadata: {
    reason: 'rgpd_purge',
    purge_policy: 'refusee_90j' | 'en_attente_180j' | 'inactif_180j' | 'soft_deleted_90j',
    dossier_id: dossierId,
    files_purged_count: N,
  },
});
```

## Implémentation

- **RPC SQL** : `gd_get_dossiers_purge_candidates(p_limit INT DEFAULT 50)` — `SECURITY DEFINER`, retourne `{dossier_id, inscription_id, purge_policy, documents_joints}`, LIMIT plafonnée à 500.
- **Handler** : dans `/api/cron/rgpd-purge/route.ts` après les purges existantes (ordre conservé).
- **Ordre par dossier** : `storage.remove([paths])` batch → `delete row` → `auditLog`. Idempotent (remove sur path absent = no-op Supabase).
- **try/catch par itération** : l'échec d'un dossier ne stoppe pas les suivants.
- **Dry-run** : `CRON_DRY_RUN=true` → retourne `{dryRun: true, dossier_candidates: [...]}` sans delete.
- **Batching** : 200 dossiers max par run (cron mensuel `0 3 1 * *`, ~200s < 300s Vercel timeout).

## Déclenchement

- Cron existant `rgpd-purge` (Vercel). Auth `CRON_SECRET` Bearer.
- Aucune planification additionnelle requise.

## Trace CNIL

L'auditLog global du cron ajoute `dossiers_purged: N` + `dossier_files_purged: N` dans `metadata` (preuve de passage mensuelle).

## Multi-agents consultés avant implémentation (2026-04-21)

- `arch-impact-reviewer` : blast radius confirmé leaf, 2 edge cases tranchés (payment_status, soft-delete).
- `supabase-integrity-auditor` : filtre PostgREST `.or()` sur colonne jointe impossible → RPC SQL dédiée. `storage.remove` idempotent confirmé.

## Migration séquence

1. Appliquer `sql/076_rpc_purge_abandoned_dossiers.sql` dans Supabase SQL Editor.
2. Vérifier RPC : `SELECT * FROM gd_get_dossiers_purge_candidates(10);`
3. Dry-run prod : `curl -H "Authorization: Bearer $CRON_SECRET" https://app.../api/cron/rgpd-purge` avec `CRON_DRY_RUN=true` temporaire dans env Vercel.
4. Retirer `CRON_DRY_RUN` une fois validé.
