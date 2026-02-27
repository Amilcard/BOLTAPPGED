# Base image
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env vars (valeurs factices pour que Next.js compile)
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_BUILD_STATIC_GENERATION=1
ENV NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-key
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ENV DIRECT_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder

# Supprimer les fichiers Deno/Supabase Edge Functions incompatibles avec le build Next.js
RUN rm -rf supabase/
# Generate Prisma client before build
RUN npx prisma generate
RUN npm run build

# Vérifier que standalone existe (échoue explicitement si absent)
RUN test -d .next/standalone || (echo "FATAL: .next/standalone not found!" && exit 1)

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
