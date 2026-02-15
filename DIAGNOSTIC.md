# Guide de diagnostic - Déploiement GED App

## ✅ Checklist de vérification rapide

### 1. DNS & Réseau
```bash
# Vérifier que le sous-domaine pointe vers le VPS
nslookup app.groupeetdecouverte.fr

# Doit retourner l'IP du VPS (pas celle du CDN)
# Si l'IP est incorrecte → vérifier les DNS records dans Hostinger
```

### 2. Docker & Containers
```bash
# Vérifier que le container tourne
docker ps | grep ged-app

# Voir les logs en temps réel
docker logs -f ged-app

# Vérifier l'état détaillé
docker inspect ged-app
```

### 3. Traefik
```bash
# Vérifier que Traefik voit le service
docker logs traefik | grep ged-app

# Vérifier les routes actives
docker exec traefik cat /etc/traefik/traefik.yml 2>/dev/null || echo "Traefik non accessible"

# Lister les containers sur le réseau n8n_default
docker network inspect n8n_default
```

### 4. Test de connectivité locale
```bash
# Tester que Next.js répond sur le port 3000
curl -I http://localhost:3000

# Doit retourner: HTTP/1.1 200 OK ou 301/302
# Si erreur → problème dans l'app Next.js
```

### 5. Test HTTPS externe
```bash
# Depuis n'importe quelle machine
curl -I https://app.groupeetdecouverte.fr

# Doit retourner: HTTP/2 200 (ou 301)
# Si timeout → problème Traefik ou firewall
# Si 502 Bad Gateway → container non accessible
# Si 404 → router Traefik mal configuré
```

---

## 🔴 Problèmes courants

### Erreur: "Failed to collect page data"
**Cause:** Next.js tente de générer des pages statiques au build et fait des requêtes Supabase

**Solution:**
- Vérifier que `.env.production` existe avec `NEXT_DISABLE_STATIC_PAGE_GENERATION=true`
- Vérifier que `export const dynamic = 'force-dynamic'` est présent dans `app/page.tsx`
- Rebuild l'image: `docker build -t ged-app:latest .`

### Erreur: "PrismaClient is unable to run in this browser environment"
**Cause:** Prisma client non généré dans l'image Docker

**Solution:**
- Vérifier que `RUN npx prisma generate` est présent dans le Dockerfile
- Rebuild l'image

### Erreur: "Host() rule not parsed correctly"
**Cause:** Backticks manquants dans le label Traefik

**Solution:**
```bash
# Vérifier les labels du container
docker inspect ged-app | grep traefik

# Le label doit être:
# traefik.http.routers.ged-app.rule=Host(`app.groupeetdecouverte.fr`)
# Avec des backticks, pas des guillemets simples!
```

### Container démarre puis s'arrête immédiatement
**Cause:** Erreur au runtime (variables d'env manquantes, database non accessible)

**Solution:**
```bash
# Voir les logs complets
docker logs ged-app

# Vérifier le fichier .env
cat .env | grep -v PASSWORD | grep -v SECRET

# Vérifier que DATABASE_URL est correcte
```

### 502 Bad Gateway sur le domaine
**Cause:** Traefik ne peut pas atteindre le container

**Solution:**
```bash
# Vérifier que les containers sont sur le même réseau
docker network inspect n8n_default

# Vérifier que le port 3000 est exposé
docker port ged-app

# Tester la connectivité interne
docker exec traefik ping ged-app
```

---

## 🛠️ Commandes de dépannage

### Redémarrage propre
```bash
# Arrêter et supprimer le container
docker stop ged-app && docker rm ged-app

# Relancer avec les mêmes paramètres
./deploy-vps.sh
```

### Rebuild complet
```bash
# Supprimer l'image et le container
docker stop ged-app
docker rm ged-app
docker rmi ged-app:latest

# Rebuild from scratch
docker build --no-cache -t ged-app:latest .

# Redémarrer
./deploy-vps.sh
```

### Accès shell dans le container
```bash
# Ouvrir un shell dans le container en cours
docker exec -it ged-app sh

# Vérifier les fichiers
ls -la /app

# Vérifier les variables d'environnement
env | grep -E 'DATABASE|NEXTAUTH'

# Tester manuellement Next.js
node server.js
```

### Monitoring en temps réel
```bash
# Logs de tous les services
docker-compose logs -f  # Si vous utilisez docker-compose

# Ou séparément:
docker logs -f ged-app &
docker logs -f traefik &
```

---

## 📊 Vérification de l'état global

```bash
# Script de check complet
echo "=== DNS ==="
nslookup app.groupeetdecouverte.fr

echo -e "\n=== CONTAINERS ==="
docker ps -a | grep -E "ged-app|traefik"

echo -e "\n=== RÉSEAU ==="
docker network ls | grep n8n

echo -e "\n=== TEST LOCAL ==="
curl -I http://localhost:3000 2>&1 | head -1

echo -e "\n=== TEST EXTERNE ==="
curl -I https://app.groupeetdecouverte.fr 2>&1 | head -1

echo -e "\n=== LOGS RÉCENTS ==="
docker logs --tail 20 ged-app
```

---

## 📝 Variables d'environnement requises

Le fichier `.env` doit contenir au minimum :

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/dbname"

# NextAuth
NEXTAUTH_URL="https://app.groupeetdecouverte.fr"
NEXTAUTH_SECRET="votre-secret-aleatoire-32-chars-min"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://votre-projet.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="votre-cle-publique"
SUPABASE_SERVICE_ROLE_KEY="votre-cle-service"
```

---

## 🚨 Contacts & Support

- **Logs détaillés:** `docker logs ged-app > logs.txt`
- **État système:** `docker stats`
- **Documentation Next.js:** https://nextjs.org/docs/app/building-your-application/deploying
- **Documentation Traefik:** https://doc.traefik.io/traefik/
