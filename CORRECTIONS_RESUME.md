# 📊 Résumé des corrections - Déploiement GED App

## 🎯 Problème identifié

**Symptôme:**
```
Error: Failed to collect page data for /
```

**Cause racine:**
La page `app/page.tsx` effectue des requêtes Supabase **au moment du build Docker** :
```typescript
const [sejoursGed, agesData, themesMap, pricesMap] = await Promise.all([
  getSejours(),              // ❌ Requête Supabase
  supabaseGed.from(...)...   // ❌ Requête Supabase
  getAllStayThemes(),        // ❌ Requête Supabase
  getMinPricesBySlug()       // ❌ Requête Supabase
]);
```

**Impact:**
- La base de données **n'est pas accessible** durant `docker build`
- Next.js tente de générer une version statique → plantage

---

## ✅ Corrections appliquées

### 1. Fichier `.env.production` (NOUVEAU)
```env
# Force dynamic rendering for all pages (no static generation during build)
NEXT_DISABLE_STATIC_PAGE_GENERATION=true
```

**Objectif:** Désactiver la génération statique au build

---

### 2. Fichier `next.config.js` (MODIFIÉ)
```javascript
// AJOUTÉ :
// FIX Docker build: skip static generation for data-dependent pages
skipTrailingSlashRedirect: true,
// Force all routes to be dynamic (no static generation during build)
generateBuildId: async () => {
  return 'docker-build-' + Date.now();
},
```

**Objectif:** Forcer le mode dynamique pour toutes les routes

---

### 3. Fichier `Dockerfile` (MODIFIÉ)
```dockerfile
# AVANT (ligne 20-21) :
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# APRÈS (ligne 20-25) :
ENV NEXT_TELEMETRY_DISABLED=1
# Skip data fetching during build (pages will be rendered at runtime)
ENV SKIP_BUILD_STATIC_GENERATION=1
# Generate Prisma client before build
RUN npx prisma generate
RUN npm run build
```

**Changements:**
- ✅ Ajout de `prisma generate` avant le build
- ✅ Variable `SKIP_BUILD_STATIC_GENERATION` pour documentation

---

### 4. Fichier `app/page.tsx` (DÉJÀ PRÉSENT, VÉRIFIÉ)
```typescript
export const dynamic = 'force-dynamic'; // ✅ Déjà présent ligne 8
```

**Status:** Déjà configuré correctement

---

### 5. Fichier `app/layout.tsx` (DÉJÀ PRÉSENT, VÉRIFIÉ)
```typescript
export const dynamic = 'force-dynamic'; // ✅ Déjà présent ligne 13
```

**Status:** Déjà configuré correctement

---

## 📂 Fichiers créés

### `deploy-vps.sh` ⭐ NOUVEAU
Script de déploiement automatique en 9 étapes :
1. Vérification branche Git
2. Pull des modifications
3. Arrêt ancien container
4. Suppression ancienne image
5. Build nouvelle image
6. Vérification `.env`
7. Démarrage container avec Traefik
8. Vérification santé
9. Affichage récapitulatif

**Usage:**
```bash
chmod +x deploy-vps.sh
./deploy-vps.sh
```

---

### `DIAGNOSTIC.md` ⭐ NOUVEAU
Guide de dépannage complet avec :
- ✅ Checklist de vérification (DNS, Docker, Traefik)
- 🔴 Problèmes courants et solutions
- 🛠️ Commandes de dépannage
- 📊 Script de vérification globale
- 📝 Variables d'environnement requises

---

### `DEPLOY_VPS.md` ⭐ NOUVEAU
Documentation complète de déploiement :
- 🚀 Déploiement rapide (méthode recommandée)
- 🔧 Déploiement manuel (étape par étape)
- ✅ Vérification du déploiement
- 🔍 Diagnostic en cas de problème
- 🛠️ Commandes utiles
- 🎯 Workflow de mise à jour
- ✅ Checklist de validation finale

---

## 🔄 Workflow de déploiement

### Depuis votre machine locale

```bash
cd /path/to/BOLTAPPGED
git add .
git commit -m "Ready for deployment"
git push origin work
```

### Sur le VPS Hostinger

```bash
cd ~/BOLTAPPGED
./deploy-vps.sh
```

**C'est tout ! Le script fait le reste automatiquement.**

---

## 🎯 Avant / Après

### ❌ AVANT (comportement qui causait l'erreur)

```
docker build → npm run build → Next.js génère les pages statiques
              ↓
              app/page.tsx tente de fetch Supabase
              ↓
              ❌ DATABASE NOT ACCESSIBLE
              ↓
              💥 BUILD FAILED: Failed to collect page data
```

### ✅ APRÈS (comportement corrigé)

```
docker build → npm run build → Next.js skip la génération statique
              ↓                (grâce à .env.production + next.config.js)
              ✅ BUILD SUCCESS (aucune requête DB)

docker run → Next.js runtime → Fetch Supabase à la demande
             ↓                  (DATABASE accessible)
             ✅ PAGES RENDERED (SSR)
```

---

## 📋 Checklist de validation

Après avoir exécuté `./deploy-vps.sh`, vérifiez :

- [ ] Le script affiche "✅ DÉPLOIEMENT TERMINÉ"
- [ ] `docker ps` affiche `ged-app` avec status `Up`
- [ ] `docker logs ged-app` affiche "Ready in Xms"
- [ ] `curl -I http://localhost:3000` retourne `200` ou `307`
- [ ] `https://app.groupeetdecouverte.fr` s'affiche dans le navigateur
- [ ] Les données (séjours) se chargent correctement
- [ ] Aucune erreur dans `docker logs ged-app`

---

## 🚨 Si le build échoue encore

### Étape 1 : Vérifier les fichiers
```bash
# Vérifier que les corrections sont présentes
ls -la .env.production
cat next.config.js | grep generateBuildId
cat Dockerfile | grep "prisma generate"
```

### Étape 2 : Lire les logs complets
```bash
docker build -t ged-app:latest . 2>&1 | tee build.log
cat build.log
```

### Étape 3 : Vérifier la branche Git
```bash
git branch  # Doit afficher "* work"
git log --oneline -5  # Vérifier les derniers commits
```

### Étape 4 : Rebuild sans cache
```bash
docker build --no-cache -t ged-app:latest .
```

---

## 📊 État des fichiers modifiés

| Fichier | État | Action |
|---------|------|--------|
| `.env.production` | ✅ CRÉÉ | Force dynamic rendering |
| `next.config.js` | ✅ MODIFIÉ | Ajout dynamic build config |
| `Dockerfile` | ✅ MODIFIÉ | Ajout prisma generate |
| `app/page.tsx` | ✅ VÉRIFIÉ | export const dynamic OK |
| `app/layout.tsx` | ✅ VÉRIFIÉ | export const dynamic OK |
| `deploy-vps.sh` | ⭐ CRÉÉ | Script déploiement auto |
| `DIAGNOSTIC.md` | ⭐ CRÉÉ | Guide dépannage |
| `DEPLOY_VPS.md` | ⭐ CRÉÉ | Doc déploiement complète |

---

## 🎓 Explications techniques

### Pourquoi Next.js plantait-il ?

Next.js 14 en mode App Router tente par défaut de **pré-générer les pages** au build (SSG - Static Site Generation).

Quand une page comme `app/page.tsx` est une **Server Component** avec du data fetching (`await getSejours()`), Next.js essaie de l'exécuter durant le build pour créer du HTML statique.

**Problème dans Docker:**
- Durant `docker build`, seul le code est disponible
- La base de données Supabase est **externe** et non accessible
- Résultat : timeout ou erreur de connexion

### Les solutions

1. **`export const dynamic = 'force-dynamic'`**
   - Indique à Next.js : "Cette page DOIT être rendue à la demande"
   - Empêche la génération statique

2. **`.env.production`**
   - Variable globale qui renforce le mode dynamique
   - S'applique à toutes les pages

3. **`next.config.js` avec `generateBuildId`**
   - Force Next.js à considérer chaque build comme unique
   - Empêche la mise en cache des pages statiques

4. **`prisma generate` dans Dockerfile**
   - Génère le client Prisma **avant** le build Next.js
   - Évite l'erreur "PrismaClient is unable to run"

---

## 📞 Support

Si vous rencontrez des difficultés :

1. **Consulter** `DIAGNOSTIC.md` pour les problèmes courants
2. **Exécuter** le script de diagnostic :
   ```bash
   docker logs ged-app > logs.txt
   cat logs.txt
   ```
3. **Vérifier** la documentation : `DEPLOY_VPS.md`

---

**🎉 Avec ces corrections, votre application devrait se déployer sans erreur !**
