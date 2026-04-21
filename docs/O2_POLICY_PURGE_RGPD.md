# O2 — Policy purge RGPD storage + DB

**Validée user 2026-04-21** — à implémenter dans `/api/cron/rgpd-purge` (handler `purgeAbandonedDossierStorage`).

## Règles de purge

| Statut dossier | Délai | Scope |
|---|---|---|
| `refusee` | > 90 j | storage PJ + row `gd_dossier_enfant` + auditLog |
| `en_attente` | > 180 j | storage PJ + row `gd_dossier_enfant` + auditLog |
| Inactif (`updated_at > 180j`, tous statuts sauf `validee`) | > 180 j | storage PJ + row `gd_dossier_enfant` + auditLog |

## Préservation

- **`gd_inscriptions` row intacte** — préserve historique facturation / paiement Stripe.
- **`gd_dossier_enfant` row supprimée** — PII Art.9 purgée.
- **PJ storage supprimées** — fichiers Supabase Storage bucket dossier-enfant.

## auditLog obligatoire (par dossier purgé)

```ts
await auditLog(supabase, {
  action: 'delete',
  resourceType: 'dossier_enfant',
  resourceId: dossierId,
  actorType: 'system',
  metadata: {
    reason: 'rgpd_purge',
    purge_policy: 'refusee_90j' | 'en_attente_180j' | 'inactif_180j',
    inscription_id: inscriptionId,
    files_purged_count: N,
  },
});
```

## Implémentation

- **Fichier** : `app/api/cron/rgpd-purge/route.ts` (ajouter handler `purgeAbandonedDossierStorage`)
- **Déclenchement** : cron Vercel (schedule existant rgpd-purge)
- **Auth** : `CRON_SECRET` Bearer (déjà en place)
- **Ordre** :
  1. SELECT dossiers éligibles (3 critères ci-dessus)
  2. Pour chaque dossier : supprimer PJ storage → supprimer row → auditLog
  3. Retour JSON : `{ purged: N, errors: [] }`
- **Test** : dry-run env `CRON_DRY_RUN=true` retourne liste candidats sans delete

## Multi-agent obligatoire avant code (CLAUDE.md §Règle)

1. `arch-impact-reviewer` — impact tables PII + cascade FK
2. `supabase-integrity-auditor` — ordre FK, RLS service_role OK, vérifier cascade vs FK
3. `functional-bug-hunter` — edge cases : dossier sans fichier, storage path null, paiement en cours
4. `workflow-integration-reviewer` — intégration cron + auditLog + idempotence

Estimation : 2h code + 30min tests + 30min review multi-agents.
