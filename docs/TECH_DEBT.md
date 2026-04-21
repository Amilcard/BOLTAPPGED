# TECH DEBT — GED App

**Budget dette** : max 5 items actifs. Au-delà → sprint résolution avant toute nouvelle feature.

Format : 1 ligne par item, trié par âge (plus ancien = top priorité).

```
- [AAAA-MM-JJ] <zone> — <description courte> (tag: rustine|refacto|dep|secu|perf)
```

## Actifs

- [2026-04-21] `tests/e2e/*` — 85/130 tests E2E en échec depuis run 2026-04-19 (tag: tests). Fichiers 0-passant : `reservation-{kids,pro,virement}`, `dossier-enfant`, `verify-db`, `parcours-staff-fill`, `parcours-inscription-complet`. Décision dans `docs/adr/2026-04-21-e2e-smoke-only.md`. Action : restaurer par lot avant sprint F1 complet.

## Résolus

_(archive après clôture)_

---

## Règles

1. **R1** — Max 5 items actifs. Au-delà = freeze nouvelle feature jusqu'à résorption.
2. **R2** — Toute rustine (`// FIXME:`, `// TODO: hack`, try/catch silencieux) crée une ligne ici **le jour même**.
3. **R3** — Refacto uniquement si bloquant pour une feature demandée. Pas de refacto "pour faire propre".
4. **Revue hebdo** : lundi 10min, trier, clôturer, prioriser.
