# TECH DEBT — GED App

**Budget dette** : max 5 items actifs. Au-delà → sprint résolution avant toute nouvelle feature.
**✅ 2026-04-22 PM : 5/5 R1 OK** (2 items clôturés via ADR — RLS audit_log no-policy + lockfile warning cosmétique).

Format : 1 ligne par item, trié par âge (plus ancien = top priorité).

```
- [AAAA-MM-JJ] <zone> — <description courte> (tag: rustine|refacto|dep|secu|perf)
```

## Actifs

- [2026-04-22] **Pièges sémantiques T1+T2 actifs en prod** (tag: secu, RGPD, accepté jusqu'à S1). T1 Success-but-Failed = helper `lib/supabase-guards.ts` créé (commit `11b5198`) mais **0 route câblée** (grep `@/lib/supabase-guards` = 0 match repo). T2 State Desync = migration `085_gd_outbound_emails` non appliquée prod (MCP `list_migrations` 2026-04-22 confirmé, dernière version prod `20260421164542`) + `lib/email-outbox.ts` absent. **Risques** : dossier fantôme Art.9 si RLS silent sur mutation `gd_dossier_enfant` / paiement Stripe validé sans email Resend confirmation sans possibilité de détection a posteriori. **Deadline résolution** : fin Sprint 1 (cible 2026-05-XX). **Mitigation temporaire** : surveillance Sentry P0 (captures déjà en place commit `603ebf8` sur webhook Stripe + RGPD + audit) + support client manuel si escalation. **Détail complet** : `docs/audits/2026-04-22-topo-review.md` §6 T1-T2 + §15.4 (backlog B1+B2+G2+G3+G5) + §15.6 liste V1/V2/V3 câblage. Ref PR #51 merge `37ab497`.
- [2026-04-22] `lib/email-suppress.ts` — suppression email temporaire Cordée + Clairière (tag: rustine, operational). Bloque tout envoi vers `o.geoffroy.lce@gmail.com`, `@fondationdiaconesses.org`, `@mecs-laclairiere.fr` pendant résolution des bugs prod. Revert : vider `EMAIL_SUPPRESSION_RULES` + commit → redeploy. **Action** : supprimer dès que les bugs signalés sont clos et que l'utilisateur confirme la reprise.
- [2026-04-21] `tests/e2e/*` — 85/130 tests E2E en échec depuis run 2026-04-19 (tag: tests). Fichiers 0-passant : `reservation-{kids,pro,virement}`, `dossier-enfant`, `verify-db`, `parcours-staff-fill`, `parcours-inscription-complet`. Décision dans `docs/adr/2026-04-21-e2e-smoke-only.md`. Action : restaurer par lot avant sprint F1 complet.
- [2026-04-21] Supabase Auth — "Leaked password protection" désactivée (tag: secu). Feature **Pro plan uniquement** ($25/mois), pas activable en Free. Thanh R1 (P14.3) partiellement mitigé par policy actuelle (12+ chars + maj/min/chiffre/spécial). Options : (A) upgrade Pro, (B) implémenter check HIBP custom server-side (k-anonymity API, gratuit, 2-4h dev), (C) accepter WARN. Décision : **C pour l'instant**, B en sprint si besoin fermeture.
- [2026-04-21] 31 structures `status=active` sans email — détecté par `gd_audit_data_integrity()`. Impact : éducateurs non contactables depuis l'admin (tag: data). Action : audit + backfill ou passer statut à `inactive` si vraies orphelines.

## Résolus

- [2026-04-22] RLS sans policy sur `gd_audit_log` + `gd_session_deletion_log` (ouvert 2026-04-21) — **clôturé** via ADR `docs/adr/2026-04-22-audit-log-rls-no-policy.md` : pattern service_role only + zéro policy = deny-all anon/authenticated + bypass service_role, conforme CLAUDE.md §11. Advisor Supabase INFO = faux positif structurel.
- [2026-04-22] `next build` warning "multiple lockfiles" (ouvert 2026-04-21) — **clôturé** via ADR `docs/adr/2026-04-22-lockfile-warning-cosmetic.md` : cosmétique, zéro runtime impact, fix cross-zone `next.config.mjs` différé à session config Next.js dédiée.

---

## Règles

1. **R1** — Max 5 items actifs. Au-delà = freeze nouvelle feature jusqu'à résorption.
2. **R2** — Toute rustine (`// FIXME:`, `// TODO: hack`, try/catch silencieux) crée une ligne ici **le jour même**.
3. **R3** — Refacto uniquement si bloquant pour une feature demandée. Pas de refacto "pour faire propre".
4. **Revue hebdo** : lundi 10min, trier, clôturer, prioriser.
