# RLS enabled + no policy sur `gd_audit_log` et `gd_session_deletion_log` — by design

**Date** : 2026-04-22
**Statut** : accepté
**Ref** : clôture item TECH_DEBT `[2026-04-21] RLS sans policy sur gd_audit_log + gd_session_deletion_log`

## Contexte

Supabase advisor (lint `rls_enabled_no_policy`, niveau INFO) signale deux tables avec RLS activé mais aucune policy créée :

- `public.gd_audit_log` (671 rows au 2026-04-22, rétention 12 mois)
- `public.gd_session_deletion_log` (6 rows, trigger `trg_log_session_delete`)

L'alerte suggère que sans policy, **aucun rôle ne peut accéder** à ces tables depuis un client authentifié (anon ou authenticated). Supabase considère cela comme potentiel oubli de politique.

MCP `get_advisors` confirmé le 2026-04-22 :
```
{"name":"rls_enabled_no_policy","level":"INFO","facing":"EXTERNAL",
 "detail":"Table public.gd_audit_log has RLS enabled, but no policies exist"}
```

## Pourquoi c'est un faux positif

**Les deux tables sont strictement internes, `service_role` only, insert-only côté application** :

| Table | Rôle | Accès prévu |
|---|---|---|
| `gd_audit_log` | Journal RGPD/CNIL Art.9 sur mutations PII mineurs | INSERT via `auditLog()` côté API serveur (clé `SERVICE_ROLE_KEY`). Lecture réservée à l'admin via route `/api/admin/structures/[id]/audit-log` (guard `requireAdmin`). Pas de SELECT direct anon/authenticated légitime. |
| `gd_session_deletion_log` | Trace DDL interne — trigger `trg_log_session_delete` | INSERT automatique par trigger SQL sur DELETE de `gd_stay_sessions`. Lecture réservée opérateur via query ad-hoc. Pas de SELECT client légitime. |

**Pattern CLAUDE.md §11 (règles sécurité GED)** explicite :

> RLS actif sur toutes les tables contenant PII — gd_inscriptions, gd_dossier_enfant, gd_propositions_tarifaires = service_role only. Jamais d'accès anon. **Pattern : RLS activé + zéro policy = accès client bloqué, service_role bypass RLS → correct et intentionnel.** L'alerte Supabase "no policies" sur ces tables est un faux positif à ignorer.

`gd_audit_log` et `gd_session_deletion_log` tombent **exactement** dans ce pattern : RLS ON + zéro policy = deny-all anon/authenticated + service_role bypass. C'est la **configuration sécurisée par défaut** pour une table strictement service-role.

Ajouter une policy « service_role only » serait :
- redondant (service_role bypasse déjà RLS nativement)
- potentiellement dangereux (un oubli de qualification role = ouverture)
- contre-pattern vs les 3 autres tables PII du projet (`gd_inscriptions`, `gd_dossier_enfant`, `gd_propositions_tarifaires`) qui suivent le même pattern zéro-policy depuis le début

## Options considérées

- **A) Ajouter `CREATE POLICY "service_role only" ON gd_audit_log FOR ALL USING (auth.role() = 'service_role')`** — pro : fait taire l'advisor ; contre : redondant + contre-pattern, risque initplan `auth.role()` non wrappé (cf. migration `rls_initplan_fix`)
- **B) Désactiver RLS sur les deux tables** — pro : avertissement disparaît ; contre : **inacceptable sécurité** — ouvre accès anon/authenticated si jamais l'API les expose accidentellement
- **C) Accepter le faux positif, ignorer l'advisor INFO** — pro : cohérent avec §11 CLAUDE.md + pattern existant 3 tables PII ; contre : advisor reste dans le dashboard Supabase (peut être filtré par niveau)

## Décision

**Option C** retenue. Le pattern RLS + zéro policy + service_role bypass est **le pattern sécurisé attendu** sur GED_APP pour toute table PII ou service-only. Advisor `rls_enabled_no_policy` niveau INFO = false positive structurel.

## Conséquences

- **Positives**
  - Cohérence avec pattern existant (5 tables PII désormais uniformes : `gd_inscriptions`, `gd_dossier_enfant`, `gd_propositions_tarifaires`, `gd_audit_log`, `gd_session_deletion_log`)
  - Zéro risque d'ouverture accidentelle via policy mal écrite
  - Zéro impact performance (pas d'évaluation policy par ligne)
  - Règle CLAUDE.md §11 reste autoritative

- **Négatives**
  - Advisor INFO Supabase reste rouge dans le dashboard (filtrable par niveau)
  - Nouveau dev qui découvre la table pourrait s'interroger (atténué par cet ADR + §11)

- **Révisable si**
  - Supabase change la sémantique de RLS sans policy (extrêmement improbable)
  - Une feature légitime doit exposer `gd_audit_log` à un rôle non-service (ex. read-only admin via RLS scopé)

## Référencement

- CLAUDE.md §"Règles sécurité & RGPD — GED App" rule 11
- `docs/TECH_DEBT.md` item clôturé 2026-04-22 (→ section "Résolus")
- MCP Supabase advisor output 2026-04-22 archivé : projet `iirfvndgzutbxwfdwawu`
