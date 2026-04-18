# Backlog Audit — GED App

> Post-mortem obligatoire après chaque vague. Règle : jamais 2 vagues consécutives sans traiter 1 item.
> Référencé par CLAUDE.md § "Post-mortem vague".

## P1 BLOCKERS — issus audit 4-agents 2026-04-18

| # | Fichier | Issue | Statut |
|---|---|---|---|
| 1 | `app/api/auth/educator-invite/route.ts:19` | `requireEditor(req)` sans `await` → bypass auth | ✅ FIXED 2026-04-18 (add `await`) |
| 2a | `lib/admin-proposition-send.ts` | Email avant UPDATE status → doublon retry | ✅ FIXED 2026-04-18 (UPDATE-first pattern, `.in().select()`, email APRÈS lock, auditLog final avec email_status) |
| 2b | `lib/admin-inscriptions-relance.ts` | Même famille : email avant UPDATE last_relance_at | ✅ FIXED 2026-04-18 (UPDATE avant email, JS pré-check conservé) |
| 3a | `app/api/structure/[code]/medical/route.ts` POST | Educateur sans scope `referent_email` | ✅ FIXED 2026-04-18 (helper `requireInscriptionOwnership`) |
| 3b | `app/api/structure/[code]/incidents/route.ts` POST | Même bug | ✅ FIXED 2026-04-18 |
| 3c | `app/api/structure/[code]/calls/route.ts` POST | Même bug (si inscription_id fourni) | ✅ FIXED 2026-04-18 |
| 3d | `app/api/structure/[code]/notes/route.ts` POST | Même bug | ✅ FIXED 2026-04-18 |
| 4 | `app/api/admin/factures/route.ts` PATCH | Aucun auditLog sur status transitions | ✅ FIXED 2026-04-18 (SELECT before + auditLog metadata status_from/to/numero/structure_id) |
| 5 | `app/api/dossier-enfant/[inscriptionId]/pdf-email/route.ts` | Fetch interne 8s timeout silencieux | ✅ FIXED 2026-04-18 (timeout 60s + try/catch + logging body error, 504/502 au lieu de silent 500) |
| 6 | `app/api/dossier-enfant/[inscriptionId]/route.ts` PATCH | Pas de size cap signature PNG | ✅ FIXED 2026-04-18 (`validateBase64Image({max: 500_000})`) |
| 7 | Secrétariat sans route fill dossier | Intent métier non implémenté | 📋 `BACKLOG_ROUTES_MANQUANTES.md` |

**Architect cross-review 2026-04-18** : GO — 488/488 tests verts, tsc clean, aucune régression GET/PATCH voisines.

### Résiduel — résultat cross-review architect

- **Race condition relance** (fenêtre ms entre JS pre-check `Date.now()` et `.update()`) : tolérable car email Resend idempotent côté ESP (Message-ID), pas d'effet visible. Mitigation idéale : `UPDATE ... WHERE last_relance_at < (now - 30min)` atomique côté Postgres. **Backlog post-MVP.**

## P2 MAJEURS

- `runSendProposition` auditLog trompeur (order fix)
- `sendPropositionAlertGED` await sans try/catch
- `last_relance_at` update APRÈS emails (race)
- `rgpd_accepted_at` sans auditLog
- `gd_audit_log` policy `authenticated_read` résiduelle → DROP
- 4 routes (`incidents`/`medical`/`calls`/`notes`) ownership sans `.is('deleted_at', null)`
- `methode` paiement sans normalisation

## Items structurels à livrer

- [ ] `lib/resource-guard.ts` — `requireResourceOwnership({resolved, resource, ownerField})`
- [ ] ESLint rule custom `require-await-auth`
- [ ] `scripts/security-sweep.sh` — pre-commit (grep await, auditLog, validators)
- [ ] Tests charge Playwright : PDF > 2MB, signature 10MB, upload 50MB
- [ ] Validator `validateBase64Image({max: 500_000})` + `validateUploadSize`

## Carryover audits précédents

- W3 UX refacto 3 écrans C (AdminPropositionsClient, ActivateClient, StructureTeamTab)
- 207 `{error:'string'}` migration (sprint XL)
- E2E Playwright 3 parcours (sprint QA)
- Fallback legacy `verifyProSession` removal (post-2026-05-17)
- `cds_delegated` routes direction-only (décision métier)
- Password reset flow
- Session revocation UI
- i18n emails
- Dashboard user actions : Supabase HIBP toggle, Sentry alertes
