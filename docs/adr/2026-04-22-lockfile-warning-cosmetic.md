# `next build` multiple lockfiles warning — cosmétique, différé

**Date** : 2026-04-22
**Statut** : accepté
**Ref** : clôture item TECH_DEBT `[2026-04-21] next build warning "multiple lockfiles"`

## Contexte

`next build` émet un warning informatif lors du build :

```
Warning: Detected additional lockfiles:
  * /Users/laidhamoudi/package-lock.json
```

Cause : un `package-lock.json` « poubelle » existe dans le home directory (`~/package-lock.json`) en plus du vrai lockfile du projet (`/Dev/GED_APP/package-lock.json`). Next.js remonte l'arbre des fichiers à la recherche d'un `package.json` / `package-lock.json` parent pour détecter le workspace root et alerte quand plusieurs candidats existent.

Le warning est :
- **Informatif uniquement** : le build continue et produit un artifact valide
- **Non-bloquant** en CI (pre-commit + GitHub Actions passent vert)
- **Non-runtime** : aucun impact sur l'app déployée Vercel

## Pourquoi c'est différé

Le fix propre consiste à ajouter `outputFileTracingRoot` dans `next.config.mjs` :

```js
export default {
  outputFileTracingRoot: path.join(__dirname),
  // ...
};
```

Mais ce changement est **cross-zone app config** au sens CLAUDE.md §"1 IA = 1 zone à la fois" :
- touche le build pipeline Next.js (zone infra)
- peut affecter le bundling Vercel (zone deploy)
- interagit avec depcruise + TypeScript path resolution (zone tooling)

Application de la règle CLAUDE.md §"Décisions techniques non-triviales → ADR 1 page" + §"1 IA = 1 zone à la fois" : un changement qui peut déclencher des effets de bord sur le build, le déploiement, et les outils de dev **devrait** faire l'objet d'un ADR dédié avec validation humaine explicite, pas être glissé dans une session focus feature.

## Options considérées

- **A) Fix immédiat via `outputFileTracingRoot` dans `next.config.mjs`** — pro : warning disparaît ; contre : risque de régression build/deploy non anticipée, cross-zone sans ADR dédié à ce fix précis
- **B) Supprimer le `~/package-lock.json` poubelle** — pro : résolution externe propre ; contre : touche environnement user dev (non versionné), n'empêche pas la réapparition future si dépendances installées au mauvais niveau
- **C) Accepter le warning comme cosmétique** — pro : zéro risque, aligné §"R3 pas de refacto pour faire propre" ; contre : warning persiste dans les logs de build

## Décision

**Option C** retenue. Le warning n'a aucun impact fonctionnel, runtime, sécurité, ou RGPD. Il est purement cosmétique dans les logs de build. Fix différé à une session future dédiée configuration Next.js avec ADR spécifique si d'autres motifs de toucher `next.config.mjs` apparaissent (ex. migration Next 15+ config, bundling Turbopack, etc.).

## Conséquences

- **Positives**
  - Zéro risque de régression build/deploy
  - Conforme R3 CLAUDE.md (pas de refacto « pour faire propre »)
  - Aligne principe 1 IA = 1 zone (ne pas disperser)
  - TECH_DEBT libère 1 slot (retour à la budget R1)

- **Négatives**
  - Warning subsiste dans logs `next build` local + Vercel
  - Peut masquer un futur warning légitime si quelqu'un arrête de scanner les logs

- **Révisable si**
  - Un nouveau warning « multiple lockfiles » apparaît avec cause différente
  - Session dédiée configuration Next.js ouvre la fenêtre pour grouper fixes config
  - Vercel change son algorithme de détection workspace root et le warning devient un erreur

## Référencement

- CLAUDE.md §"Règles de correction" R3 + §"1 IA = 1 zone à la fois"
- `docs/TECH_DEBT.md` item clôturé 2026-04-22 (→ section "Résolus")
