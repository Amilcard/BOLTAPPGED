# ADR — Architecture Decision Records

**Objectif** : tracer les décisions techniques non-triviales pour que les sessions IA suivantes (et futur toi) comprennent **pourquoi** avant de **quoi**.

## Quand écrire un ADR

- Choix entre 2+ options viables aux conséquences différentes (ex: Supabase branch vs. Neon, NextAuth vs. Supabase Auth)
- Décision qui impacte auth / paiement / RGPD / data mineur
- Rollback d'une approche précédente
- Contrainte métier qui force un choix contre-intuitif

## Quand NE PAS écrire

- Choix évident (`Edit` plutôt que `Write` pour modifier un fichier existant)
- Micro-tactique dans une fonction
- Convention déjà dans CLAUDE.md

## Format

`docs/adr/YYYY-MM-DD-<slug-court>.md`, max 1 page :

```markdown
# <Titre court>

**Date** : YYYY-MM-DD
**Statut** : proposé | accepté | remplacé par <ADR-xxx>

## Contexte
<2-3 phrases sur le problème résolu>

## Options considérées
- A) <option A> — <pro/contre>
- B) <option B> — <pro/contre>
- C) <option C> — <pro/contre>

## Décision
<option retenue + justification 2-3 lignes>

## Conséquences
- Positives : <1-3 bullets>
- Négatives : <1-3 bullets>
- Révisable si : <critère qui déclencherait un remplacement>
```

## Index

_(à remplir au fil des ADR créés)_
