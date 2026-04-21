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
| 7 | ~~Secrétariat sans route fill dossier~~ | Intent métier non implémenté | ✅ **RÉSOLU 2026-04-19** — `PATCH /api/structure/[code]/inscriptions/[id]/dossier` créée (4 rôles staff autorisés, éducateur exclu, auditLog Art.9) |

**Architect cross-review 2026-04-18** : GO — 488/488 tests verts, tsc clean, aucune régression GET/PATCH voisines.

### Résiduel — résultat cross-review architect

- **Race condition relance** (fenêtre ms entre JS pre-check `Date.now()` et `.update()`) : tolérable car email Resend idempotent côté ESP (Message-ID), pas d'effet visible. Mitigation idéale : `UPDATE ... WHERE last_relance_at < (now - 30min)` atomique côté Postgres. **Backlog post-MVP.**

## P2 MAJEURS — vague 2026-04-18

| # | Item | Statut |
|---|---|---|
| 1 | `runSendProposition` auditLog order | ✅ Déjà fixé vague P1 |
| 2 | `sendPropositionAlertGED` await sans try/catch | ❌ Faux positif — `.catch()` présent L121 |
| 3 | `last_relance_at` race | ✅ Déjà fixé vague P1 |
| 4 | `rgpd_accepted_at` auditLog sous-qualifié | ✅ FIXED — resourceType `structure`, actorId, metadata enrichi |
| 5 | `gd_audit_log` policy `authenticated_read` | ✅ FIXED — migration 078 appliquée (DROP) |
| 6 | 4 routes ownership sans `.is('deleted_at', null)` | ❌ Faux positif — tables incidents/medical/calls/notes n'ont pas `deleted_at` (confirmé via `information_schema`) |
| 7 | `methode` paiement normalisation | ✅ FIXED — `.trim().toLowerCase()` pré-whitelist |

**Architect cross-review P2 GO** : 488/488 tests verts · tsc clean · DB CHECK constraint protège backward compat · `gd_audit_log` = service_role only (aucun caller `authenticated`).

## Items structurels

- [x] `lib/resource-guard.ts` — `requireInscriptionOwnership` (livré 2026-04-18)
- [x] ESLint rule `no-restricted-syntax` sur auth helpers (livré 2026-04-18)
- [x] `scripts/security-sweep.sh` — 3 scans (auth/auditLog/size cap) (livré 2026-04-18)
- [x] `validateBase64Image` + `validateUploadSize` dans `lib/validators.ts` (livrés 2026-04-18)
- [ ] Tests charge Playwright : PDF > 2MB, signature 10MB, upload 50MB (scope E2E)

## Anomalies DB — décision produit requise

| Anomalie | Impact UI | Décision |
|---|---|---|
| ~~22 séjours avec `location_city='annecy'`~~ | Invisible UI | ✅ **RÉSOLU 2026-04-19** — migration 079 NULLify 17 bugs (lowercase), 5 `'Annecy'` conservés car légitimes (Haute-Savoie) |
| ~~`ged_theme` casse incohérente~~ | Invisible UI | ✅ **RÉSOLU 2026-04-19** — migration 080 uniformise UPPERCASE (LAC_MONTAGNE, MER_SURF, NATURE_EQUITATION). Attention : workflow n8n v2 désactivé écrirait les valeurs UFOVAL brutes s'il était réactivé. |
| ~~Séjour Berlin Street Art sans `marketing_title`~~ | Invisible (published=false) | ✅ **RÉSOLU 2026-04-19** — migration 081 DELETE stub (0 FK deps vérifiées). Ré-import possible via n8n UFOVAL si besoin. |
| `/sejours` redirect vers `/` | 3 callers actifs (booking-flow, reserver page) | Garder redirect OU migrer callers vers `/` |
| ~~`/infos` redirect vers vitrine~~ | 1 test E2E + 1 doc | ✅ **RÉSOLU 2026-04-19** — page supprimée (`git rm app/infos/page.tsx`), test K7 redirigé vers `/`, doc Topo nettoyée |

Non corrigés automatiquement dans la vague 2026-04-18 — requièrent validation produit.

## P1 BLOCKERS — audit 2026-04-21 (tests humains Thanh)

| # | Fichier | Issue | Statut |
|---|---|---|---|
| 8 | `lib/structure.ts:80-91, 117-125` | **Directeur/CDS bloqué dès la 1re invitation équipe** : dès qu'une entrée est créée dans `gd_structure_access_codes`, le fallback legacy était désactivé. Workaround DB manuel appliqué 2026-04-21. | ✅ **RÉSOLU 2026-04-21 (commit b8ecf7d)** — guard restreint à `role='direction'`. Le fallback legacy reste actif tant qu'aucune entrée direction migrée n'existe. Symétrie CDS appliquée. |

## Dettes UX — audit 2026-04-21

| # | Zone | Dette | Impact | Urgence |
|---|---|---|---|---|
| M3 | `app/structure/[code]/page.tsx` | Aucun écran côté structure ne liste les propositions tarifaires reçues. Seul canal actuel = email + PDF attaché. Si email perdu → structure ne peut pas consulter. | UX majeure, compense M1/M2 déjà fixés | 🟠 Medium — créer `StructurePropositionsTab` (lecture de `gd_propositions_tarifaires` filtré par `structure_id`), ajouter onglet dans dashboard structure. |

## Dettes RGPD — audit 2026-04-21

| # | Zone | Dette | Impact | Urgence |
|---|---|---|---|---|
| O2 | `supabase.storage[dossier-documents]` | **Aucune purge automatique** des PJ (vaccins, certificat médical, pass nautique) attachées à inscriptions `refusee` ou inactives depuis >X mois. Cron `/api/cron/rgpd-purge` couvre audit_logs / medical_events / login_attempts / notes / calls, mais PAS le storage. | Art. 5.1.e RGPD (limitation conservation). Taille prévisible si activité en croissance : +500KB/dossier. | 🟠 Medium — définir politique rétention par statut (refusee → 90j ; en_attente inactif > 180j → purge), ajouter handler `purgeAbandonedDossierStorage` au cron, audit log purge. Fix = ~2h (pas une rustine). Tracer en Wave 4. |

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
