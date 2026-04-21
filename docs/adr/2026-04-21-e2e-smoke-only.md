# E2E smoke-only en pré-commit tant que dette non résorbée

**Date** : 2026-04-21
**Statut** : accepté

## Contexte

L'infra Playwright existe (12 fichiers, 130 tests × 3 browsers). Run du 2026-04-19 : **85 failed / 45 passed**. La majorité des fichiers `reservation-*`, `dossier-enfant`, `verify-db`, `parcours-staff-fill`, `parcours-inscription-complet` passent 0 test.

Cause supposée (non-confirmée sans debug fichier par fichier) :

- Tests fragiles sur sélecteurs / timing
- Tests dépendants de données Supabase prod qui ont changé (schéma, seeds)
- Tests qui tapent des routes refactoriées depuis leur écriture

Installer Playwright en garde pre-commit **avec la suite complète** bloquerait tous les commits actuels (85 failed). Inacceptable.

## Options considérées

- **A) Réparer les 85 tests avant tout autre travail** — pro : couverture restaurée ; contre : 2-3 jours bloqués avant toute feature
- **B) Désactiver E2E complètement** — pro : aucun ; contre : régressions invisibles
- **C) Smoke-only en pré-commit sur le fichier le plus stable** (`parcours-admin` : 70 % pass) — pro : filet minimal, débloque commits ; contre : couverture partielle, dette explicite à résorber
- **D) Supprimer les tests cassés et repartir** — pro : repart propre ; contre : perd l'historique des intents testés

## Décision

**Option C** retenue. Smoke-only via `npm run test:e2e:smoke` ciblant `parcours-admin.spec.ts` uniquement. Dette tracée dans `docs/TECH_DEBT.md`. Restauration par lot lors d'un sprint F1-complet dédié (6-12h).

## Conséquences

- **Positives**
  - Commits non bloqués
  - Filet smoke actif (déjà mieux que 0)
  - Dette explicite et visible (TECH_DEBT + ADR)
  - Stratégie graduelle : chaque fichier restauré entre dans `test:e2e:smoke`
- **Négatives**
  - Couverture 20-25 % réelle seulement
  - Régressions hors admin invisibles à ce stade
  - Risque que la dette ne soit jamais résorbée si pas de sprint dédié
- **Révisable si**
  - > 3 régressions production échappent à `test:e2e:smoke` sur un trimestre
  - Autre fichier atteint > 90 % stable → l'ajouter à la suite smoke
  - Sprint F1-complet planifié → migrer vers suite E2E complète
