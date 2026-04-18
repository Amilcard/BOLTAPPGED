# Matrice couverture auditLog — GED App

> Référencée par CLAUDE.md § "Prelude anti-pièges". Toute mutation sur ces tables DOIT appeler `auditLog()`.
> Toute nouvelle table PII = ligne ajoutée ici dans la même PR, sinon merge bloqué.

## Tables PII sous couverture obligatoire

| Table | Read audit | Write audit | Notes |
|---|---|---|---|
| `gd_inscriptions` | admin detail | create/update/delete | RGPD Art.9 indirect |
| `gd_dossier_enfant` | obligatoire (Art.9 direct) | obligatoire | `verifyOwnership()` + auditLog |
| `gd_propositions_tarifaires` | admin detail | create/update/send/delete | |
| `gd_factures` | admin detail | create/update (PATCH status) | **Ajouté 2026-04-18** — trou détecté |
| `gd_suivi_incidents` | pro + admin | create/update/delete | |
| `gd_suivi_medical` | pro + admin | create/update/delete | Art.9 direct — purge 3 mois |
| `gd_suivi_calls` | pro + admin | create/update/delete | |
| `gd_suivi_notes` | pro + admin | create (non éditable) | |
| `gd_structure_access_codes` | admin + direction | invite/revoke/reinvite/activate | |
| `gd_educateur_emails` | admin | create/update/delete | |
| `gd_stay_sessions` | si affecte dossier | update capacity si impact | |
| `gd_souhaits` | kids public (rate-limited) | create/delete | |

## Tables hors liste (non-PII)

Ces tables n'ont pas d'exigence auditLog forte — vérifier néanmoins si PII indirecte :
`gd_stays`, `gd_stay_themes`, `gd_session_prices`, `gd_waitlist` (email parent), `gd_audit_log` (immuable), `gd_login_attempts` (rate-limit), `gd_revoked_tokens`.

## Procédure ajout table

1. Créer migration
2. Ajouter ligne dans ce fichier avec date + scope read/write
3. Ajouter la table dans CLAUDE.md § "Tables PII — liste à jour"
4. PR bloquée sinon

## Historique trous détectés

- **2026-04-18** — `gd_factures` PATCH sans auditLog détecté par audit 4-agents. Table ajoutée après règle #15, jamais re-scannée.
