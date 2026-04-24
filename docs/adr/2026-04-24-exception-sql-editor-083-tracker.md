# Exception — INSERT manuel schema_migrations pour migration 083 (signature_meta)

**Date** : 2026-04-24
**Statut** : accepté (exception ponctuelle, pas règle)
**Ref** : drift traçabilité migration `083_signature_meta.sql` (commit `b7f00f4`)

## Contexte

La migration `supabase/migrations/083_signature_meta.sql` a été appliquée en prod le **2026-04-19 via SQL Editor Supabase** (dashboard web, hors flow `supabase db push`). Les 12 colonnes `{bulletin,sanitaire,liaison}_signed_{at,ip,signer_qualite,signature_hash}` ajoutées sur `gd_dossier_enfant` sont présentes en DB live (cross-check `information_schema.columns` 2026-04-24).

Le fichier SQL lui-même a été committé ultérieurement (commit `b7f00f4` le 2026-04-22) dans un effort de rattrapage drift. Mais l'entrée correspondante **n'existait pas** dans `supabase_migrations.schema_migrations` — aucun enregistrement nommé `signature_meta` ou versionné `20260419*`.

Conséquence sans action : tout futur `supabase db diff` ou `supabase db push` pouvait re-proposer les 12 colonnes comme nouvelles, avec risque d'erreur `column already exists` à l'apply ou de migration auto-générée polluée.

## Contrainte technique

Le flow propre pour réconcilier un drift = **preview branch Supabase** (clone schéma live → test → merge en prod). Ce flow est **indisponible sur le plan Free** de l'org INKLUSIF APP (vérifié 2026-04-24 : plan Free confirmé). Les preview branches nécessitent le plan Pro minimum.

Deux options restantes :
- Upgrade plan Pro (non décidé aujourd'hui)
- Action manuelle en SQL Editor avec traçabilité renforcée

## Décision

**Option B retenue — INSERT manuel dans `supabase_migrations.schema_migrations` via SQL Editor, avec traçabilité renforcée (snippet committé + ce ADR).**

### SQL exact exécuté (2026-04-24)

```sql
-- DRY-RUN préalable (lecture seule)
SELECT version, name FROM supabase_migrations.schema_migrations
WHERE version LIKE '2026042%' OR name ILIKE '%sign%'
ORDER BY version DESC LIMIT 10;

-- Pas de collision sur version 20260422120000
-- Aucune entrée signature existante

-- INSERT (idempotent)
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260422120000', '083_signature_meta_applied_manually')
ON CONFLICT (version) DO NOTHING;

-- Vérification post-insert
SELECT version, name FROM supabase_migrations.schema_migrations
WHERE version = '20260422120000';
-- Résultat : 1 ligne retournée → INSERT confirmé
```

Snippet archivé en git : `supabase/migrations/MANUAL_083_tracker.sql.applied`.

### Choix de la version

Le fichier local `supabase/migrations/083_signature_meta.sql` utilise la numérotation séquentielle (`083_`) et non le format timestamp ISO `YYYYMMDDHHMMSS_` attendu par Supabase CLI. Pour éviter toute collision avec la séquence ISO existante, la version choisie est `20260422120000` (date du commit `b7f00f4` qui a versionné le fichier, 12h00 arbitraire). Le nom `083_signature_meta_applied_manually` documente explicitement l'exception.

## Options considérées

- **A) Upgrade plan Pro → preview branch → merge propre** — pro : flow standard, validation isolée ; contre : décision budgétaire hors scope de cette correction, délai d'activation incertain
- **B) INSERT manuel SQL Editor + ADR** — pro : réversible en 1 ligne, zéro DDL, traçabilité complète ; contre : exception au flow standard, à documenter
- **C) Ne rien faire** — pro : aucune action ; contre : risque concret sur prochaine migration 087+ (re-propose les colonnes déjà présentes → erreur apply)

## Conséquences

- **Positives**
  - `supabase db diff` ne re-proposera plus les colonnes signature comme nouvelles
  - Registre `schema_migrations` aligné avec l'état réel de la DB
  - Prochaine migration 087+ non polluée
  - Traçabilité : snippet en git + ADR = reconstructible par n'importe quel contributeur

- **Négatives**
  - Exception au flow `supabase db push` (documentée, pas règle)
  - Hash de migration absent du registre (colonne `hash` nullable) — `supabase db push` pourrait considérer le fichier comme "modifié depuis apply" si un hash est attendu. À tester au prochain push
  - Écart symbolique entre nom `083_signature_meta_applied_manually` et nom du fichier `083_signature_meta.sql`

- **Révisable si**
  - Upgrade plan Pro activé → rien à faire (registre déjà aligné)
  - Supabase CLI exige un format version strict → renommer l'entrée
  - >2 exceptions SQL Editor dans le même trimestre → upgrade Pro obligatoire (sinon le flow manuel devient la norme implicite, ce qui est refusé)

## Rollback

```sql
DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20260422120000';
```

Réversible en <5 secondes. Aucune donnée métier affectée (registre de migration uniquement).

## Référencement

- Fichier migration : `supabase/migrations/083_signature_meta.sql`
- Rollback migration : `supabase/migrations/ROLLBACK_083.sql`
- Snippet SQL manuel : `supabase/migrations/MANUAL_083_tracker.sql.applied`
- Commit versioning : `b7f00f4` (chore(migrations): versionner 083_signature_meta (drift prod rattrapé))
- CLAUDE.md §"Règles de gouvernance données" — applicable
- Cross-check DB live 2026-04-24 : 12 colonnes signature présentes ; entrée `schema_migrations` ajoutée par ce ADR
