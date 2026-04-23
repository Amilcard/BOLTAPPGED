# Runtime Checks — 2026-04-22

Source : MCP Supabase `execute_sql` (project `iirfvndgzutbxwfdwawu` / `groupeetdecouverte`).
Read-only strict. Aucune modif code/DB déclenchée par ce rapport.

Contexte : phase test actuelle (pas d'inscriptions online, saisies manuelles SQL équipe GED). Les 10 queries V5 section A n'avaient jamais été câblées. Ce fichier est le premier câblage.

---

## M1 — Étendue pattern triple-NULL `validee`

```sql
SELECT COUNT(*) FROM gd_inscriptions
WHERE payment_method IS NULL AND dossier_ref IS NULL
  AND status='validee' AND deleted_at IS NULL;
```

**Résultat brut** : `1` ligne (= `ab2d26f0-cdcf-4ecc-8f89-dc57b06afab7`, seule et unique).

- **Finding** : anomalie isolée, pas un pattern systémique.
- **Risque** : faible (non reproductible observé) mais non fermé tant que mécanisme origine non compris.
- **Action suggérée** : branche C ciblée (agent `functional-bug-hunter` sur routes admin/inscriptions) + correction manuelle couverte par audit log enrichi.

---

## M2 — Historique status_logs de `ab2d26f0`

```sql
SELECT id, old_status, new_status, changed_by_email, changed_at
FROM gd_inscription_status_logs
WHERE inscription_id='ab2d26f0-cdcf-4ecc-8f89-dc57b06afab7'
ORDER BY changed_at ASC NULLS FIRST;
```

**Résultat brut** : 0 ligne. Schéma confirmé : `id, inscription_id, old_status, new_status, changed_by_email, changed_at` (colonne `created_at` inexistante).

- **Finding** : aucune transition de statut tracée. Combiné à `gd_audit_log WHERE resource_id='ab2d26f0…'` = 0 entrée, confirme que la ligne n'est jamais passée par un chemin applicatif instrumenté (ni création, ni update).
- **Risque** : confirme l'hypothèse H2 "saisie SQL directe hors parcours" pour cette ligne spécifique.
- **Action suggérée** : la correction B (UPDATE manuel) devra impérativement insérer une entrée audit_log + status_logs rétroactives pour tracer l'origine.

---

## A.1 — RLS + nombre de policies sur tables sensibles

```sql
SELECT t.tablename, t.rowsecurity,
  (SELECT COUNT(*) FROM pg_policies p WHERE p.tablename=t.tablename) AS nb_policies
FROM pg_tables t WHERE schemaname='public' AND tablename IN (...19 tables...)
ORDER BY tablename;
```

**Résultat brut** (16 lignes retournées sur 19 demandées) :

| Table | RLS | nb_policies |
|---|---|---|
| gd_admin_2fa | true | 1 |
| gd_audit_log | true | **0** |
| gd_dossier_enfant | true | 1 |
| gd_facture_paiements | true | 2 |
| gd_factures | true | 2 |
| gd_inscriptions | true | 1 |
| gd_processed_events | true | 1 |
| gd_propositions_tarifaires | true | 3 |
| gd_revoked_tokens | true | 1 |
| gd_session_prices | true | 2 |
| gd_souhaits | true | 1 |
| gd_stay_sessions | true | 1 |
| gd_stays | true | 1 |
| gd_structure_access_codes | true | 2 |
| gd_suivi_incidents | true | 1 |
| gd_suivi_medical | true | 1 |

Tables demandées mais **absentes** du résultat (= n'existent pas dans le schéma) : `gd_suivi_calls`, `gd_suivi_notes`, `gd_outbound_emails`.

- **Finding 1** : `gd_audit_log` a `rowsecurity=true` mais **0 policy** → lecture/écriture via `anon` ou `authenticated` = totalement bloquée. Seul `service_role` (admin backend) peut y accéder. Comportement intentionnel ? À vérifier.
- **Finding 2** : 3 tables déclarées dans le brief n'existent pas sous ce nom — la nomenclature réelle est `gd_calls`, `gd_notes` (visibles dans A.4). `gd_outbound_emails` : aucune table équivalente.
- **Risque** : inconnu (dépend si l'absence de policies sur `gd_audit_log` est volontaire). Renommages non documentés = drift doc/code.
- **Action suggérée** : confirmer que `gd_audit_log` sans policies = design voulu (écritures uniquement via service_role côté backend), pas un oubli. Mettre à jour la documentation tables (V5 section A).

---

## A.2 — RPC SECURITY DEFINER

```sql
SELECT proname, pg_get_userbyid(proowner) AS owner, prosecdef
FROM pg_proc WHERE pronamespace='public'::regnamespace AND prosecdef=true
ORDER BY proname;
```

**Résultat brut** : 18 fonctions, toutes `owner=postgres` :

| Fonction |
|---|
| check_rate_limit |
| fn_auto_create_dossier_enfant |
| gd_audit_data_integrity |
| gd_check_and_decrement_capacity |
| gd_check_session_capacity |
| gd_get_dossiers_purge_candidates |
| gd_get_expired_linked_medical_events |
| gd_get_medical_events_null_session_date |
| gd_increment_capacity |
| gd_purge_expired_audit_logs |
| gd_purge_expired_calls |
| gd_purge_expired_medical_data |
| gd_purge_expired_notes |
| merge_structures |
| purge_old_audit_logs |
| purge_old_login_attempts |
| purge_revoked_tokens |
| sync_is_full_to_sessions |

- **Finding** : 18 fonctions bypass RLS. 9 non répertoriées dans la mémoire projet (`fn_auto_create_dossier_enfant`, `gd_audit_data_integrity`, `gd_get_dossiers_purge_candidates`, `gd_increment_capacity`, `gd_purge_expired_calls`, `gd_purge_expired_notes`, `merge_structures`, `purge_revoked_tokens`, `sync_is_full_to_sessions`).
- **Risque** : chaque fonction SECURITY DEFINER = angle mort RLS. `merge_structures` et `fn_auto_create_dossier_enfant` touchent des données sensibles (mineurs).
- **Action suggérée** : revue une-par-une (corps des fonctions, validations d'entrée, rôles appelants autorisés). Commencer par `fn_auto_create_dossier_enfant` (trigger sur inscription) et `merge_structures` (mutation multi-lignes).

---

## A.3 — Vues exposant tables PII

```sql
SELECT table_name, view_definition FROM information_schema.views
WHERE table_schema='public' AND (view_definition ILIKE '%gd_dossier_enfant%'
  OR view_definition ILIKE '%gd_inscriptions%' OR view_definition ILIKE '%gd_souhaits%');
```

**Résultat brut** : 2 vues.

**`v_orphaned_records`** : UNION de 4 SELECT, expose uniquement `inscriptions.id` + `sejour_slug`. Pas de PII.

**`v_inscriptions_production`** : expose **52 colonnes** directement depuis `gd_inscriptions` (JOIN `gd_structures` avec filtre `is_test=false AND deleted_at IS NULL`), dont :
- `jeune_prenom, jeune_nom, jeune_date_naissance, jeune_besoins, jeune_sexe`
- `referent_nom, referent_email, referent_tel, referent_fonction`
- `structure_*` (13 colonnes structure)
- `suivi_token, parental_consent_at, consent_at`
- `payment_*` (5 colonnes), `dossier_ref`
- `consignes_communication, besoins_specifiques, note_pro, remarques, options_educatives`

Rappel Phase A audit 1.2 : **GRANT SELECT à `anon` ET `authenticated`** sur cette vue.

- **Finding** : `v_inscriptions_production` = vecteur de fuite PII complet si la vue est en `SECURITY INVOKER` (défaut PG 15-) alors que `gd_inscriptions` a 1 policy RLS, OU en `SECURITY DEFINER` (PG 15+ option) qui contournerait RLS. Mode exact non vérifié par ce runtime check.
- **Risque** : **élevé** si mode DEFINER ou si RLS `gd_inscriptions` ne bloque pas `anon` sur SELECT des colonnes PII. RGPD Art. 9 (besoins éducatifs/médicaux des mineurs exposés).
- **Action suggérée** : vérifier mode SECURITY de la vue (`pg_class.reloptions`) + lister les policies exactes sur `gd_inscriptions` (non couvert par A.1 qui ne remonte que le nombre). Objectif : valider que la politique RLS `anon` + `authenticated` bloque les colonnes PII. Si non → REVOKE SELECT ON v_inscriptions_production FROM anon, authenticated.

---

## A.4 — Contraintes CHECK `gd_%`

```sql
SELECT tc.table_name, tc.constraint_name, cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc ON tc.constraint_name=cc.constraint_name
WHERE tc.table_schema='public' AND tc.constraint_type='CHECK' AND tc.table_name LIKE 'gd_%'
ORDER BY tc.table_name, tc.constraint_name;
```

**Résultat brut** : ~160 lignes (CHECK + `_not_null` pseudo-constraints confondus). Extrait ciblé :

**`gd_inscriptions`** :
- NOT NULL : `id, jeune_prenom, jeune_nom, jeune_date_naissance` uniquement (4 colonnes)
- CHECK : `payment_method IN ('stripe','transfer','check')`, `payment_status IN (8 valeurs)`.
- **Pas de CHECK sur `status`**. Pas de NOT NULL sur `status, payment_method, payment_status, dossier_ref, referent_email, structure_id, session_date, sejour_slug, price_total`.

**`gd_inscription_status_logs`** : NOT NULL `id, inscription_id, new_status`. Pas de `created_at` / `changed_at` NOT NULL.

**`gd_audit_log`** : NOT NULL `id, action, resource_type, resource_id, actor_type, created_at`. Complet.

Autres observations :
- `gd_calls`, `gd_notes`, `gd_incidents`, `gd_medical_events` : CHECK enums + NOT NULL sur clés métier.
- `gd_facture_paiements.methode` : `IN ('virement','cb_stripe','cheque')`.
- `gd_factures.statut` : `IN ('brouillon','envoyee','payee_partiel','payee','annulee')`.

- **Finding critique** : `gd_inscriptions.status` n'a **ni CHECK enum ni NOT NULL**. Toute valeur texte arbitraire passe. Le contrôle est uniquement applicatif (Zod côté routes).
- **Risque** : régression silencieuse possible — un bug route inscrit `status='validé'` (typo français) au lieu de `'validee'` → CHECK laisse passer, requêtes métier filtrent `status='validee'` et ignorent la ligne. Pour `ab2d26f0`, scénario pertinent : la valeur `'validee'` est correcte mais rien n'aurait empêché n'importe quelle autre valeur via SQL direct.
- **Action suggérée** : ajouter (a) CHECK enum sur `status` aligné sur Zod (`'en_attente','validee','annulee','refusee'…` — à aligner), (b) NOT NULL sur `status, sejour_slug, referent_email, structure_id, price_total` via migration backfill + ALTER. Zéro rush : ne rien changer tant que l'impact sur les 28 inscriptions existantes n'est pas vérifié.

---

## A.10 — Coverage `gd_audit_log` par `resource_type` × `action` (30j)

```sql
SELECT resource_type, action, COUNT(*) AS nb,
       MIN(created_at) AS premiere, MAX(created_at) AS derniere
FROM gd_audit_log WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY resource_type, action ORDER BY nb DESC;
```

**Résultat brut** :

| resource_type | action | nb | premiere | derniere |
|---|---|---|---|---|
| inscription | read | 302 | 2026-04-10 14:32 | 2026-04-22 12:42 |
| dossier_enfant | read | 284 | 2026-04-10 14:34 | 2026-04-22 11:30 |
| inscription | create | 28 | 2026-04-10 14:33 | 2026-04-22 12:36 |
| dossier_enfant | update | 19 | 2026-04-19 18:01 | 2026-04-22 10:14 |
| document | download | 10 | 2026-04-20 20:38 | 2026-04-22 10:16 |
| team_member | read | 9 | 2026-04-19 16:57 | 2026-04-22 08:31 |
| inscription | delete | 4 | 2026-04-21 13:26 | 2026-04-21 13:26 |
| inscription | download | 4 | 2026-04-20 20:47 | 2026-04-22 10:17 |
| document | upload | 4 | 2026-04-19 18:08 | 2026-04-20 20:21 |
| structure_access_code | create | 4 | 2026-04-21 13:29 | 2026-04-21 13:29 |
| facture | read | 3 | 2026-04-19 16:57 | 2026-04-20 08:16 |
| team_member | update | 3 | 2026-04-21 07:29 | 2026-04-22 08:31 |
| structure | create | 2 | 2026-04-19 16:57 | 2026-04-21 13:29 |
| document | delete | 2 | 2026-04-20 21:02 | 2026-04-20 21:02 |
| dossier_enfant | submit | 2 | 2026-04-20 20:42 | 2026-04-22 10:16 |
| team_member | create | 1 | 2026-04-21 07:10 | 2026-04-21 07:10 |

- **Finding critique** : **aucune entrée `inscription.update` sur 30 jours**. 28 creates + 4 deletes + 302 reads + 4 downloads, mais **zéro update**. Or les routes `/api/admin/inscriptions/update` et `[id]` existent et sont testées. Deux interprétations exclusives :
  1. Les routes update n'appellent jamais `auditLog` (bug systémique côté code).
  2. Les mutations passent par un chemin qui contourne le log (SQL direct, RPC, trigger).
- **Risque** : **majeur RGPD**. Les modifications PII d'inscriptions (changement référent, statut, montant) ne sont pas traçables sur 30 jours → obligation CNIL de traçabilité non respectée pour ce type d'événement.
- **Action suggérée** : agent `functional-bug-hunter` sur `lib/admin-inscriptions-update.ts`, `lib/admin-inscriptions-*` et `app/api/admin/inscriptions/[id]/route.ts` — vérifier présence de `auditLog(supabase, { action: 'update', resource_type: 'inscription', … })` après chaque mutation.

---

## Synthèse globale — Top 3 findings prioritaires (initiale, AVANT recadrage)

| # | Finding | Gravité initiale | Source queries |
|---|---|---|---|
| 1 | `inscription.update` jamais auditée sur 30j — traçabilité RGPD cassée | MAJEUR | A.10 |
| 2 | `v_inscriptions_production` grants anon+authenticated, mode SECURITY non vérifié | ÉLEVÉ | A.3 + Phase A |
| 3 | `gd_inscriptions.status` sans CHECK enum ni NOT NULL — régression silencieuse possible | MOYEN | A.4 |

## ⚠️ Recadrage post-micro-audit E (2026-04-22) — 2 faux positifs neutralisés

Micro-audit complémentaire E (SECURITY mode vue + policies RLS effectives + grep câblage `auditLog`) a démontré que **findings #1 et #2 sont des faux positifs**. Seul #3 reste valide (faiblesse design non bloquante).

### Faux positif #2 — grants anon/authenticated sur `v_inscriptions_production`

**Fait vérifié** :
- `pg_class.reloptions = ['security_invoker=on']` → vue en SECURITY INVOKER (pas DEFINER)
- `gd_inscriptions` RLS : 1 policy unique `Service role full access` pour `{service_role}`, `qual=true`. Aucune policy `anon`/`authenticated` → RLS bloque 100 % des lectures non-service_role.
- La vue INVOKER propage cette RLS stricte au rôle appelant.

**Règle CLAUDE.md qui neutralise** : § "Règles sécurité & RGPD — GED App" règle 11 :
> « RLS activé + zéro policy = accès client bloqué, service_role bypass RLS → correct et intentionnel. L'alerte Supabase "no policies" sur ces tables est un faux positif à ignorer. »

**Conclusion** : les GRANT SELECT à `anon`/`authenticated` sur la vue sont cosmétiques. Aucune fuite PII possible. **Ne pas re-flagguer dans les audits futurs.**

### Faux positif #1 — `inscription.update` absente de `gd_audit_log` sur 30j

**Fait vérifié** :
- `grep auditLog lib/admin-inscriptions-update.ts` → ligne 116 : `auditLog(supabase, { action:'update', resourceType:'inscription', resourceId:id, actorType:'admin', actorId:authEmail, metadata:{ fields: Object.keys(updateData) } })`
- `app/api/admin/inscriptions/[id]/route.ts:40` : `auditLog` pour `action:'read'`
- Code câblé correctement avec les bons `resourceType` + `action`.

**Contexte utilisateur qui neutralise** : phase test actuelle = aucune inscription online. Équipe GED saisit manuellement en SQL. Aucune update via app ⇒ 0 entrée `inscription.update` dans `gd_audit_log` est **attendu**, pas un bug.

**Conclusion** : le trou apparent RGPD n'existe pas en prod. C'est le reflet du mode test. **Ne pas re-flagguer en phase test ; ré-évaluer dès bascule online.**

### Finding #3 — maintenu (faiblesse design non bloquante)

`gd_inscriptions.status` sans CHECK enum ni NOT NULL. Contrôle uniquement applicatif (Zod). Non critique mais à durcir au Sprint hardening (NOT NULL + CHECK aligné T4 Zod↔SQL).

## Angles morts détectés — résolution après E

- Mode SECURITY de `v_inscriptions_production` : **RÉSOLU** → `security_invoker=on` (sécurisé).
- Contenu policies RLS `gd_inscriptions`, `gd_dossier_enfant`, `gd_souhaits` : **RÉSOLU** → 1 policy service_role-only chacune (design standard GED règle 11).
- `gd_audit_log` sans policy : **RÉSOLU** → conforme règle 11, design voulu (écritures via service_role uniquement côté backend).

## Leçon opérationnelle (pour futurs audits)

**Avant de flagguer P0 en audit Supabase** : lire CLAUDE.md § "Règles sécurité & RGPD" **en priorité** (règle 11 = faux positif Supabase "no policies"). Lancer `grep auditLog` sur le fichier suspect **avant** de conclure que le câblage est absent (vs. simplement non-sollicité en phase test). Matrice de lecture doc par tâche (CLAUDE.md règle #0 quater) ligne "Audit / review" = liste à parcourir obligatoirement.

---

## État inscription anomalie (synthèse)

| Inscription | Pattern | audit_log | status_logs | Verdict |
|---|---|---|---|---|
| `ab2d26f0-cdcf-4ecc-8f89-dc57b06afab7` | triple-NULL, status=validee, 805€ | 0 | 0 | **Isolée**, hors parcours applicatif instrumenté |
| `dc0be421-050c-4250-a5f1-639d3dc5cd4d` | `payment_method=check`, `dossier_ref` OK, 760€ | 2 reads | non vérifié | Workflow chèque nominal |

Décision post-baseline (selon critères définis en amont) : **N=1 + logs vides → branche C ciblée** (investigation `functional-bug-hunter` sur routes admin/inscriptions). B (correction manuelle) reste à faire après C pour inclure dans la correction l'entrée audit_log + status_log rétroactive documentant l'origine.

---

_Généré automatiquement via MCP Supabase execute_sql. Aucune modification code/DB déclenchée par ce runtime check._
