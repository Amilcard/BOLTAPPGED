# Matrice couverture auditLog — GED App

> Référencée par CLAUDE.md § "Prelude anti-pièges". Toute mutation sur ces tables DOIT appeler `auditLog()`.
> Toute nouvelle table PII = ligne ajoutée ici dans la même PR, sinon merge bloqué.

## Tables PII sous couverture obligatoire

| Table | Read audit | Write audit | Notes |
|---|---|---|---|
| `gd_inscriptions` | admin detail | create/update/delete | RGPD Art.9 indirect |
| `gd_dossier_enfant` | obligatoire (Art.9 direct) | obligatoire | `verifyOwnership()` + auditLog |
| `gd_propositions_tarifaires` | admin detail + structure list/pdf (B2 M3) | create/update/send/delete | structure routes 2026-04-21 |
| `gd_factures` | admin detail | create/update (PATCH status) | **Ajouté 2026-04-18** — trou détecté |
| `gd_incidents` | pro + admin | create/update/delete | Tables réelles (ex-`gd_suivi_incidents` zombie dropped 086) |
| `gd_medical_events` | pro + admin | create/update/delete | Art.9 direct — purge 3 mois (ex-`gd_suivi_medical` zombie) |
| `gd_calls` | pro + admin | create/update/delete | Ex-`gd_suivi_appels` zombie |
| `gd_notes` | pro + admin | create (non éditable) | Ex-`gd_suivi_messages`/`gd_suivi_notes` zombie |
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
- **2026-04-22** — Renommage PII : `gd_suivi_*` (tables zombies 0 rows) remplacées par les vraies tables actives `gd_incidents`, `gd_medical_events`, `gd_calls`, `gd_notes`. DROP des zombies en migration 086.
