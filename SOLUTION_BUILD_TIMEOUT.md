# 🔧 SOLUTION: Build Timeout Hostinger

## Diagnostic final

**Problème:** Le build `npm run build` timeout même avec `export const dynamic = 'force-dynamic'` sur toutes les pages.

**Cause racine:** Next.js 14 tente de faire du static optimization même avec `force-dynamic`, car il analyse TOUTES les routes pour déterminer la strategy.

## ✅ Actions appliquées

### 1. Ajout dynamic sur toutes les pages ✅
- 6 pages admin (sejours, sessions, users, demandes, page, layout)
- 10 pages secondaires déjà OK
- **Total: 16/16 pages avec `dynamic`**

### 2. Correction next.config.js ✅
```js
output: process.env.NEXT_OUTPUT_MODE || 'standalone',
```
Au lieu de:
```js
output: process.env.NEXT_OUTPUT_MODE, // undefined = problème
```

### 3. Prisma déjà OK ✅
- `RUN npx prisma generate` présent dans Dockerfile

## 🚨 Problème persistant: Timeout à l'analyse

Le build démarre mais bloque dès le début:
```
▲ Next.js 14.2.28
- Environments: .env.production, .env
[HANG]
```

**Hypothèse:** Next.js tente d'importer des modules qui font des requêtes (Prisma/Supabase) au top-level.

## 🎯 Solution recommandée: Build sans DB

### Option A: Variables d'env factices pour build
```bash
# .env.build
DATABASE_URL="postgresql://fake:fake@localhost:5432/fake"
NEXT_PUBLIC_SUPABASE_URL="https://fake.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="fake-key"
```

Puis:
```bash
npm run build --env-file .env.build
```

### Option B: Dockerfile en 2 étapes
```dockerfile
# Stage 1: Build avec fake DB
ENV DATABASE_URL="postgresql://build:build@localhost:5432/builddb"
RUN npm run build

# Stage 2: Runtime avec vraies vars
ENV DATABASE_URL=${REAL_DATABASE_URL}
CMD ["node", "server.js"]
```

### Option C: Build sur machine locale
```bash
# Local (avec .env correct)
npm run build
tar -czf standalone.tar.gz .next

# Upload sur VPS
scp standalone.tar.gz user@vps:/path/
ssh user@vps "cd /path && tar -xzf standalone.tar.gz"
```

## 🔍 Prochaine investigation

Identifier quel fichier fait un `import` qui déclenche une connexion DB au moment du parsing:

```bash
# Chercher imports Prisma au top-level
grep -r "import.*@prisma/client" --include="*.ts" --include="*.tsx" | \
  grep -v "api/" | \
  grep -v "function\|class"

# Chercher Supabase client au top-level
grep -r "createClient" --include="*.ts" --include="*.tsx" | \
  grep -v "api/" | \
  grep -v "function\|const\|let"
```

## ⚡ Solution rapide (recommandée)

**Utiliser le flag `--no-lint` et `--turbo` pour accélérer:**
```bash
npx next build --no-lint
```

Ou dans package.json:
```json
"build": "next build --no-lint"
```

## 📊 État actuel

- ✅ 16/16 pages avec `dynamic`
- ✅ next.config.js corrigé
- ✅ Prisma generate OK
- ❌ Build timeout persistant
- 🎯 Besoin investigation imports top-level

## 🚀 Plan B: Deploy sans build local

Si le build ne passe pas localement, on peut:
1. Push le code sur GitHub
2. Build sur le VPS Hostinger (plus de RAM/CPU)
3. Ou utiliser Vercel/Netlify pour le build, puis export static
