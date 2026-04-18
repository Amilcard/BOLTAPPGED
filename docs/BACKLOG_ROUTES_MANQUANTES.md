# Backlog Routes Manquantes — GED App

> Intents métier articulés mais pas encore portés par une route.
> Règle CLAUDE.md : jamais laisser un intent métier formulé mourir sans trace.

| Intent | Route attendue | Auth requise | Articulé | Owner | Deadline |
|---|---|---|---|---|---|
| Secrétariat remplit dossier inscription | `PATCH /api/structure/[code]/inscriptions/[id]/dossier` | `requireStructureRole({allowRoles:['secretariat','direction','cds']})` + auditLog | 2026-04-18 | - | Sprint suivant |
| CDS/Direction comble absence educateur (urgence) | Étendre route above — même scope rôles | même | 2026-04-18 | - | Sprint suivant |
| Direction révoque session délégation CDS avant expiration | `POST /api/structure/[code]/delegation/revoke` | `direction` only + auditLog | backlog historique | - | À valider |
| Password reset pro (oubli mot de passe) | `POST /api/auth/forgot-password` + `POST /api/auth/reset-password` | public + rate-limit | backlog historique | - | Post-launch |
| Session revocation UI (direction coupe accès actif) | `POST /api/structure/[code]/team/[id]/revoke-session` | `direction` + auditLog + JTI invalidation | backlog historique | - | Post-launch |

## Procédure

Si user décrit un workflow pendant une session :
1. Créer la route dans la même session SI scope clair et risque faible
2. Sinon ajouter ligne ici avec date + scope auth attendu
3. Marquer TODO dans CLAUDE.md § rôles si impact matrice
