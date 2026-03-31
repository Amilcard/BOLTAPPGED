# GED_APP — Architecture Technique

**Dernière mise à jour** : 2026-03-31
**Version** : 1.0

---

## Stack

| Couche | Technologie |
|---|---|
| Framework | Next.js 14 (App Router, Server Components) |
| Base de données | Supabase (PostgreSQL 17.6) |
| Auth | JWT custom (jsonwebtoken + jose) |
| Paiement | Stripe (PaymentIntent) |
| Email | Resend |
| Automatisation | n8n (VPS Hostinger) |
| Déploiement | Vercel (auto sur push main) |
| Infrastructure | VPS Hostinger + Docker + Traefik |
| Tests | Jest (API) + Playwright (E2E) |

---

## Tables Supabase principales

| Table | Rôle |
|---|---|
| `gd_inscriptions` | Inscriptions enfants aux séjours |
| `gd_stays` | Catalogue des séjours |
| `gd_stay_sessions` | Sessions par séjour (dates, âges) |
| `gd_session_prices` | Prix par session et ville de départ |
| `gd_souhaits` | Souhaits kids → éducateurs |
| `gd_structures` | Organisations sociales (regroupement par domaine email) |
| `gd_dossier_enfant` | Dossiers administratifs (4 blocs JSONB) |
| `gd_propositions_tarifaires` | Propositions tarifaires admin → structure |
| `gd_inscription_status_logs` | Audit log des changements de statut |
| `gd_processed_events` | Idempotence webhook Stripe |
| `gd_login_attempts` | Rate limiting login par IP |
| `gd_waitlist` | Liste d'attente sessions complètes |

---

## API Routes principales

### Publiques (sans auth)
- `GET /api/stays` — catalogue séjours (sans prix)
- `GET /api/souhaits/kid/[kidToken]` — souhaits d'un kid
- `POST /api/souhaits` — créer un souhait
- `POST /api/inscriptions` — créer une inscription
- `GET /api/suivi/[token]` — suivi dossier par token

### Éducateur (token dans URL)
- `GET /api/educateur/souhait/[token]` — consulter souhait
- `PATCH /api/educateur/souhait/[token]` — répondre au souhait

### Admin (JWT requis)
- `GET/PUT/DELETE /api/admin/inscriptions/[id]`
- `GET/POST/PUT /api/admin/stays`
- `GET/POST/PUT /api/admin/propositions`
- `GET /api/admin/stats`
- `GET/POST/PUT/DELETE /api/admin/users`
- `GET/POST/PUT /api/admin/structures`

### Webhooks
- `POST /api/webhooks/stripe` — confirmation paiement Stripe

### PDF
- `GET /api/admin/propositions/pdf/[id]`
- `GET /api/dossier-enfant/[id]/pdf`

---

## Authentification

### Admin
- Login : `POST /api/auth/login` → cookie `gd_session` (httpOnly, sameSite: strict, 8h)
- Middleware : `middleware.ts` → `jwtVerify()` (jose) sur `/admin/*`
- Routes API : `verifyAuth()` (jsonwebtoken) sur chaque endpoint admin

### Professionnels / Structures
- Pas de compte — accès par token UUID dans l'URL
- `suivi_token` pour le suivi dossier
- `educateur_token` pour répondre aux souhaits (expire après 30j)
- `access_token` pour accéder aux propositions tarifaires

### Kids
- Pas de compte — `kid_session_token` UUID stocké en localStorage

---

## Sécurité (état au 31 mars 2026)

- JWT : signature HMAC-SHA256 vérifiée (jose + jsonwebtoken)
- Cookie : httpOnly, sameSite: strict, secure en production
- RLS Supabase : toutes les tables sensibles en service_role uniquement
- Webhook Stripe : vérification HMAC signature + idempotence
- Rate limiting login : 5 tentatives / 15 min (table `gd_login_attempts`)
- Soft delete : `gd_inscriptions.deleted_at` (pas de suppression physique)
- Audit log : `gd_inscription_status_logs` (qui, quoi, quand)

---

## Variables d'environnement requises

```env
NEXT_PUBLIC_SUPABASE_URL=          # URL instance Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Clé publique (lectures publiques)
SUPABASE_SERVICE_ROLE_KEY=         # Clé admin (bypass RLS, server only)
NEXTAUTH_SECRET=                   # Secret JWT (min 32 chars)
STRIPE_SECRET_KEY=                 # Clé Stripe server
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=# Clé Stripe client
STRIPE_WEBHOOK_SECRET=             # Secret signature webhook
EMAIL_SERVICE_API_KEY=             # Clé Resend
NEXT_PUBLIC_SITE_URL=              # URL app (pour liens emails)
```

---

## Règles de développement

- **Branche unique** : `main` — push direct, pas de PR
- **Vérification avant push** : `npx tsc --noEmit`
- **Diff minimal** : ne toucher qu'aux fichiers nécessaires
- **Non-régression prioritaire** : préserver le comportement public existant
- **Tests** : `npx jest tests/api/` (21 fichiers) + `npx playwright test`

---

## Points de fragilité connus

1. `deploy-vps.sh` — déploiement VPS manuel, pas automatisé
2. Migrations SQL — exécutées manuellement dans Supabase SQL Editor
3. Sync UFOVAL (sessions, prix, is_full) — scripts n8n, non automatisés
4. Pas de 2FA admin (reporté)
5. Magic link éducateur token visible dans les logs email
