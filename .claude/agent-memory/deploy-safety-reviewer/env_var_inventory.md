---
name: Inventaire complet des variables d'environnement
description: Liste exhaustive des process.env utilisées dans le code, avec leur phase (build vs runtime)
type: project
---

## Variables requises à RUNTIME (serveur)

| Variable | Utilisée dans | Sensible |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | lib/supabase.ts, lib/supabaseGed.ts, toutes les API routes | Non (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | lib/supabase.ts, lib/supabaseGed.ts, api/auth/login | Non (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Toutes les API routes admin et dossier-enfant | OUI — critique |
| `NEXTAUTH_SECRET` | api/auth/login, lib/auth-middleware.ts, middleware.ts | OUI — critique |
| `NEXTAUTH_URL` | api/inscriptions/route.ts (fallback prod URL hardcodée) | Non |
| `STRIPE_SECRET_KEY` | api/payment/create-intent, api/webhooks/stripe | OUI — critique |
| `STRIPE_WEBHOOK_SECRET` | api/webhooks/stripe/route.ts | OUI — critique |
| `EMAIL_SERVICE_API_KEY` | lib/email.ts | OUI |
| `ADMIN_NOTIFICATION_EMAIL` | lib/email.ts | Non |
| `DATABASE_URL` | prisma/schema.prisma (pooler) | OUI — critique |
| `DIRECT_URL` | prisma/schema.prisma (migrations) | OUI — critique |

## Variables NEXT_PUBLIC_ (exposées au client)

| Variable | Sensible ? |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Non (URL projet Supabase) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Faiblement — protégé par RLS |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Non (clé publique Stripe) |
| `NEXT_PUBLIC_TEST_MODE` | Non — mais doit être false en prod |
| `NEXT_PUBLIC_IBAN` | Non (info bancaire publique) |
| `NEXT_PUBLIC_BIC` | Non |
| `NEXT_PUBLIC_CHECK_ADDRESS` | Non |
| `NEXT_PUBLIC_SITE_URL` | Non (optionnel, fallback prod hardcodé) |
| `NEXT_PUBLIC_APP_URL` | Non (optionnel, fallback prod hardcodé) |

## Variables absentes du .env.example

- `ORG_BANK_HOLDER` (lib/email.ts:79) — optionnel, fallback 'GROUPE ET DECOUVERTE'
- `ORG_BANK_IBAN` (lib/email.ts:80) — optionnel, fallback message vide
- `ORG_BANK_BIC` (lib/email.ts:81) — optionnel
- `ORG_BANK_BRANCH` (lib/email.ts:82) — optionnel
- `NEXT_PUBLIC_SITE_URL` (api/souhaits/route.ts:88,134) — optionnel
- `NEXT_PUBLIC_APP_URL` (plusieurs routes et lib/email.ts) — optionnel

## Alerte critique

`NEXT_PUBLIC_TEST_MODE=true` est défini dans `.env` — si ce fichier est utilisé en prod (ex: via --env-file .env dans deploy-vps.sh), le mode test serait actif en production.
