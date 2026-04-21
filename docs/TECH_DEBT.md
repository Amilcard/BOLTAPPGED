# TECH DEBT — GED App

**Budget dette** : max 5 items actifs. Au-delà → sprint résolution avant toute nouvelle feature.

Format : 1 ligne par item, trié par âge (plus ancien = top priorité).

```
- [AAAA-MM-JJ] <zone> — <description courte> (tag: rustine|refacto|dep|secu|perf)
```

## Actifs

_(vide pour l'instant — ajouter les FIXME/TODO légitimes ici au fil de l'eau)_

## Résolus

_(archive après clôture)_

---

## Règles

1. **R1** — Max 5 items actifs. Au-delà = freeze nouvelle feature jusqu'à résorption.
2. **R2** — Toute rustine (`// FIXME:`, `// TODO: hack`, try/catch silencieux) crée une ligne ici **le jour même**.
3. **R3** — Refacto uniquement si bloquant pour une feature demandée. Pas de refacto "pour faire propre".
4. **Revue hebdo** : lundi 10min, trier, clôturer, prioriser.
