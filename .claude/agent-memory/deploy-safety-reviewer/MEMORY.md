# Memory Index — GED_APP Deploy Safety Reviewer

## Project

- [project_stack.md](project_stack.md) — Stack technique, cible de déploiement, URL prod

## Security & Auth

- [auth_cookie_httponly.md](auth_cookie_httponly.md) — Cookie gd_session non httpOnly : risque XSS connu
- [middleware_weakness.md](middleware_weakness.md) — Middleware Next.js : vérification JWT formelle seulement, pas de signature

## Known Risks

- [deploy_vps_branch_mismatch.md](deploy_vps_branch_mismatch.md) — deploy-vps.sh vérifie branche "work" mais le projet déploie depuis "main"
- [verify_db_page_exposed.md](verify_db_page_exposed.md) — Page /verify-db référencée dans les tests E2E mais absente de l'app

## Testing

- [test_coverage_gaps.md](test_coverage_gaps.md) — Tests manquants critiques : auth login, Stripe CB, /verify-db, unit tests

## Credentials & Secrets

- [secret_leak_env.md](secret_leak_env.md) — .env contient credentials prod réels (Supabase, Stripe, NEXTAUTH_SECRET) — non commité mais présent sur disque
- [env_var_inventory.md](env_var_inventory.md) — Inventaire exhaustif de tous les process.env requis, avec alertes NEXT_PUBLIC_ et variables absentes du .env.example

## Database Schema

- [schema_table_gaps.md](schema_table_gaps.md) — 4 tables utilisées dans le code (gd_souhaits, gd_structures, gd_dossier_enfant, gd_propositions_tarifaires) absentes de prisma/schema.prisma
