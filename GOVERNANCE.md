# GOVERNANCE.md — GED App
> Tableau de bord de gouvernance. Lecture obligatoire pour tout agent IA intervenant sur ce projet.
> Dernière mise à jour : 2026-04-15

---

## ÉTAT DU PROJET

| Dimension          | Statut | Dernier audit       |
|--------------------|--------|---------------------|
| Sécurité / RLS     | ✅     | 2026-04-15          |
| Cohérence données  | ✅     | 2026-04-15          |
| Logique métier     | ✅     | 2026-04-15          |
| UI / Charte        | ✅     | 2026-04-13          |
| Tests Jest         | ⚠️     | 3 prioritaires à implémenter (voir section) |
| Crons RGPD         | ✅     | actifs              |

---

## RÈGLES D'INTERVENTION OBLIGATOIRES

1. Lire `CLAUDE.md` avant toute action
2. Vérifier la synchronisation git : `git fetch origin && git log origin/main..main --oneline`
3. Lancer `npx tsc --noEmit` avant chaque push
4. JAMAIS de DELETE/UPDATE sans WHERE explicite
5. JAMAIS de commit sans health checks MCP Supabase si la tâche touche la DB

---

## MATRICE DE DÉCLENCHEMENT — AGENTS & SKILLS

| Type de changement | Agents (ordre) | Mode |
|--------------------|---------------|------|
| `DB_MIG` — migration SQL | `supabase-integrity-auditor` → `functional-bug-hunter` → `arch-impact-reviewer` | séquentiel |
| `API_ROUTE` — route API | `functional-bug-hunter` // `security-review` | parallèle |
| `API_ROUTE` + webhook | + `workflow-integration-reviewer` | séquentiel après |
| `UI_COMP` — composant UI | `ux-ui-reviewer` (charte obligatoire) // `functional-bug-hunter` | parallèle |
| `MAPPER_TYPE` — mapper/types | `arch-impact-reviewer` → `functional-bug-hunter` | séquentiel |
| `AUTH_SECU` — auth/middleware/RLS | `security-review` **[BLOQUE SI FAIL]** → `supabase-integrity-auditor` // `functional-bug-hunter` | séquentiel strict |
| `EMAIL_PDF` — email/PDF | `workflow-integration-reviewer` // `functional-bug-hunter` | parallèle |
| `STRIPE_WH` — webhook Stripe | `workflow-integration-reviewer` → `security-review` → `functional-bug-hunter` | séquentiel |
| `CRON` — crons RGPD | `security-review` → `supabase-integrity-auditor` → `functional-bug-hunter` | séquentiel |
| `VERCEL_CFG` — config Vercel | `deploy-safety-reviewer` → `security-review` | séquentiel |

**Skill `verification-before-completion` obligatoire** après chaque type, avant commit.

---

## HEALTH CHECKS MCP SUPABASE

Lancer via `mcp__claude_ai_Supabase__execute_sql` (project_id : voir `.env.local`) après toute migration ou modification de données.

### HC-1 — Intégrité 3 couches séjours publiés
```sql
SELECT s.slug, s.marketing_title,
  COUNT(DISTINCT ss.id) AS sessions,
  COUNT(DISTINCT sp.id) AS prix
FROM gd_stays s
LEFT JOIN gd_stay_sessions ss ON ss.stay_slug = s.slug
LEFT JOIN gd_session_prices sp ON sp.stay_slug = s.slug
WHERE s.published = true
GROUP BY s.slug, s.marketing_title
HAVING COUNT(DISTINCT ss.id) = 0 OR COUNT(DISTINCT sp.id) = 0;
```
**Attendu : 0 ligne.** Si non nul → séjour publié sans sessions ou sans prix, invisible pour les éducateurs.

### HC-2 — Orphelins référentiels
```sql
SELECT * FROM v_orphaned_records LIMIT 20;
```
**Attendu : 0 ligne.**

### HC-3 — Inscriptions en statut invalide
```sql
SELECT id, status, payment_method, created_at
FROM gd_inscriptions
WHERE status NOT IN (
  'pending','paid','failed','cancelled',
  'validee','refusee','en_attente_paiement','amount_mismatch','en_attente'
)
AND deleted_at IS NULL
ORDER BY created_at DESC LIMIT 20;
```
**Attendu : 0 ligne.** Tout statut inconnu = bug de transition d'état.

### HC-4 — RGPD : données médicales hors délai
```sql
SELECT COUNT(*) AS a_purger, MIN(created_at) AS plus_ancien
FROM gd_medical_events
WHERE created_at < NOW() - INTERVAL '111 days';
```
**Attendu : `a_purger = 0`.** Si non nul → relancer manuellement `GET /api/cron/rgpd-purge`.

### HC-5 — Codes structure expirés non révoqués
```sql
SELECT code, is_test, expires_at
FROM gd_structures
WHERE expires_at < NOW()
  AND revoked_at IS NULL
  AND is_test = false
ORDER BY expires_at ASC;
```
**Attendu : 0 ligne.** Si non nul → le cron `expire-codes` (0 2 * * *) n'a pas tourné.

---

## CHARTE GRAPHIQUE — CHECKLIST OBLIGATOIRE (UI_COMP)

Tout agent modifiant un composant UI vérifie via `ux-ui-reviewer` :

- [ ] Zéro hex hardcode (`#xxxxxx` inline interdit)
- [ ] CTA = `bg-secondary` (terracotta), jamais `bg-primary`
- [ ] Cartes : `rounded-brand` + `shadow-card`
- [ ] Focus ring : `ring-secondary` partout
- [ ] Tap targets ≥ 44px
- [ ] `role="alert"` sur les erreurs
- [ ] Labels sur tous les inputs
- [ ] Mobile-first (base → sm: → md:)
- [ ] Composants shadcn obligatoires : `<Button>`, `<Input>`, `<Select>`, `<Badge>`, `<Tabs>`, `<Skeleton>`
- [ ] Référence complète : `docs/CHARTE_GRAPHIQUE.md` section 15

---

## TESTS JEST — 3 PRIORITAIRES

| Fichier | Couvre | Statut |
|---------|--------|--------|
| `tests/api/webhook-stripe-edge-cases.test.ts` | Rollback Stripe si DB fail, STRIPE_WEBHOOK_SECRET absent | À implémenter |
| `tests/api/structure-code-security.test.ts` | Codes expirés/révoqués, délégation multi-niveaux | À implémenter |
| `tests/unit/middleware-auth-bypass.test.ts` | VIEWER sur /admin, pro_session type invalide, rôle falsifié | À implémenter |

Lancer les tests : `npx jest --testPathPattern='tests/unit' --passWithNoTests`
Lancer les tests API : `npx jest --testPathPattern='tests/api' --testPathIgnorePatterns='parcours-complet|rls-security' --passWithNoTests`
Tests d'intégration (nécessitent Supabase live) : `RUN_INTEGRATION=true npx jest --testPathPattern='parcours-complet|rls-security'`

---

## PRE-COMMIT HUSKY

Installé. Bloque le commit sur :
- Erreurs TypeScript (`tsc --noEmit`)
- Erreurs ESLint sur les fichiers staged
- Tests unitaires en échec

Contournement légitime uniquement : `git commit --no-verify`

---

## DANGER ZONES ABSOLUES

- JAMAIS DELETE/UPDATE/TRUNCATE sans WHERE validé
- JAMAIS modifier le slug UFOVAL (FK partout)
- JAMAIS créer un séjour directement en DB (pipeline n8n — RÈGLE 1 CLAUDE.md)
- JAMAIS committer `.env.local` ou des clés
- JAMAIS `console.log` avec PII (email, nom, token, données médicales)
- JAMAIS contourner `verifyOwnership()` pour `gd_dossier_enfant`
- JAMAIS bypasser `auditLog()` sur données Art. 9
- JAMAIS remplacer ce que fait un workflow n8n (sessions → relancer le workflow)

---

## INCIDENTS & VIOLATIONS DONNÉES

Protocole CNIL 72h → `docs/PROCEDURE_VIOLATION_DONNEES.md`

---

## FAUX POSITIFS AUDITS (ne pas reporter)

| Finding | Raison |
|---------|--------|
| `.env.production` dans git history | Contient uniquement `NEXT_DISABLE_STATIC_PAGE_GENERATION=true` — zéro secret |
| `auth_leaked_password_protection` Supabase | Fonctionnalité réservée aux plans payants Supabase |
| Sub-routes structure : éducateur voit données de toute la structure | Intentionnel — continuité éducative (passation, suivi) |
| `gd_propositions_tarifaires` : alerte "no RLS policies" | RLS activé + zéro policy = service_role only, intentionnel |
