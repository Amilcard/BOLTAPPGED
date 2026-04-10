# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Groupe & Découverte (GED)** is an educational stay management platform for children aged 3-17. It connects social workers (professionals) with families and children to organize educational vacations during school holidays.

### Key Architecture

- **Framework**: Next.js 14 with App Router (server components)
- **Database**: PostgreSQL via Supabase (direct JS client, no ORM)
- **Authentication**: Custom JWT-based auth (not NextAuth) with role-based access
- **Styling**: Tailwind CSS with Radix UI primitives

### Dual Mode Interface

The application serves two distinct audiences:
- **Kids mode** (`mode === 'kids'`): Simplified interface for children/parents (public access)
- **Pro mode** (`mode === 'pro'`): Professional interface for social workers (requires authentication)

## Development Commands

```bash
# Install dependencies (required: legacy peer deps)
npm install --legacy-peer-deps

# Development server
npm run dev

# Build for production
npm run build

# Run production server
npm start

# Linting
npm run lint

# Database: Supabase (PostgreSQL) — schema managed via sql/*.sql migrations
# Execute migrations manually in Supabase SQL Editor
```

## Supabase
- Project ID : voir .env.local (ne pas committer)
- URL : voir NEXT_PUBLIC_SUPABASE_URL dans .env.local
- Dashboard : https://supabase.com/dashboard (projet GED)
- Client : JS direct, no ORM, no Prisma

## Tables critiques (Supabase)
- gd_souhaits (choix_mode, statut, enfant_id, session_id)
- gd_inscriptions (statut, souhait_id, dossier_id)
- gd_stay_sessions (session_id, stay_id, capacity)
- gd_dossier_enfant, gd_structures, gd_stays
- gd_stay_themes, gd_session_prices, gd_waitlist
- Vues : v_activity_with_sessions, v_orphaned_records

## Danger zones — INTERDICTIONS ABSOLUES
- JAMAIS de DELETE FROM sans WHERE explicite validé
- JAMAIS de TRUNCATE sur aucune table
- JAMAIS de UPDATE sans WHERE
- Données ASE = enfants protégés — toute modification en masse interdite
- Supabase project ID actif : voir .env.local — jamais committer l'ID en clair

## Database & Models

### Tables principales (Supabase)
- gd_stays — séjours éducatifs (slug unique, published, period, sourceUrl)
- gd_stay_sessions — sessions par séjour (dates, capacité, seat tracking)
- gd_session_prices — tarifs par session (priceFrom, promo)
- gd_inscriptions — inscriptions professionnels (statut, souhait_id, dossier_id)
- gd_souhaits — souhaits kids (choix_mode, statut, enfant_id, session_id)
- gd_dossier_enfant — dossiers enfants ASE
- gd_structures — structures partenaires (ASE, MECS, foyers)
- gd_waitlist, gd_wishes, gd_admin_2fa, gd_audit_log

### Champs importants gd_stays
- Ingestion : sourceUrl, sourcePdfPath, importedAt, lastSyncAt, sourceManual
- UFOVAL : contentKids (JSON), departureCity, educationalOption
- Pricing : priceFrom (base), complété par prix UFOVAL sessions
- Metadata : themes (JSON array), programme (JSON array)

### Patterns clés
- JSON fields : caster via `as string[]`
- Slug : unique en DB, URLs publiques
- Sessions à venir : filter `startDate: { gte: new Date() }`
- Cascade : gd_stay_sessions supprimées si gd_stays supprimé

## API Architecture

### Route Structure by Access Level

**Public (no auth):**
- `/api/stays` - Stay listings (prices **excluded**)
- `/api/stays/[slug]` - Individual stay details (prices excluded)
- `/api/auth/login` - JWT token generation

**Professional (JWT auth required):**
- `/api/pro/stays` - Stay listings **with** pricing
- `/api/pro/stays/[slug]` - Individual stay with pricing
- `/api/bookings` - Booking CRUD

**Admin (JWT + role check):**
- `/api/admin/stays` - Full CRUD operations
- `/api/admin/sessions` - Session management
- `/api/admin/bookings` - Booking oversight
- `/api/admin/users` - User management
- `/api/admin/stats` - Analytics

**UFOVAL Enrichment:**
- `/api/ufoval-enrichment` - Returns merged UFOVAL data from `out/ufoval/ufoval_enrichment_full.json`

### Authentication Pattern

```typescript
import { verifyAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  const auth = verifyAuth(request);
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentification requise' } },
      { status: 401 }
    );
  }
  // ... protected logic
}
```

### Security Rules

- **Price visibility**: Prices are **never** included in public API responses
- **JWT storage**: Client stores token in `localStorage`
- **Role-based UI**: Admin-only menu items hidden based on user role

## UFOVAL Integration

UFOVAL is an external provider for educational stay data. The integration follows this pipeline:

### Data Pipeline

1. **Extract sessions** (`scripts/ufoval/extract-sessions.ts`):
   - Input: `out/ufoval/rewrite_ready_for_supabase.json`
   - Output: `out/ufoval/ufoval_sessions.json`
   - Extracts dates, prices (base + promo), duration from HTML

2. **Extract departures** (`scripts/ufoval/extract-departures-and-prices.ts`):
   - Input: `out/ufoval/rewrite_ready_for_supabase.json`
   - Output: `out/ufoval/ufoval_departures_prices.json`
   - Extracts departure cities and transport supplements

3. **Merge** (`scripts/ufoval/merge-departures-and-sessions.js`):
   - Combines sessions + departures
   - Output: `out/ufoval/ufoval_enrichment_full.json`
   - **SAFE**: No DB write, JSON output only

4. **API endpoint** (`app/api/ufoval-enrichment/route.ts`):
   - Serves merged JSON to frontend
   - Frontend matches by `sourceUrl`

### Frontend Integration (Pro mode)

In `app/sejour/[id]/stay-detail.tsx`:
- Fetches enrichment data on mount (Pro mode only)
- Displays session prices with promo discounts
- Shows departure cities with transport supplements
- Calculates minimum session price for display

**Price display logic:**
1. Try UFOVAL session prices (prefer `promo_price_eur`, fallback to `base_price_eur`)
2. Fallback to `stay.priceFrom` from database
3. If both missing, show "Tarif communiqué aux professionnels"

## Intégrations

### Resend (emails transactionnels)
- Domaine vérifié : groupeetdecouverte.fr
- FROM : noreply@groupeetdecouverte.fr
- Fichiers clés : lib/email.ts, routes notify-waitlist, pdf-email

### Stripe (paiement)
- Modes : carte, virement, chèque
- Fichiers clés : webhook, payment/create-intent, inscriptions
- Vars : voir .env.example

### URLs
- App prod : app.groupeetdecouverte.fr
- Site vitrine : www.groupeetdecouverte.fr (Hostinger)
- Vercel project : boltappged (compte gedapp)

### Sécurité — points de vigilance
- Auth middleware : risque bypass — maintenir verrouillé
- Routes admin : risque mass-assignment — toujours vérifier
- RLS Supabase : gd_inscriptions, gd_wishes, smart_form_submissions, notification_queue, payment_status_logs — sensibles
- RGPD : données enfants ASE — protection maximale
- Secrets : jamais de fallback hardcodé en prod

## Important Conventions

### File Organization

```
app/
├── api/              # API routes (grouped by domain: admin/pro/public)
├── admin/            # Admin dashboard pages
├── espace-pro/       # Professional interface
├── envies/           # Wishlist (kids mode)
└── sejour/[id]/      # Stay detail pages (public + pro)
```

### TypeScript Patterns

- **Type casting for JSON fields**: `stay.programme as string[]`
- **Optional fields**: `(stay as any).departureCity || null`
- **Date handling**: `.toISOString()` for API responses

### Component Patterns

- **Server components** by default (App Router)
- **'use client'** only when needed (interactivity, hooks)
- **Radix UI** for accessible primitives
- **Lucide React** for icons

## State Management

- **Jotai**: Global state (mode, wishlist, auth)
- **Zustand**: Alternative state management
- **Local storage**: Wishlist persistence, JWT token

## Common Gotchas

1. **Price exclusion**: Always check if endpoint is public before including `priceFrom`
2. **Session dates**: Use `startDate: { gte: new Date() }` for upcoming sessions only
3. **Slug uniqueness**: `slug` is unique in DB, used for public URLs
4. **UFOVAL URL matching**: Normalize trailing slashes when matching `sourceUrl`
5. **Image optimization**: Next.js `<Image>` requires absolute URLs or configured domains

## Testing Data

**Test Accounts:**
- Admin: `admin@gd.fr` / `Admin123!`
- Pro: `pro@gd.fr` / `Pro123!`

## Environment Variables
Voir `.env.example` pour la liste complète.
Variables requises : Supabase (3), NextAuth (2), Stripe (3), Resend (2), Build (1).
Ne jamais committer .env.local ni les vraies clés.

## Troubleshooting

**Dependencies fail to install:**
```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

## Règles de travail

**Branche unique : `main`** — Vercel déploie automatiquement depuis `main`. Ne pas créer de branches, ne pas ouvrir de PR sauf cas exceptionnel.

Vérifier TypeScript avant chaque push : `npx tsc --noEmit`

### Règle anti-divergence (OBLIGATOIRE)

Avant tout travail, vérifier la synchronisation local/remote :
```bash
git fetch origin && git log origin/main..main --oneline && git log main..origin/main --oneline
```
- Si le local est **en retard** → `git pull --ff-only` avant de commencer
- Si le local est **en avance** → pusher d'abord ou demander confirmation
- Si **divergence** (commits des deux côtés) → STOP, alerter l'utilisateur, ne rien faire
- **Après chaque commit** → `git push origin main` immédiatement
- **Ne jamais accumuler** de commits locaux sans les pusher

## Règles de correction

- Diff minimal — ne toucher qu'aux fichiers strictement nécessaires
- Pas de refactor large sans demande explicite
- Non-régression prioritaire
- Commit + push uniquement si le fix est sûr

## Règles sécurité & RGPD — GED App

1. **JAMAIS `console.log` avec PII** — email, nom, prénom, token, données médicales interdits dans les logs. IDs et refs seulement.
2. **`gd_dossier_enfant` → `verifyOwnership()` obligatoire** — pas de guard inline. Centralisation dans `lib/verify-ownership.ts`.
3. **Données Art. 9 → `auditLog()` obligatoire** — sur chaque read/write de `gd_dossier_enfant`, `fiche_sanitaire`, `documents_joints`, Y COMPRIS côté admin.
4. **Collecte données → mention RGPD avant soumission** — bloc informatif + lien `/confidentialite` requis avant tout champ nominatif (inscription, souhait, dossier).
5. **Consentement parental < 15 ans = double vérification** — front (conditionnel) ET back (Zod + guard serveur). Tracer dans `parental_consent_at` + `parental_consent_version`.
6. **Tokens = UUIDs opaques** — jamais nom, email, ID enfant dans les tokens ou URLs publiques.
7. **Exports/listes admin = colonnes minimales** — exclure `fiche_sanitaire`, `fiche_liaison_jeune`, `documents_joints` des SELECT liste. Accès détail uniquement via route spécifique avec auditLog.
8. **Routes admin = `requireEditor` minimum** — jamais `verifyAuth` seul (inclut VIEWER). `requireAdmin` pour les actions destructives.
9. **localStorage = zéro PII** — UUID opaques acceptables, jamais email/nom/données personnelles.
10. **Upload = whitelist MIME + extensions + magic bytes** — toujours vérifier le contenu réel du fichier, pas le MIME déclaré.
11. **RLS actif sur toutes les tables contenant PII** — `gd_inscriptions`, `gd_dossier_enfant` = service_role only. Jamais d'accès anon.
12. **Incident données → `docs/PROCEDURE_VIOLATION_DONNEES.md`** — délai CNIL : 72h. Protocole complet documenté.
13. **Purge RGPD automatique** — audit logs 12 mois, données médicales 3 mois post-séjour. Cron actif et testé.
14. **Session cookie = httpOnly + secure + sameSite strict** — jamais de JWT dans le body de réponse ni dans localStorage.
15. **Toute route admin accédant à des données nominatives doit appeler `auditLog()`** — même en lecture seule.
16. **Réassurance front obligatoire sur chaque écran collectant ou affichant des données** — qui voit quoi, pourquoi on collecte, combien de temps on garde.
17. **Multi-codes structure** — éducateur (suivi_token), CDS (6 chars, toute la structure), directeur (10 chars, tout + gestion codes). Expiration + révocation.

## Token efficiency — PERMANENT, AUTO, NO EXCEPTION
- Tables/listes > prose. Zéro filler. Zéro restatement. Zéro trailing summary.
- Shortest accurate answer wins.
- Ne jamais rescanner des dossiers déjà lus ou exclus de la tâche.
- Ne scanner que les fichiers/dossiers strictement concernés par la tâche.
- Réutiliser les résultats de scan dans la session — ne pas relancer.
- Auto-exclude : node_modules/, .next/, .git/, out/, fichiers générés, caches.
- Si la tâche ne concerne qu'un sous-dossier, ne pas explorer l'arbre complet.
- Adapter au profil utilisateur : business owner non-dev pilotant des projets full-stack via IA → réponses niveau senior tech, zéro pédagogie non sollicitée.
