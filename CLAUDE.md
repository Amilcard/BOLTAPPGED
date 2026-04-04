# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Groupe & Découverte (GED)** is an educational stay management platform for children aged 3-17. It connects social workers (professionals) with families and children to organize educational vacations during school holidays.

### Key Architecture

- **Framework**: Next.js 14 with App Router (server components)
- **Database**: SQLite (dev) / PostgreSQL (prod) via Prisma ORM
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

# Database operations
npx prisma generate          # Generate Prisma client
npx prisma migrate dev       # Run migrations
npx prisma db push          # Push schema without migration (dev only)
npx prisma db seed          # Seed database
npx prisma studio           # GUI for database
```

## Database & Models

### Core Models

```prisma
User      # Admin users (RBAC: ADMIN/EDITOR/VIEWER)
Stay      # Main entity for educational stays
StaySession # Date-based availability with seat tracking
Booking   # Booking records with social worker info
```

### Important Stay Fields

- **Ingestion**: `sourceUrl`, `sourcePdfPath`, `importedAt`, `lastSyncAt`, `sourceManual`
- **UFOVAL**: `contentKids` (JSON), `departureCity`, `educationalOption`
- **Pricing**: `priceFrom` (base price from DB), supplemented by UFOVAL session prices
- **Metadata**: `themes` (JSON array), `programme` (JSON array)

### Key Patterns

- **Cascade deletion**: `StaySession` has `onDelete: Cascade` on `stayId`
- **JSON fields**: Used for flexible data (`programme`, `themes`, `contentKids`)
- **Indexing**: Indexes on `slug`, `published`, `period`, `sourceUrl`, `importedAt`

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

```env
DATABASE_URL="file:./dev.db"  # or PostgreSQL URL
JWT_SECRET="dev-secret-..."
NEXT_PUBLIC_API_URL="http://localhost:3000"
NODE_ENV="development"
```

## Troubleshooting

**Dependencies fail to install:**
```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

**Prisma errors:**
```bash
npx prisma generate
npx prisma migrate reset
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

## Token efficiency (règle permanente)

- Réponses courtes, structurées, sans redondance
- Préférer tableaux/listes à la prose
