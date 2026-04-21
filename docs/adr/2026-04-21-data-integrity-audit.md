# Audit intégrité data — fonction SQL + script CLI

**Date** : 2026-04-21
**Statut** : accepté

## Contexte

Les bugs Thanh (P2, P4, P10) incluent des cas où des données DB incomplètes cassent la logique front (ex: sessions sans prix, structures actives sans email, stays sans image). Aujourd'hui, ces incohérences ne sont détectées qu'en prod, par les utilisateurs.

Besoin : un audit régulier qui catégorise les problèmes data en **blocking** / **warning** / **info**, traçable, scriptable, peu coûteux.

## Options considérées

- **A) Script Node.js avec `pg` direct + raw SQL** — pro : contrôle total ; contre : nouvelle dep, DATABASE_URL à gérer, SQL dupliqué dans repo
- **B) Script Node.js avec Supabase SDK `.from()`** — pro : zéro dep ; contre : CTE impossibles, logique split JS/SQL, perf dégradée
- **C) Fonction SQL en DB + script JS qui appelle `.rpc()`** — pro : SQL en DB versionnable + Supabase dashboard-callable + zéro dep ; contre : SQL et JS séparés
- **D) Supabase Edge Function** — pro : serverless ; contre : over-engineering pour un job interne

## Décision

**Option C** retenue. Migration SQL `084_audit_data_integrity_fn.sql` crée `gd_audit_data_integrity()` (SECURITY DEFINER, service_role only). Script `scripts/audit-data-integrity.ts` (tsx) appelle la fonction via `.rpc`, formate sortie console + JSON.

10 checks initiaux répartis en 3 niveaux :
- **blocking** (count > 0 = fail, exit 1) : stays_published_no_session, sessions_invalid_range, sessions_orphan, sessions_published_no_price_anywhere, stays_age_invalid
- **warning** (count > 0 = fail, exit 0 warning logged) : stays_published_no_image, structures_active_no_email, souhaits_orphan_stay
- **info** (toujours passed, juste tracking) : inscriptions_stale_pending, audit_log_old_rows

## Conséquences

- **Positives**
  - Audit reproductible en 2s (vs. queries manuelles au cas par cas)
  - Appelable depuis Supabase dashboard (SQL editor → `SELECT * FROM gd_audit_data_integrity()`) pour revue admin
  - Script exit code exploitable en CI
  - Nouveau check = 5 lignes de SQL à ajouter dans la fonction
  - Zéro nouvelle dep Node
- **Négatives**
  - SQL et JS séparés (double source à maintenir)
  - Fonction SECURITY DEFINER → auditer chaque ajout de check côté sécu (pas de données sensibles retournées actuellement)
- **Révisable si**
  - Nombre de checks > 30 → refacto en table de configs + boucle
  - Besoin d'alerter auto → brancher sur un channel (GitHub Action + Slack)
  - Performance dégrade (> 5s) → indexer ou matérialiser

## Prochaines étapes hors scope ADR

- GitHub Action hebdomadaire qui lance `npm run audit:data` et commente le rapport JSON
- Slack notification si blocking fail > 0
- Dashboard UI admin (`/admin/data-integrity`) qui lit `gd_audit_data_integrity()`
