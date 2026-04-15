# Session audit & sécurité — 2026-04-15

## Contexte

Sprint de sécurisation post-audit croisé (dev externe + IA).
3 batches de commits. Point de départ : 300/391 tests, 15 suites KO.
Point d'arrivée : 383/391 tests, 0 suite KO.

---

## Commits de la session

| Commit | Contenu |
|---|---|
| `5578bf3` | 7 findings sécurité/RGPD (C1, C2, C6, H4–H7) + 15 suites tests fixées |
| `0b80ac7` | Documentation audit global |
| `dd24a95` | H1 rollback capacité, H3 Turnstile timeout, M6 rate-limit centralisé, M3 factures guard |
| `cb9902e` | jest-axe accessibility — 11 tests, 4 composants |
| `88690ac` | Cron health-checks HC-1→HC-5 (daily 6h UTC) |
| `d09801c` | @next/bundle-analyzer + CI threshold + fix Husky grep |
| `ee6a6be` | C4 numéro urgence réel + M8 purge RGPD notes/calls (migration 069) |

---

## Findings — Verdict final

### Critical

| # | Finding | Verdict | Fix |
|---|---|---|---|
| C1 | Injection PostgREST admin/structures | Réel | Sanitize `[^a-zA-ZÀ-ÿ0-9\s\-']` |
| C2 | PII localStorage (prenom, emailStructure) | Réel | Champs retirés, canAddRequest sur stayId |
| C3 | Policy audit_log USING(true) anon DELETE | **Faux positif** | RLS actif, policy SELECT uniquement (vérifié en base) |
| C4 | Numéro urgence faux (06 12 34 56 78) | Réel | `06 28 05 76 67` — astreinte H24 si connectée |
| C5 | status vs statut mismatch factures | **Faux positif** | Code envoie `{ statut: status }` correctement |
| C6 | Enum paiement UI ≠ API ('Virement' vs 'virement') | Réel | Majuscule corrigée (2 occurrences) |

### High

| # | Finding | Verdict | Fix |
|---|---|---|---|
| H1 | Pas de rollback capacité post-paiement | Réel | Rollback `gd_stay_sessions.seats_available` sur payment_failed |
| H2 | verifyAuth() accepte Bearer + cookie | Débatable | Non fixé — décision architecture en suspens |
| H3 | Turnstile sans timeout/fallback | Réel | Timeout 5s + fallback allow-with-log |
| H4 | Rate-limit price-inquiry non-atomique | Réel | Remplacé par `isRateLimited()` RPC |
| H5 | SELECT * structure expose stripe_payment_intent_id | Réel | Colonnes explicites |
| H6 | error.message dans 7 error.tsx | Réel | Messages génériques + Sentry |
| H7 | Ownership check sans filtre deleted_at | Réel | `.is('deleted_at', null)` sur 4 routes |
| H8 | roles:['admin'] legacy codes | **Faux positif** | Code + base = ['cds','direction'] uniquement (vérifié en base) |
| H9 | sendNewEducateurAlert fire-and-forget | Réel, mitigé | Non fixé — pas de perte données utilisateur |

### Medium (fixés)

| # | Finding | Fix |
|---|---|---|
| M3 | Rate-limit manquant factures | `structureRateLimitGuard()` ajouté |
| M6 | Rate-limit copié-collé inline | Centralisé via `isRateLimited()` |
| M8 | Pas de purge RGPD gd_notes + gd_calls | Migration 069 — notes 12 mois, calls 24 mois |

### Medium (dette — non bloquant)

| # | Finding | Action |
|---|---|---|
| M1 | Format error inconsistant (~40% routes) | Session dédiée |
| M2 | Route inscription 596 lignes | Session dédiée — extraire InscriptionValidator + OwnershipGuard |
| M4 | Dual Supabase client | Session dédiée |
| M5 | Emails silencieux si Resend down | Session dédiée |
| M7 | Zod manquant sur 3 routes | Session dédiée |
| M9 | FK NOT VALID non validées | **SQL prêt — exécuter en maintenance** (voir ci-dessous) |
| M10–M13 | Dette mineure | Backlog |

---

## SQL à exécuter manuellement

### M9 — VALIDATE CONSTRAINT FK (heure creuse)

**Prérequis vérifié le 2026-04-15 : 0 orphelins**

```sql
-- Vérifier avant d'exécuter
SELECT * FROM v_orphaned_records;
-- Attendu : 0 ligne

-- Puis exécuter (pose un ShareLock par ALTER — heure creuse)
ALTER TABLE gd_stay_sessions VALIDATE CONSTRAINT fk_stay_sessions_stay;
ALTER TABLE gd_session_prices VALIDATE CONSTRAINT fk_session_prices_stay;
ALTER TABLE gd_inscriptions VALIDATE CONSTRAINT fk_inscriptions_stay;

-- Vérification post-VALIDATE
SELECT conname, convalidated
FROM pg_constraint
WHERE conname IN (
  'fk_stay_sessions_stay',
  'fk_session_prices_stay',
  'fk_inscriptions_stay'
);
-- Attendu : convalidated = true pour les 3
```

Fichier : `sql/070_validate_fk_constraints.sql`

### Vérifications ponctuelles utiles

```sql
-- HC-1 : séjours publiés sans sessions ou sans prix
SELECT s.slug, s.marketing_title,
  COUNT(DISTINCT ss.id) AS sessions,
  COUNT(DISTINCT sp.id) AS prix
FROM gd_stays s
LEFT JOIN gd_stay_sessions ss ON ss.stay_slug = s.slug
LEFT JOIN gd_session_prices sp ON sp.stay_slug = s.slug
WHERE s.published = true
GROUP BY s.slug, s.marketing_title
HAVING COUNT(DISTINCT ss.id) = 0 OR COUNT(DISTINCT sp.id) = 0;

-- HC-2 : orphelins référentiels
SELECT * FROM v_orphaned_records LIMIT 20;

-- HC-3 : inscriptions statut inconnu
SELECT id, status, payment_method, created_at
FROM gd_inscriptions
WHERE status NOT IN (
  'pending','paid','failed','cancelled',
  'validee','refusee','en_attente_paiement','amount_mismatch','en_attente'
)
AND deleted_at IS NULL
ORDER BY created_at DESC LIMIT 20;

-- HC-4 : données médicales hors délai RGPD (> 111 jours)
SELECT COUNT(*) AS a_purger, MIN(created_at) AS plus_ancien
FROM gd_medical_events
WHERE created_at < NOW() - INTERVAL '111 days';

-- HC-5 : codes actifs expirés (cron KO)
SELECT id, expires_at FROM gd_structure_access_codes
WHERE expires_at < NOW() AND active = true;

-- Rétention notes/calls (décision 2026-04-15)
SELECT 'gd_notes' AS t, COUNT(*) AS total,
  COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '12 months') AS a_purger
FROM gd_notes
UNION ALL
SELECT 'gd_calls', COUNT(*),
  COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '24 months')
FROM gd_calls;

-- Policies actives sur gd_audit_log (vérifié sain)
SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'gd_audit_log'::regclass;

-- Rôles distincts en base (pas de 'admin')
SELECT DISTINCT role FROM gd_structure_access_codes;
```

---

## État infrastructure tests

| Outil | État |
|---|---|
| Jest — 39 suites | 383/391 ✅ (8 skips `stays.test.ts`) |
| Husky pre-commit | unit (119 tests) bloquant sur commit |
| GitHub Actions typecheck | ✅ |
| GitHub Actions eslint | ✅ |
| GitHub Actions bundle-check | ✅ (seuil 4,5 MB total) |
| Playwright E2E | ⚠ config présente, 0 test écrit |

---

## Décisions techniques actées

| Décision | Date | Détail |
|---|---|---|
| Rétention `gd_notes` | 2026-04-15 | 12 mois |
| Rétention `gd_calls` | 2026-04-15 | 24 mois |
| Wishlist kids — localStorage | En attente | Décision archi C2 : option 3 recommandée (UUID opaque + table `gd_wishlist_sessions`) |
| verifyAuth() Bearer | En attente | H2 : décision archi routes API vs navigateur |
