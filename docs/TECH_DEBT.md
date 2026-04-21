# TECH DEBT — GED App

**Budget dette** : max 5 items actifs. Au-delà → sprint résolution avant toute nouvelle feature.

Format : 1 ligne par item, trié par âge (plus ancien = top priorité).

```
- [AAAA-MM-JJ] <zone> — <description courte> (tag: rustine|refacto|dep|secu|perf)
```

## Actifs

- [2026-04-21] `tests/e2e/*` — 85/130 tests E2E en échec depuis run 2026-04-19 (tag: tests). Fichiers 0-passant : `reservation-{kids,pro,virement}`, `dossier-enfant`, `verify-db`, `parcours-staff-fill`, `parcours-inscription-complet`. Décision dans `docs/adr/2026-04-21-e2e-smoke-only.md`. Action : restaurer par lot avant sprint F1 complet.
- [2026-04-21] Supabase Auth — "Leaked password protection" désactivée (tag: secu). Détecté via `get_advisors` post-migration 084. Confirme bug Thanh R1 (P14.3 "mdp trop laxe"). Action : activer dans dashboard Supabase Auth settings (5min, zéro code).
- [2026-04-21] RLS sans policy sur `gd_audit_log` + `gd_session_deletion_log` (tag: secu, level INFO). Risque : lecture anon/authenticated si l'API les expose. Action : ajouter `CREATE POLICY "service_role only"` ou désactiver RLS si tables purement internes.
- [2026-04-21] 31 structures `status=active` sans email — détecté par `gd_audit_data_integrity()`. Impact : éducateurs non contactables depuis l'admin (tag: data). Action : audit + backfill ou passer statut à `inactive` si vraies orphelines.
- [2026-04-21] `next build` warning "multiple lockfiles" (`~/package-lock.json` home + `/Dev/GED_APP/package-lock.json`) (tag: rustine, cosmétique). Pas bloquant. Fix = ajouter `outputFileTracingRoot` dans `next.config.mjs` (cross-zone app config → ADR requis). Différé, pas urgent.

## Résolus

_(archive après clôture)_

---

## Règles

1. **R1** — Max 5 items actifs. Au-delà = freeze nouvelle feature jusqu'à résorption.
2. **R2** — Toute rustine (`// FIXME:`, `// TODO: hack`, try/catch silencieux) crée une ligne ici **le jour même**.
3. **R3** — Refacto uniquement si bloquant pour une feature demandée. Pas de refacto "pour faire propre".
4. **Revue hebdo** : lundi 10min, trier, clôturer, prioriser.
