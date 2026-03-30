---
name: Tables Supabase référencées dans le code mais absentes du schéma Prisma
description: Écart entre les tables appelées via .from() dans le code et le schéma Prisma
type: project
---

## Tables dans le code (via .from()) NON présentes dans prisma/schema.prisma

| Table | Fichiers qui l'utilisent |
|---|---|
| `gd_souhaits` | api/souhaits/route.ts, api/souhaits/kid/[kidToken]/route.ts, api/educateur/souhait/[token]/route.ts |
| `gd_structures` | api/souhaits/route.ts:61 |
| `gd_dossier_enfant` | api/dossier-enfant/**/*.ts, api/admin/dossier-enfant/**/*.ts, api/admin/inscriptions/[id]/relance |
| `gd_propositions_tarifaires` | api/admin/propositions/route.ts, api/admin/inscriptions/[id]/route.ts, api/admin/propositions/pdf |

## Tables dans prisma/schema.prisma NON référencées dans le code applicatif

| Table Prisma | Observation |
|---|---|
| `gd_educ_options` | Définie dans Prisma, aucune requête Supabase trouvée |
| `gd_wishes` | Modèle Prisma défini (alias de gd_souhaits ?), mais le code utilise `gd_souhaits` |
| `activities` | Modèle Prisma héritage import UFOVAL, non utilisé dans les routes app |
| `activity_sessions` | Idem |
| `smart_form_submissions` | Définie dans Prisma + SQL, non référencée dans les routes API |
| `import_logs` | Définie dans Prisma + SQL, non référencée dans les routes API |
| `notification_queue` | Définie dans Prisma + SQL, non référencée dans les routes API |

## Migrations SQL en attente de synchronisation Prisma

Les fichiers suivants dans n8n-patches/ contiennent des migrations SQL qui créent des tables
non reflétées dans prisma/schema.prisma :
- `migration_souhaits.sql` → crée `gd_souhaits` (absente de Prisma)
- `migration_dossier_enfant.sql` → crée `gd_dossier_enfant` (absente de Prisma)
- `migration_propositions_tarifaires.sql` → crée `gd_propositions_tarifaires` (absente de Prisma)
- `migration_pro_parcours_phase1_phase2.sql` → crée `gd_structures` probable (absente de Prisma)
