# 📦 Documentation de déploiement - GED App

> **Application Next.js 14 déployée sur VPS Hostinger avec Docker + Traefik**

---

## 🎯 Démarrage rapide

**Vous voulez juste déployer ?** → Lisez **[QUICK_START.md](./QUICK_START.md)** (3 étapes)

---

## 📚 Documentation complète

### 🚀 Guides de déploiement

| Document | Description | Quand l'utiliser |
|----------|-------------|------------------|
| **[QUICK_START.md](./QUICK_START.md)** | Guide ultra-rapide (3 étapes) | Pour déployer rapidement |
| **[DEPLOY_VPS.md](./DEPLOY_VPS.md)** | Guide complet pas-à-pas | Pour comprendre chaque étape |
| **[deploy-vps.sh](./deploy-vps.sh)** | Script de déploiement automatique | À exécuter sur le VPS |

---

### 🔧 Dépannage et maintenance

| Document | Description | Quand l'utiliser |
|----------|-------------|------------------|
| **[DIAGNOSTIC.md](./DIAGNOSTIC.md)** | Guide de diagnostic approfondi | En cas d'erreur ou bug |
| **[CORRECTIONS_RESUME.md](./CORRECTIONS_RESUME.md)** | Détails techniques des corrections | Pour comprendre les fixes |

---

## 🏗️ Architecture du déploiement

```
┌─────────────────────────────────────────────────────────────┐
│                    Internet                                  │
│                       ↓                                       │
│         https://app.groupeetdecouverte.fr                    │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   VPS Hostinger                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Traefik (Reverse Proxy + SSL)                        │  │
│  │  - Port 443 (HTTPS)                                    │  │
│  │  - Gestion certificats Let's Encrypt                   │  │
│  └─────────────────────┬─────────────────────────────────┘  │
│                        ↓                                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Container Docker: ged-app                             │  │
│  │  - Next.js 14 (port 3000)                              │  │
│  │  - Node.js 20                                           │  │
│  │  - Prisma ORM                                           │  │
│  └─────────────────────┬─────────────────────────────────┘  │
└────────────────────────┼─────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              Base de données Supabase (externe)              │
│              - PostgreSQL                                     │
│              - Auth                                           │
│              - Storage                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔑 Variables d'environnement requises

Le fichier `.env` (à créer sur le VPS) doit contenir :

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/database"

# NextAuth
NEXTAUTH_URL="https://app.groupeetdecouverte.fr"
NEXTAUTH_SECRET="votre-secret-minimum-32-caracteres"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://votre-projet.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="votre-cle-anon"
SUPABASE_SERVICE_ROLE_KEY="votre-cle-service"
```

**⚠️ IMPORTANT:** Ne jamais commiter le fichier `.env` sur Git !

---

## 🛠️ Stack technique

### Frontend
- **Next.js 14** (App Router)
- **React 18**
- **TypeScript**
- **Tailwind CSS**

### Backend
- **Next.js API Routes**
- **Prisma ORM**
- **NextAuth.js** (authentification)

### Base de données
- **PostgreSQL** (via Supabase)

### Déploiement
- **Docker** (containerisation)
- **Traefik** (reverse proxy + SSL)
- **VPS Hostinger** (hébergement)

---

## 📋 Workflow de développement

### 1. Développement local

```bash
# Cloner le repo
git clone https://github.com/votre-org/BOLTAPPGED.git
cd BOLTAPPGED

# Installer les dépendances
npm install

# Configurer .env.local
cp .env.example .env.local
# Éditer .env.local avec vos variables

# Générer le client Prisma
npx prisma generate

# Lancer en dev
npm run dev
```

### 2. Tests et validation

```bash
# Linter
npm run lint

# Build local (pour vérifier)
npm run build

# Lancer la version de production localement
npm run start
```

### 3. Déploiement

```bash
# Commit et push
git add .
git commit -m "Description des changements"
git push origin work

# Sur le VPS (via terminal Hostinger)
cd ~/BOLTAPPGED
./deploy-vps.sh
```

---

## 🔍 Commandes de monitoring

### Logs en temps réel
```bash
docker logs -f ged-app
```

### Statistiques du container
```bash
docker stats ged-app
```

### État complet
```bash
docker inspect ged-app
```

### Santé du service
```bash
curl -I https://app.groupeetdecouverte.fr
```

---

## 🚨 Problèmes courants

### 1. "Failed to collect page data"

**Cause:** Next.js tente de générer des pages statiques qui font des requêtes DB au build.

**Solution:** Déjà corrigé par :
- `.env.production` (force dynamic)
- `export const dynamic = 'force-dynamic'` dans les pages
- Configuration `next.config.js`

**Voir:** [CORRECTIONS_RESUME.md](./CORRECTIONS_RESUME.md)

---

### 2. Container démarre puis s'arrête

**Cause:** Variables d'environnement manquantes ou incorrectes

**Solution:**
```bash
# Vérifier le .env
cat .env | grep -v PASSWORD

# Voir les logs
docker logs ged-app
```

**Voir:** [DIAGNOSTIC.md](./DIAGNOSTIC.md) section "Container démarre puis s'arrête"

---

### 3. 502 Bad Gateway

**Cause:** Traefik ne peut pas atteindre le container

**Solution:**
```bash
# Vérifier le réseau Docker
docker network inspect n8n_default | grep ged-app

# Vérifier les labels Traefik
docker inspect ged-app | grep traefik
```

**Voir:** [DIAGNOSTIC.md](./DIAGNOSTIC.md) section "502 Bad Gateway"

---

## 📊 Structure des fichiers de déploiement

```
BOLTAPPGED/
├── 📄 Dockerfile                  # Configuration Docker multi-stage
├── 📄 .dockerignore               # Fichiers exclus du build
├── 📄 next.config.js              # Config Next.js (mode dynamic)
├── 📄 .env.production             # Force dynamic rendering
├── 🔧 deploy-vps.sh               # Script déploiement auto
├── 📚 README_DEPLOY.md            # Ce fichier (index)
├── 📖 QUICK_START.md              # Guide rapide 3 étapes
├── 📖 DEPLOY_VPS.md               # Guide complet
├── 📖 DIAGNOSTIC.md               # Guide dépannage
└── 📖 CORRECTIONS_RESUME.md       # Détails techniques fixes
```

---

## 🎯 Checklist de déploiement

### Avant de déployer

- [ ] Les tests passent localement (`npm run build`)
- [ ] Le code est commité et pushé sur GitHub
- [ ] Le fichier `.env` est configuré sur le VPS
- [ ] La branche `work` est à jour

### Pendant le déploiement

- [ ] Pull réussi sur le VPS
- [ ] Build Docker réussi (3-5 minutes)
- [ ] Container démarré avec succès
- [ ] Logs affichent "Ready in Xms"

### Après le déploiement

- [ ] Site accessible sur `https://app.groupeetdecouverte.fr`
- [ ] Données (séjours) se chargent
- [ ] Authentification fonctionne (si applicable)
- [ ] Aucune erreur dans les logs
- [ ] Test de plusieurs pages

---

## 📞 Support et contacts

### Documentation interne
- **Guide démarrage rapide:** [QUICK_START.md](./QUICK_START.md)
- **Dépannage:** [DIAGNOSTIC.md](./DIAGNOSTIC.md)
- **Déploiement complet:** [DEPLOY_VPS.md](./DEPLOY_VPS.md)

### Ressources externes
- **Next.js Documentation:** https://nextjs.org/docs
- **Docker Documentation:** https://docs.docker.com
- **Traefik Documentation:** https://doc.traefik.io/traefik
- **Supabase Documentation:** https://supabase.com/docs

---

## 🔄 Changelog des corrections

### Version actuelle (Février 2025)

#### Corrections majeures
- ✅ Fix "Failed to collect page data" (ajout `.env.production`)
- ✅ Fix Prisma client generation dans Docker
- ✅ Fix Next.js binding (0.0.0.0 au lieu de localhost)
- ✅ Fix Traefik router rule (backticks corrects)

#### Améliorations
- ⭐ Ajout script `deploy-vps.sh` (déploiement automatique)
- ⭐ Documentation complète (4 guides)
- ⭐ Checklist de validation
- ⭐ Guide de diagnostic détaillé

#### Configuration
- 🔧 Mode dynamic forcé pour toutes les pages
- 🔧 Build ID dynamique dans `next.config.js`
- 🔧 Prisma generate automatique dans Dockerfile

---

## ✅ Validation du déploiement

Pour valider que tout fonctionne :

```bash
# 1. Container actif
docker ps | grep ged-app
# Attendu : status "Up"

# 2. Logs sains
docker logs ged-app | tail -20
# Attendu : "Ready in Xms"

# 3. Connectivité locale
curl -I http://localhost:3000
# Attendu : HTTP/1.1 200 ou 307

# 4. Connectivité externe
curl -I https://app.groupeetdecouverte.fr
# Attendu : HTTP/2 200 ou 307

# 5. Test navigateur
# Ouvrir : https://app.groupeetdecouverte.fr
# Attendu : Site s'affiche + données chargées
```

**🎉 Si tous les tests passent → Déploiement validé !**

---

## 🎓 Pour aller plus loin

### Optimisations futures possibles

1. **Performance**
   - Mise en cache Supabase
   - CDN pour les assets statiques
   - Image optimization Next.js

2. **Monitoring**
   - Logs centralisés (ELK, Grafana)
   - Alertes (email, Slack)
   - Métriques (Prometheus)

3. **CI/CD**
   - GitHub Actions
   - Tests automatiques
   - Déploiement automatique

4. **Sécurité**
   - Rate limiting
   - WAF (Web Application Firewall)
   - Backup automatique database

---

**📝 Note:** Cette documentation est maintenue à jour avec chaque déploiement. Date de dernière mise à jour : Février 2025.
