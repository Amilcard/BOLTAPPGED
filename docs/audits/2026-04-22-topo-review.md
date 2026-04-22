# AUDIT FAISABILITÉ — TOPO V2 GED_APP (2026-04-22)

**Branche** : `audit/topo-2026-04-22`
**Commit base** : `407ba97` (main)
**Source auditée** : `/Users/laidhamoudi/Downloads/TESTS REELS/AUDIT TESTS DETERMINISTES V2 22.docx` (458 lignes)
**Audit battery** : commit `ed9f62b` → `audit-reports/summary.txt`
**MCP utilisés** : git, ged-filesystem, Supabase (read-only : `list_projects`, `list_tables`, `get_advisors`)
**Agents dispatchés (4)** : arch-impact-reviewer, supabase-integrity-auditor, functional-bug-hunter, ux-ui-reviewer

---

## 1. Synthèse exécutive

Le TOPO V2 est **largement valide** (10/14 gaps ACCEPT, 3 CHALLENGE, 1 REJECT) mais **structurellement incomplet** :

1. **6 gaps manquants** détectés par audit déterministe, dont 2 P0 (payment/create-intent sans guard, upload structure uncapped) qui auraient dû figurer en S0.
2. **4 pièges invisibles** (T1-T4 remontés par l'utilisateur) : 3/4 confirmés présents dans le repo, 1 partiellement couvert.
3. **1 faux positif TOPO** : gap #3 hooks React conditionnels `/admin/users` = le code est déjà conforme (commentaire explicite L24 + hooks avant return L66). Alerte Sonar pré-refacto.
4. **Gap chiffre #4** : le TOPO compte 13 `test.skip` mais le grep actuel en trouve 6 → chiffre à recalibrer.
5. **Régression coverage non mentionnée** : 24.71 % Stmts (21 avr, commit fa53960) → 14.29 % actuel. Cause non diagnostiquée.
6. **Sprint S0 remanié recommandé** : absorber payment guard + upload cap + cron délégation AVANT démasquage E2E pour ne pas exposer les failles en preview.
7. **Sprint S3 sous-estimé** : `gd_outbound_emails` impacte 24 fonctions email via `lib/email.ts` → split en S3a (migration+câblage) / S3b (snapshots PDF + request-new-code) recommandé.

**Verdict global : TOPO À RÉVISER avant exécution sprints.** Réouverture de 3 items sur lesquels les décisions TOPO étaient hâtives ; intégration des 6 gaps manquants dans S0/S1.

---

## 2. Méthodologie

Exécution en 2 phases (Q1–Q5 validées en début de session) :

| Phase | Contenu | Durée | Sortie |
|---|---|---|---|
| 1 — Déterministe | 5 spot checks + audit battery (8 scripts) + Supabase MCP | 15 min | Preuves fichier:ligne + advisors prod |
| 2 — 4 agents parallèles | arch-impact / supabase-integrity / functional-bug-hunter / ux-ui-reviewer | 20 min | 4 rapports structurés |
| 2bis — 4 pièges invisibles | Grep ciblé T1-T4 après retour utilisateur | 5 min | Évidences nouvelles non couvertes par battery |
| 3 — Rapport consolidé (ce fichier) | Synthèse + challenges + plan S0 | 15 min | `docs/audits/2026-04-22-topo-review.md` |

**Règles appliquées** (rappel) : Règle #0 95 % confidence · MCP scoping · Anti-pièges 7 checks · Non-invention (preuve fichier:ligne obligatoire) · Zéro code / zéro commit autre que ce rapport.

---

## 3. Phase 1 — Déterministe

### 3.1 Spot checks TOPO (5 + 1 bonus)

| # | Spot check | Résultat | Verdict |
|---|---|---|---|
| 1 | Coverage `24.71 %` (baseline commit fa53960) | Actuel Stmts **14.29 %** — régression –10.4 pts | ⚠️ **RÉGRESSION** non mentionnée TOPO |
| 2 | security-role-escalation `8/8` | 8 tests confirmés | ✅ TOPO exact |
| 3 | Migration `011_processed_events_idempotency.sql` | Existe (4 avr, 448 B) | ✅ TOPO exact |
| 4 | Route `/admin/factures/[id]/send` | Absente (seuls `page.tsx` + `AdminFacturesClient.tsx`) | ✅ VRAI TROU |
| 5 | `delegation_active_until` dans cron expire-codes | 0 match dans `/api/cron/expire-codes/route.ts` | ✅ VRAI TROU |
| bonus | structure-dossier `15/29` | 15 tests confirmés | ✅ TOPO exact |

### 3.2 Audit battery (commit `ed9f62b`)

| Script | Violations | Gravité | Détail |
|---|---|---|---|
| auditlog-coverage | **29 PII missing** | RGPD fort | admin/inscriptions (4), admin/stays (7), admin/users (5), admin/factures paiements (2), pro/request-access, suivi/[token] PATCH |
| silent-catch | **30** (21 console-only + 9 no-action) | Moyen | 9 fail-closed légitimes (rate-limit, password, 2fa, request-access) + 21 console-only gris |
| idempotency | **18 POST non protégés** | Moyen | dossier-enfant submit/upload/pdf-email, inscriptions, structure calls/incidents/medical/notes, souhaits, team reinvite/revoke |
| route-auth | 1 | **P0 critique** | `app/api/payment/create-intent/route.ts:13` sans guard |
| size-caps | 1 | **DoS risk** | `app/api/structure/[code]/inscriptions/[id]/upload/route.ts:58` uncapped |
| cron-secret / pii-logs / role-guards | 0 | ✅ | Bien couvert |

### 3.3 Supabase MCP — confirmations prod (projet `iirfvndgzutbxwfdwawu`)

| Vérification | Résultat prod |
|---|---|
| `gd_outbound_emails` existe ? | **NON** — 41 tables publiques listées, pas elle → gap #8 TOPO définitivement confirmé |
| Pattern RLS deny-all PII | Confirmé sur `gd_inscriptions` (33 rows), `gd_dossier_enfant` (33), `gd_factures` (0) — RLS ON + 0 policy = service_role only |
| Advisors sécurité actifs | 3 : gd_audit_log RLS-no-policy (INFO), gd_session_deletion_log RLS-no-policy (INFO), auth_leaked_password_protection (WARN) — tous déjà tracés `TECH_DEBT.md` |
| gd_souhaits row count | **4 rows** → M2 UNIQUE sans risque massif (vérif doublon trivial) |
| gd_calls / gd_notes | 10 / 3 rows → M4 purge RGPD impact faible mais Art.9 réel |
| gd_audit_log | 671 rows → rétention 12 mois opérationnelle |

---

## 4. Partie 1 — Validation des 14 gaps TOPO

| # | Gap TOPO | Preuve fichier:ligne | Déjà partiel ? | Fragile | Risque rég | Effort plausible | Priorité cohérente | Verdict | Confidence |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `/admin/factures/[id]/send` absente | `app/admin/factures/` ne contient que `page.tsx` + `AdminFacturesClient.tsx` ; pas de `[id]/` | Non | Oui (cascade paiement) | Fort | Oui | Oui (P0) | **ACCEPT** | 100 % |
| 2 | Cron délégation non révoquée | `/api/cron/expire-codes/route.ts` : 0 match `delegation_active_until` | PATCH delegation existe sur route structure | Oui (cron prod) | Moyen | Oui | Oui (P0) | **ACCEPT** | 100 % |
| 3 | Hooks React conditionnels /admin/users | `app/admin/users/page.tsx:24` commentaire « Tous les hooks AVANT tout return conditionnel » + hooks L25-64 + return L66 | Déjà corrigé | — | — | Non (pas de travail) | Non (P1 incorrect) | **REJECT** | 90 % |
| 4 | 13 `test.skip` E2E | Grep actuel trouve **6** `test.skip` (dossier-enfant ×5, parcours-staff-fill ×1) | Partiellement | Non | Faible | Oui | P1 OK, chiffre faux | **CHALLENGE** (chiffre 6 vs 13) | 85 % |
| 5 | `describe.skip` verify-db | `tests/e2e/verify-db.spec.ts:4` confirmé | Non | Non | Faible | Oui | Oui (P1) | **ACCEPT** | 100 % |
| 6 | Tests intégration vides | `tests/integration/` répertoire absent | Non | Non | Faible | Oui | Oui (P1) | **ACCEPT** | 100 % |
| 7 | Snapshot tests PDF absents | 0 `.snap` ni `__snapshots__` dans repo | Non | Non | Moyen | Oui | Oui (P1) | **ACCEPT** | 100 % |
| 8 | `gd_outbound_emails` absente | Grep `.ts/.sql` = 0 + MCP prod confirmé absent | Non | Oui (migration + lib) | Moyen | Oui | Oui (P1) | **ACCEPT** | 100 % |
| 9 | Idempotence souhaits partielle | `souhaits/route.ts:38` dans idempotency.txt UNPROTECTED + pas d'UNIQUE constraint | Non | Oui (migration) | Moyen | Oui | **P2 sous-évaluée** : submit dossier-enfant = double-dossier = P1 | **CHALLENGE** priorité | 90 % |
| 10 | Onglet partage KIDS absent | `app/envies/` = `page.tsx` seul, pas de sous-dossier partage | Non | Non | Faible | Oui | Oui (P2) | **ACCEPT** | 100 % |
| 11 | Route `request-new-code` absente | Grep `request-new-code` dans `app/` = 0 | Non | Non | Faible | Oui | Oui (P2) | **ACCEPT** | 100 % |
| 12 | 4 portes login dispersées | `/login`, `/structure/login`, `/suivi/[token]`, `/activate-invitation` existent | Non | Fort (refacto auth) | Fort | **Sous-estimé** (4→2 = 3-5j min) | P3 OK | **ACCEPT** | 95 % |
| 13 | Sentry enabled production-only | `instrumentation.ts:44,53` `enabled: NODE_ENV === 'production'` | Non | Non | Faible | Non (1 ligne) | P3 OK, effort surestimé | **ACCEPT** | 100 % |
| 14 | `lib/env.ts` non câblé | Grep `import.*lib/env` dans `app/` = 0 | Non | Non | Faible | Non (wiring + test) | Oui (P3) | **ACCEPT** | 100 % |

**Bilan partie 1 : 10 ACCEPT · 3 CHALLENGE · 1 REJECT**

---

## 5. Partie 2 — 6 gaps manquants détectés par audit déterministe

| # | Gap manquant | Preuve | Priorité métier | Sprint reco | Verdict |
|---|---|---|---|---|---|
| A | Coverage régression 24.71 → 14.29 % Stmts | `coverage/coverage-summary.json` ligne 1 + commit fa53960 | **P1** (impératif 10 déterminisme) | S0 (diagnostic cause + quick win) | **INTÉGRER** |
| B | 29 handlers PII sans auditLog | `audit-reports/auditlog-coverage.txt:45-74` — admin/inscriptions × 4, admin/stays × 7, admin/users × 5, admin/factures paiements × 2, pro/request-access, suivi resend | **P0** (RGPD Art.9 violation directe) | S0.5 (nouveau sprint sécurité recommandé) | **INTÉGRER** |
| C | 30 silent-catch (21 console-only + 9 no-action) | `audit-reports/silent-catch.txt:6-38` | **P2** pour fail-closed légitimes (9), **P1** pour `health-checks` × 5 console-only qui masque alerts cron | S2 (tri légitimes vs vrais trous) | **REQUALIFIER** |
| D | 18 POST non idempotents | `audit-reports/idempotency.txt:7-25` — lien direct avec bugs double-submit pendant tests Thanh | **P1** pour dossier-enfant submit/upload, **P2** pour structure notes/calls | S1 submit/upload, S2 notes/calls/incidents | **INTÉGRER** |
| E | `payment/create-intent` missing guard | `audit-reports/route-auth.txt:131-133` — 1 seul MISSING handler | **P0** (impératif 1 — charge Stripe possible sans session valide) | **S0 urgent** | **INTÉGRER** |
| F | `structure/[code]/inscriptions/[id]/upload` uncapped | `audit-reports/size-caps.txt:7-9` — DoS potentiel | **P1** (impératif prelude check [5]) | **S0 urgent** | **INTÉGRER** |

---

## 6. Partie 3 — 4 pièges invisibles (T1-T4 remontés utilisateur)

### T1 — Silence de la Réussite (Success-but-Failed)

**Statut** : partiellement couvert (silent-catch couvre le catch, pas le try). Grep ciblé sur `await supabase.*\.(insert|update|upsert|delete)\(` révèle **des patterns sans assertion post-action** :

| Fichier:ligne | Pattern | Risque |
|---|---|---|
| `app/api/webhooks/stripe/route.ts:28` | `await supabase.from('gd_processed_events').delete()` sans check | Event double-traité si delete silencieux |
| `app/api/souhaits/route.ts:112` | `await supabase.from('gd_souhaits').update(...)` sans check return | Souhait fantôme si RLS filtre |
| `app/api/auth/2fa/disable/route.ts:37` | `await supabase.from('gd_admin_2fa').delete()` sans check | 2FA reste actif silencieusement |
| `app/api/admin/factures/route.ts:101-105` | Transaction manuelle insert lignes + rollback facture, **rollback lui-même non-checké** | Facture orpheline si rollback échoue |

**Recommandation** : nouveau script d'audit `scripts/audit/post-action-assertions.mjs` qui grep `await supabase\..*\.(insert|update|delete)` sans `.select()` aval ni `if (!data)` check. Intégrer à battery. **Sprint S2.**

### T2 — Fragmentation de l'État (State Desync)

**Statut** : partiellement couvert par `gd_processed_events` pour Stripe (claimEvent/rollbackClaim dans webhook). **Non couvert** pour les chaînes multi-système (paiement OK → DB update OK → email Resend KO = client payé sans confirmation).

**Évidence** : aucun pattern de réconciliation de séquence (`payment_ok → db_updated → email_sent`) dans le code. Les 18 POST non idempotents + 29 PII sans auditLog + absence `gd_outbound_emails` créent un effet cocktail : impossible de détecter a posteriori qu'un email n'est pas parti après UPDATE DB.

**Recommandation** : la table `gd_outbound_emails` (gap #8 TOPO) doit porter DEUX rôles, pas un seul :
1. Registre anti double-envoi (déjà prévu TOPO)
2. **Piste de réconciliation** : colonnes `status IN ('sent','failed','skipped')` + `error_text` + `metadata.upstream_ok_at` + cron de détection `status='failed' OR (status='sent' AND upstream_ok_at IS NULL AND created_at < NOW() - 5min)`.

**Sprint recommandé** : S3 étendu (et non S3 simple). Renommer le gap « gd_outbound_emails » en « **registre email + réconciliation cron** ».

### T3 — Illusion du Grep (Sentry quality)

**Statut** : **confirmé comme gap majeur non listé TOPO.**

**Évidence** :
- `lib/sentry-capture.ts` = helper EXCELLENT (typage strict `CaptureDomain`, `CaptureTags`, `CaptureExtra` restreint aux primitives anti-PII, contrat `domain + operation` obligatoire)
- Usage réel : **seulement 4 fichiers** sur un codebase de 90+ routes API + 140 fichiers `lib/`
  - `lib/sentry-capture.ts` (définition)
  - `lib/audit-log.ts`
  - `app/api/webhooks/stripe/route.ts`
  - `app/api/cron/rgpd-purge/route.ts`
- `setTag | setContext | setExtra | withScope` (Sentry API natif) = **0 match** → les développeurs n'appellent pas Sentry directement
- TOPO §1 L15 dit « Sentry captures P0 (paiement, RGPD, audit) ✅ commit 603ebf8 » — **exact** sur le périmètre déclaré (Stripe + RGPD + audit), mais silencieux sur les 29 PII handlers sans auditLog qui n'ont AUCUN captureException en fallback.

**Recommandation** : étendre la règle ESLint ou un script audit `scripts/audit/sentry-coverage.mjs` qui vérifie que tout handler PII mutable a soit un `auditLog()` soit un `captureServerException()` — pas les deux optionnels. Ajouter à battery. **Sprint S1.**

### T4 — Décalage de Réalité Zod/SQL

**Statut** : **confirmé présent** (déjà partiellement détecté M8 supabase-integrity sur `methode`).

**Divergences SQL internes identifiées** (sans même cross-checker Zod) :

| Colonne | Migration | Valeurs | Divergence |
|---|---|---|---|
| `payment_method` | `sql/009_payment_system.sql:8` | `('stripe', 'transfer', 'check')` | 009 vs 010 : **stripe → lyra** |
| `payment_method` | `sql/010_remove_stripe_lyra_migration.sql:60` | `('lyra', 'transfer', 'check')` | Probablement 010 supprime 009 mais non vérifié via MCP execute_sql |
| `role` | `sql/042_structure_access_codes_roles.sql:13` | `('direction', 'cds', 'secretariat', 'educateur')` | 042 vs 069 : **cds_delegated ajouté** |
| `role` | `supabase/migrations/069_access_codes_role_check.sql:17` | `('direction', 'cds', 'cds_delegated', 'secretariat', 'educateur')` | 069 = état prod actuel |
| `methode` (gd_facture_paiements) | `sql/066_factures_tables.sql:97` | `('virement','cb_stripe','cheque')` | Aucune validation Zod côté code = risque 23514 |

**Divergences Zod/SQL détectées** :

| Route Zod | Valeurs Zod | SQL attendu | Divergence |
|---|---|---|---|
| `app/api/admin/inscriptions/manual/route.ts:54` | `['transfer', 'check', 'stripe']` default `'transfer'` | 010 CHECK `('lyra','transfer','check')` | **Zod accepte `stripe`, SQL rejette** |
| `app/api/inscriptions/route.ts:29` | `['card', 'bank_transfer', 'cheque', 'transfer', 'check']` default `'bank_transfer'` | idem | **Zod accepte `card/bank_transfer/cheque`, SQL rejette sans mapping code visible** |

**Recommandation** : agent dédié `zod-sql-drift` à lancer en phase 1 des prochains audits + script `scripts/audit/zod-sql-consistency.mjs` qui parse les `z.enum()` et les CHECK `IN (...)` et flagge les divergences. **Sprint S1 urgent** (risque 23514 prod réel sur paiements manuels).

---

## 7. Partie 4 — 4 faux positifs TOPO re-vérifiés

| # | Claim TOPO | Preuve re-vérifiée | Verdict |
|---|---|---|---|
| FP1 | Flow signature offline via `SIGNED_TO_COMPLETED` OK | `lib/dossier-upload.ts:36-43` mapping `bulletin_signe → bulletin_completed` etc. fonctionnel. Réutilisé dans route staff. | **MAINTENU** (gap résiduel : test E2E manquant, non bloquant) |
| FP2 | Guard envoi proposition OK | `lib/admin-proposition-send.ts:58-59` : `if (prop.status === 'envoyee') return { ok: false, error: 'Proposition déjà envoyée.' }` | **MAINTENU** |
| FP3 | Autosave dossier via `saveBloc(completed)` OK | `components/dossier-enfant/useDossierEnfant.ts:80` signature présente + L157 implémentation `useCallback` | **MAINTENU** — risque mineur fuite timeout non auditée (useRef L119, pas cleanup démont). Non bloquant. |
| FP4 | Email avant UPDATE request-access ordre correct | `app/api/pro/request-access/route.ts:116-147` : INSERT DB L116-141 puis `Promise.allSettled([emails])` L144-147. Ordre correct. | **MAINTENU** (fail-silently INSERT L139-141 intentionnel, commenté) |

**Bilan : 4/4 maintenus.** Aucun FP TOPO à requalifier.

---

## 8. Partie 5 — 5 sprints : faisabilité + ré-ordonnancement

| Sprint | Durée TOPO | Verdict | Ordre optimal | Dépendances | Risques cascade | Ajustement recommandé |
|---|---|---|---|---|---|---|
| **S0** | 2j | **À RÉVISER** | 1. T1-T8 static CI (câbler `.github/workflows/audit-data.yml` → fail si `summary.txt EXIT ≠ 0`) · 2. Fix P0 (gap E payment guard + gap F upload cap + gap #2 cron délégation) · 3. Démasquage E2E par batch de 3 | Baseline fa53960 | Démasquage avant fix P0 = failles exposées en preview | **2.5 j au lieu de 2 j** · inclure gaps E+F+#2 · gap #3 retiré (faux positif) |
| **S1** | 3j | OK | 1. D1-D10 (dossier) · 2. Suivi1-Suivi7 · 3. Fix 29 PII auditLog (gap B prio admin/inscriptions + admin/users) · 4. T4 Zod/SQL fix `payment_method` (divergence 009/010 + Zod) · 5. M5 indexes `created_at` + M7 ownership deleted_at + M8 enum methode | S0 terminé | Modif `lib/email.ts` en S3 pourra casser tests S1 | Intégrer gap B (29 PII auditLog) + T4 Zod/SQL fix |
| **S2** | 3j | À RÉVISER | 1. Créer `tests/integration/` infra (prérequis non listé TOPO) · 2. I1-I5 · 3. Pay1-Pay7 · 4. S7-S12 matrice · 5. Fix 18 idempotency (gap D) · 6. T1 post-action assertions audit script | S0 + S1 | Création dossier integration = dépend config Jest `package.json` (non vérifié) | Infra integration ≠ listée TOPO |
| **S3** | 2j | **SOUS-ESTIMÉ — SPLIT REQUIS** | **S3a (2j)** : M1 migration `gd_outbound_emails` + câblage `lib/email.ts` + cron réconciliation (T2) · **S3b (1.5j)** : snapshots PDF + route `request-new-code` + M2 UNIQUE gd_souhaits | S1 (tests email peuvent casser) | Modif `lib/email.ts` = cascade 15+ routes. M2 UNIQUE = check doublons prod préalable | **3.5 j au lieu de 2 j** |
| **S4** | 2j | OK | 1. K1-K7 (envies) · 2. P1-P8 (suivi_token + pro-request) · 3. A1-A10 (admin) · 4. ~~Migration 076 rls_initplan_fix~~ **résolu** (nomenclature TOPO erronée — `rls_initplan_fix` version `20260418121325` **déjà appliquée** prod, cf §15.1 Q5) | S3 pour P1 snapshot email | Coverage target explicite à poser fin S4 | OK |

**Sprint supplémentaire recommandé — S0.5 sécurité** (0.5j intercalé entre S0 et S1) :
- Fix payment/create-intent guard (gap E)
- Fix upload structure cap (gap F)
- Audit rapide scope 29 PII auditLog (gap B) pour différer le fix S1 si trop lourd
- Activer Sentry sur preview (gap #13) — 1 ligne

**Effort total TOPO** : 12 j annoncés → **16 j ajustés** (S0 **3.5** avec tests/api Q4 + CI coverage gate Q1 + S0.5 0.5 + S1 3 + S2 3 + S3a 2 + S3b 1.5 + S4 2.5). S0 passe de 2.5 à 3.5 j suite aux décisions Q1/Q4 user 2026-04-22 PM.

---

## 9. Partie 6 — Migrations SQL (synthèse agent supabase-integrity)

| # | Migration | Existe ? | DDL minimal | Rollback | Risque | Sprint |
|---|---|---|---|---|---|---|
| M1 | `gd_outbound_emails` + réconciliation (T2) | **NON** (MCP confirmé) | `CREATE TABLE ... (id UUID PK, recipient, template_id, idempotency_key UNIQUE, status, resend_message_id, sent_at, error_text, metadata JSONB, upstream_ok_at)` + index `(recipient, sent_at DESC)` + RLS ON deny-all | `DROP TABLE` | Moyen (cascade 24 fonctions email) | S3a |
| M2 | UNIQUE `gd_souhaits` | **NON** | Clé réelle `(educateur_email, sejour_slug, choix_mode)` avec `NULLS NOT DISTINCT` (PG15+). **⚠️ TOPO proposait `(enfant_id, session_id, choix_mode)` — colonnes INEXISTANTES dans schéma** | `DROP INDEX CONCURRENTLY` | Faible (4 rows prod, check doublons trivial) | S3b |
| M3 | Cron délégation | N/A (modif code) | `.update({ delegation_active_until: null }).lt('delegation_active_until', now).not('delegation_active_until', 'is', null)` dans `expire-codes/route.ts` + auditLog | Revert | Faible | S0 |
| M4 | Purge RGPD `gd_notes` + `gd_calls` | Tables existent (045), purge absente du cron | `DELETE FROM gd_calls WHERE created_at < NOW() - INTERVAL '12 months'` + idem notes (Art.9 = 3 mois médical, 12 mois audit) | Revert patch cron | Fort (RGPD) — volumes actuels faibles (10+3) | S1 |
| M5 | Index `created_at` sur `gd_calls`, `gd_notes` | NON | `CREATE INDEX IF NOT EXISTS idx_{calls,notes}_created_at ON ...` | `DROP INDEX` | Faible | S1 (avant M4) |
| M6 | Route `/admin/factures/[id]/send` + auditLog | NON | Pas de DDL — route API + auditLog `gd_factures` + migration M1 comme dépendance (registre email) | Revert commit | Moyen | S2 |
| M7 | Fix ownership `deleted_at` | N/A (modif code) | 4 routes incidents/medical/calls/notes : ajouter `deleted_at IS NULL` dans ownership check | Revert | Moyen | S1 |
| M8 | Zod enum `methode` + fix divergence Zod/SQL `payment_method` (T4) | N/A (code) | Ajouter Zod `z.enum()` sur `methode` + aligner `payment_method` 2 routes avec SQL CHECK | Revert | Moyen | S1 |

**Migrations oubliées par TOPO** : M4, M5, M7, M8 (détectées par agent supabase-integrity-auditor).

---

## 10. Partie 7 — UX findings (synthèse agent ux-ui-reviewer)

### Gap #3 (REJECT confirmé)
`app/admin/users/page.tsx:24` commentaire explicite + hooks L25-64 avant return L66. Faux positif Sonar S6440 post-refacto.

### Gap #8 signature mixte — frictions UX réelles (non listées TOPO)
| # | Friction | Preuve | Sévérité |
|---|---|---|---|
| F1 | Canvas `h-24` (96 px) étroit mobile | `SignaturePad.tsx:99` | Moyen |
| F2 | Bouton "Effacer" < 44 px tap target | L107-113 (`px-1`, pas de `w-X h-X`) | **Haut (a11y)** |
| F3 | Pas d'`aria-label` canvas | L98-105 | **Haut (a11y)** |
| F4 | Alternative offline non explicite dans UI | `DossierEnfantPanel` | Haut (usabilité parent non-tech) |

### Gap #10 partage KIDS — questions RGPD bloquantes
2 questions à trancher avant tout développement :
- Partage porte sur **séjour** (URL publique) ou **wishlist avec motivation** (donnée personnelle localStorage) ?
- `item.motivation` stockée localStorage = donnée personnelle dans modèle de menace GED ?

Recommandation agent : option B (`navigator.share` séjour uniquement, 1j) avant option A (lien opaque 3-5j, ADR RGPD requis).

### Gap #12 4 portes login — P3 confirmé
Les 4 mécanismes d'auth (JWT, code structure, token opaque, activate) sont fondamentalement distincts. Unification = page d'aiguillage = pas de simplification backend. **Correctif ciblé faible risque** : libellé `/structure/login` clarifié (30 min) + lien "Vous avez reçu un email de suivi ?" vers explication. Refacto complète = 3-5 j + régression sur emails existants.

---

## 11. Partie 8 — Challenges globaux au TOPO

1. **Impératif #1 « Admin/paiement top sans double charge »** → TOPO flag `/admin/factures/[id]/send` mais OUBLIE **`payment/create-intent` sans guard** (gap E). Les DEUX sont P0 impératif 1.
2. **Impératif #9 « Anti double-envoi idempotence »** → TOPO cite « Stripe ✅, proposition ✅, facture ❌, souhait ❌, emails Resend ❌ » mais ne chiffre pas les **29 PII auditLog missing** ni les **18 POST non idempotents**. Les bugs double-submit pendant tests Thanh ont probablement leur source ici (dossier-enfant submit/upload).
3. **Impératif #10 « Parcours déterministe bout-en-bout »** → TOPO flag skips E2E + tests intégration vides + snapshot PDF absents mais OMET **la régression coverage 24.71 → 14.29 % Stmts**. Diagnostic de la cause manquante.
4. **Sprint S0 « 2 j pour débloquer 70 % valeur »** → faux sentiment de sécurité. Sans intégration des gaps P0 manquants (E, F, #2), démasquer les skips expose les failles en preview avant fix. Ordre des items critique.
5. **Sprint S3 « 2 j snapshots + request-new-code + gd_outbound_emails »** → 3 chantiers hétérogènes (migration DB, nouvelle route, framework snapshot) dans 2 j = sous-estimation. Split S3a/S3b.
6. **Tableau §8 « 95 tests »** → comptage réel (K1-K7 + P1-P8 + S1-S12 + A1-A10 + D1-D10 + Pay1-Pay7 + Suivi1-Suivi7 + T1-T8 + I1-I5) = **74 tests** + correctifs E2E = **≈87 tests**, pas 95. Chiffre TOPO arrondi haut.
7. **Pièges invisibles T1-T4** absents TOPO → nécessitent scripts audit dédiés + décisions produit (réconciliation cron, Sentry coverage rule, Zod/SQL drift check).
8. **Hypothèse TOPO « test E2E sur signature offline absent = pas bloquant »** → cohérent tant que `SIGNED_TO_COMPLETED` ne change pas. Mais fragile si refacto upload.

---

## 12. Partie 9 — Plan S0 détaillé (commits atomiques ordonnés)

Périmètre recommandé S0 (**2.5 j au lieu de 2 j**) :

| Ordre | Commit | Scope | Rollback base | Risque |
|---|---|---|---|---|
| 1 | `chore(ci): fail CI when audit-reports/summary.txt EXIT != 0` | `.github/workflows/audit-data.yml` | `407ba97` | LOW — CI seul |
| 2 | `fix(security): add verifyAuth guard on payment/create-intent` (gap E, P0) | `app/api/payment/create-intent/route.ts:13` | 407ba97 | **MED** — route prod critique, test preview obligatoire |
| 3 | `fix(security): cap upload structure inscriptions at 10 MB` (gap F, P0) | `app/api/structure/[code]/inscriptions/[id]/upload/route.ts:58` | après commit 2 | LOW — cap additif |
| 4 | `fix(cron): revoke delegation_active_until expired` (gap #2, P0) | `app/api/cron/expire-codes/route.ts` + auditLog | après commit 3 | MED — cron prod, test dry-run |
| 5 | `test(e2e): unmask batch 1/3 (parcours-inscription-complet)` | `tests/e2e/parcours-inscription-complet.spec.ts` | après commit 4 | MED — échecs attendus |
| 6 | `test(e2e): unmask batch 2/3 (parcours-pro + staff-fill)` | idem | après commit 5 | MED |
| 7 | `test(e2e): unmask batch 3/3 (dossier-enfant + describe.skip verify-db)` | idem | après commit 6 | MED |
| 8 | `test(api): unmask batch 1/2 (tests/api/stays.test.ts ×4 + inscriptions.test.ts)` — Q4 scope élargi | `tests/api/*.test.ts` | après commit 7 | MED — découvre Q4 extension |
| 9 | `test(api): unmask batch 2/2 (rls-security + parcours-complet)` — Q4 scope élargi | `tests/api/rls-security.test.ts`, `tests/api/parcours-complet.test.ts` | après commit 8 | MED |
| 10 | `ci(playwright): retries 2→1 + skip gate threshold 3` | `playwright.config.ts` | après commit 9 | LOW |
| 11 | `ci(coverage): activate coverage-gate.yml (threshold 14%)` — Q1 | `.github/workflows/coverage-gate.yml` (livré dans même session, commit qui finalise branche) | après commit 10 | LOW — CI seul, actif sur PR futurs uniquement |
| 12 | `chore(tech-debt): close gap #3 (hooks /admin/users = false positive Sonar)` | `docs/TECH_DEBT.md` | après commit 11 | LOW — doc seulement |

**Commits 2+3+4 (gaps P0) AVANT commits 5+6+7 (démasquage)** : ordre critique pour ne pas exposer failles en preview.

---

## 13. Partie 10 — Questions bloquantes (confidence < 95 %)

| # | Question | Impact | Confidence actuelle |
|---|---|---|---|
| Q1 | Cause régression coverage 24.71 → 14.29 % Stmts ? (commit fa53960 baseline vs HEAD) | Détermine si S0 rattrape ou S1-S4 couvre | 50 % — diagnostic non fait |
| Q2 | `idempotency_key` pour `gd_outbound_emails` : UUID appelant ou `sha256(recipient + template + DATE)` ? | Bloquant intégration lib/email.ts | 60 % |
| Q3 | Doublons `gd_souhaits` existants avant UNIQUE constraint ? (4 rows prod, vérif MCP execute_sql à lancer) | Risque ajout contrainte | 85 % — bas risque vu volume |
| Q4 | TOPO chiffre 13 skip E2E vs grep actuel 6 → autres fichiers hors scope ? | Cadrage S0 | 85 % |
| Q5 | ~~Migration 076 rls_initplan_fix déjà appliquée prod ?~~ | **RÉSOLU §15.1** | 100 % — MCP user confirmé appliquée, nomenclature TOPO erronée (réel version `20260418121325`) |
| Q6 | Partage KIDS (gap #10) : séjour uniquement ou wishlist avec motivation ? | Bloquant UX #10 + RGPD | 40 % — décision produit |
| Q7 | Fix gaps E+F+#2 en S0 ou dédier un sprint S0.5 ? | Cadence livraison | 80 % |
| Q8 | 29 PII auditLog : attaquer les 29 en 1 vague (S1) ou tri par risque (admin/inscriptions + admin/users d'abord) ? | Charge S1 | 70 % |

---

## 14. Annexes

### A1 — Rapports agents détaillés
- arch-impact-reviewer (agent `a50a0f2a4bcc9c8e0`) — 1500 mots, 5 sprints verdict À RÉVISER
- supabase-integrity-auditor (`ab2044161abae1e3f`) — 1200 mots, M1-M8 migrations + 3 questions bloquantes
- functional-bug-hunter (`a903d2188f4cd6bb0`) — 1800 mots, 10 ACCEPT / 3 CHALLENGE / 1 REJECT sur 14 gaps + 6 gaps manquants + 4 FP maintenus
- ux-ui-reviewer (`a4cb5d81400c43d30`) — 1200 mots, gap #3 REJECT + 4 frictions UX signature

### A2 — Outputs audit battery
`audit-reports/{summary,auditlog-coverage,silent-catch,idempotency,route-auth,size-caps,role-guards,pii-logs,cron-secret}.txt` (commit `ed9f62b`).

### A3 — Supabase MCP calls exécutés
- `list_projects` → projet `iirfvndgzutbxwfdwawu` (groupeetdecouverte)
- `list_tables(public, verbose=false)` → 41 tables, `gd_outbound_emails` absente confirmée
- `get_advisors(security)` → 3 lints actifs (2 INFO RLS + 1 WARN leaked password)

### A4 — Preuves pièges T1-T4
- T1 : `app/api/webhooks/stripe/route.ts:28`, `app/api/souhaits/route.ts:112`, `app/api/auth/2fa/disable/route.ts:37`, `app/api/admin/factures/route.ts:101-105`
- T2 : absence réconciliation cron, couverture partielle via `gd_processed_events` Stripe uniquement
- T3 : `captureServerException|captureServerMessage` usage dans 4 fichiers seulement sur 200+ (lib/sentry-capture.ts, lib/audit-log.ts, webhook Stripe, cron rgpd-purge)
- T4 : divergences `payment_method` 009↔010, `role` 042↔069, `methode` sans Zod, Zod admin/inscriptions/manual accepte `stripe` ≠ SQL 010

---

---

## 15. Addendum — Réponses 8 questions bloquantes + cross-check MCP (2026-04-22 PM)

### 15.1 Décisions user — résolution des 8 questions

| # | Question initiale | Décision user 2026-04-22 | Source verif |
|---|---|---|---|
| Q1 | Cause régression coverage 24.71 → 14.29 % Stmts ? | **Hypothèses** : commits post-fa53960 (d05bf5f, ddacebe, 7b111ee, 81738bc) sans tests / scope jest élargi. **Action S0** : seuil CI coverage ≥ 14 % pour stopper la régression. Diagnostic détaillé à faire avant S0. | user diagnostic |
| Q2 | idempotency_key email | **`sha256(template + resource_id + date_ymd)`** — déterministe, dédup sans coordination, rejouable J+1 | décision |
| Q3 | Doublons `gd_souhaits` prod ? | **0 doublon** via MCP `execute_sql`. UNIQUE sur `(kid_session_token, sejour_slug)` safe. Note : DB utilise `sejour_slug` pas `session_id` (CLAUDE.md corrigé commit `2d4ee32`) | MCP user |
| Q4 | 13 vs 6 skip | **14 skip au total** (7 e2e + 7 api). Les 7 api : `tests/api/stays.test.ts (×4)`, `rls-security.test.ts`, `parcours-complet.test.ts`, `inscriptions.test.ts`. TOPO limitait scope à `tests/e2e/`. Dette silencieuse plus large. **S0 ajusté** pour couvrir `tests/api/` | user grep |
| Q5 | Migration 076 rls_initplan_fix appliquée ? | **Erreur nomenclature TOPO**. `rls_initplan_fix` = version `20260418121325` **appliquée prod**. Migration `076_` actuelle du repo = `smart_form_submissions_rgpd_consent`. Pas de blocage S4 | MCP user |
| Q6 | Partage KIDS scope | **Séjour uniquement** (URL publique `/sejour/[slug]`). **PAS** wishlist+motivation (PII mineur RGPD Art. 8). Wishlist V2 avec consentement parental explicite | décision RGPD |
| Q7 | S0 ou S0.5 ? | **Sprint S0.5 dédié 1j** pour gaps E+F+#2. S0 reste atomique sur faux verts + hooks users + static CI | décision |
| Q8 | 29 PII auditLog | **Tri par risque, 3 vagues** : V1/S1 `admin/inscriptions + admin/users + admin/structures` / V2/S2 `admin/factures + admin/propositions + api/pro` / V3/S3 reste dispersé | décision |

### 15.2 Cross-check MCP post-rapport — 3 découvertes

Le user a (à juste titre) demandé de ne pas se fier aux docs. Cross-check via MCP `list_tables(verbose=true)` sur projet `iirfvndgzutbxwfdwawu` a révélé :

**D1 — CLAUDE.md `gd_inscriptions` drift** : la doc annonçait `(statut, souhait_id, dossier_id)` ; DB réelle contient `status` (pas `statut`), aucun `souhait_id` ni `dossier_id` (relations inverses via `*.inscription_id`). **CHECK prod `payment_method` = `('stripe','transfer','check')`** (et non `('lyra','transfer','check')` comme le laissait croire `sql/010`).

**D2 — CLAUDE.md `gd_structures` manque** : colonne `delegated_to_email` non listée, pourtant présente prod (email du CDS délégué).

**D3 — T4 `payment_method` = faux positif** : mon §6.T4 initial citait une divergence Zod/SQL, mais cross-check code révèle :
- `app/api/inscriptions/route.ts:41-47` contient `PAYMENT_METHOD_MAP` qui transforme `card→stripe`, `bank_transfer→transfer`, `cheque→check` **avant** l'INSERT. Pattern valide.
- `app/api/admin/inscriptions/manual/route.ts:54` accepte `['transfer','check','stripe']` — **matche l'état prod réel**.
- `sql/010_remove_stripe_lyra_migration.sql` (`'lyra','transfer','check'`) **n'est pas l'état prod**. Drift historique potentiellement jamais appliquée ou révertée.

**Conclusion** : pas de divergence Zod/SQL réelle active sur GED_APP au 2026-04-22. Le garde-fou T4 reste valable **à titre préventif** (le script `schema-drift.mjs` v2 détecte 1 drift historique réelle : `gd_structure_access_codes.role` 042→069, évolution volontaire).

### 15.3 Corrections livrées sur branche `audit/topo-2026-04-22`

| Commit | Contenu |
|---|---|
| `d9804f6` | Rapport audit principal (ce fichier avant addendum) |
| `2d4ee32` | CLAUDE.md : règle #0 quater (matrice lecture doc) + #0 quinquies (pièges T1-T4) + fix `gd_souhaits` colonnes |
| `11b5198` | `lib/supabase-guards.ts` + 23 tests — T1 post-action assertions |
| `d3e7297` | `docs/SEMANTIC_GUARDS.md` — 4 pièges T1-T4 documentés avec patterns |
| `a69084a` | 6 scripts audit : `post-action-assertions`, `zod-sql-consistency`, `sentry-coverage`, `state-reconciliation`, `email-outbound-drift`, `schema-drift` |
| `28b6b06` | Migration `085_gd_outbound_emails.sql` + ROLLBACK |
| `000379e` | Cross-check MCP : fix CLAUDE.md `gd_inscriptions` / `gd_structures` ; correction faux positif T4 SEMANTIC_GUARDS ; schema-drift v2 (track table + colonne) |

**État branche** : 8+ commits au total, zéro merge vers `main`. Pre-commit hook vert sur chaque commit (TSC + ESLint + Jest 150 tests + depcruise 375 modules). 1 warning `no-orphans` sur `lib/supabase-guards.ts` (attendu — pas encore câblé, décision explicite de laisser en backlog S1-S3 pour traitement en tandem avec les 3 vagues auditLog, voir §15.4). Review architecturale par agent `arch-impact-reviewer` (2026-04-22) = GO MERGE conditionné : placeholders corrigés dans ce commit.

**Note I1** : commit `11b5198` annonçait 23 tests supabase-guards — comptage réel par fichier = 29 tests (6 describe blocks × 2-7 cases). Divergence cosmétique sans impact runtime, relevée par arch-impact-reviewer.

### 15.4 Items restants (backlog post-audit, hors dette active)

**Livrés dans cette session branche `audit/topo-2026-04-22`** :
- ✅ CI coverage gate seuil ≥ 14 % (`.github/workflows/coverage-gate.yml`, commit `474208e`) — actif sur PR futurs

**Backlog effective (non livré — sera traité S0→S4)** :

| # | Item | Action | Priorité | Sprint |
|---|---|---|---|---|
| B1 | Câbler `lib/supabase-guards.ts` sur routes mutation (23 PII handlers prioritaires) | Refacto progressive route par route (supprime warning depcruise no-orphans) | P1 | S1-S3 (en tandem V1-V3 auditLog) |
| B2 | Appliquer migration 085 `gd_outbound_emails` en prod via MCP `apply_migration` | Après câblage helper + `lib/email.ts` avec `idempotency_key` | P1 | S3a |
| B3 | Diagnostic cause régression coverage (Q1 user) | `npx jest --coverage` + diff commits post-`fa53960` (d05bf5f, ddacebe, 7b111ee, 81738bc) avant S0 | P0 | Pré-S0 |
| B4 | Extension audit `tests/api/` (Q4 user scope élargi : 14 skip total, pas 13) | Démasquer les 7 skip `tests/api/` (stays ×4, rls-security, parcours-complet, inscriptions) en plus des 7 e2e | P1 | S0 |
| B5 | Affiner `zod-sql-consistency.mjs` : support mappings | Reconnaître patterns `PAYMENT_METHOD_MAP`-style pour réduire faux positifs | P3 | S4+ |
| B6 | Affiner `post-action-assertions.mjs` : éviter faux positifs tests | Exclure `tests/` du scope (déjà partiellement fait, à durcir) | P3 | S4+ |

**Gaps détectés par auto-review Q1-Q5 user avant push (2026-04-22 PM)** — honnêtement déclarés en backlog :

| # | Gap | Impact | Priorité | Sprint |
|---|---|---|---|---|
| G1 | **Scripts audit non branchés en CI** | `scripts/audit/all.mjs` auto-découvre les 6 nouveaux mais n'est exécuté par aucun workflow GitHub Actions. Violations détectées ne bloquent pas PR | **P0** | S0 (ajouter job `audit-battery` dans `ci-pr-blocking.yml` ou nouveau `audit-deterministic.yml`) |
| G2 | **`lib/email-outbox.ts` helper absent** | Migration 085 a le schéma SQL, mais aucun helper TS pour `INSERT INTO gd_outbound_emails` avec `idempotency_key = sha256(template + resource_id + date_ymd)` | **P1** | S3a (à co-écrire avec câblage `lib/email.ts` refacto) |
| G3 | **Aucune règle ESLint/lint forcing `assertUpdatedOne`** | Doc CLAUDE.md + SEMANTIC_GUARDS.md documentent l'usage mais aucune contrainte machine. Un dev peut ajouter une mutation Supabase sans guard sans être alerté automatiquement (sauf à lancer `post-action-assertions.mjs` manuellement) | **P2** | S1-S2 (règle custom ou plugin ESLint) |
| G4 | **Split nominal V1/V2/V3 des 29 handlers PII manquant** | §15.1 Q8 + §5 partie 2 listent les **catégories** (admin/inscriptions + admin/users + admin/structures…) mais pas la liste nominale par vague. Le brut existe dans `audit-reports/auditlog-coverage.txt:45-74` | **P1** | S0 (addendum rapport ou PRs S1 avec liste exacte dans body) |
| G5 | **Test intégration RLS silent manquant** | `tests/lib/supabase-guards.test.ts:44` prouve le comportement du helper (throw sur empty array) mais pas de test d'intégration avec vrai Supabase + RLS policy qui renvoie `[]` silencieusement. Test unitaire = proxy pas preuve end-to-end | **P2** | S1 (avec premier câblage B1) |

**Cohérence avec matrice T1-T4 user** (2026-04-22 PM) : G1-G5 confirment que T1 (Success-but-Failed) reste ACTIF au sens « outillé mais pas déployé prod ». Le merge de cette branche livre les outils ; le déploiement effectif est S1+.

### 15.5 Règles nouvelles documentées

Ajout à `CLAUDE.md` :
- **Règle #0 quater** — matrice lecture doc par tâche (10 types couverts)
- **Règle #0 quinquies** — 4 pièges sémantiques T1-T4 + 4 checks additionnels [8]-[11] au Prelude anti-pièges

Nouveau helper `lib/supabase-guards.ts` + doc `docs/SEMANTIC_GUARDS.md` expliquent les 4 patterns avec code snippets.

---

**Fin rapport + addendum.** Branche `audit/topo-2026-04-22` prête pour décision push/merge. Aucun impact prod. Aucune migration appliquée (085 reste fichier SQL non exécuté).
