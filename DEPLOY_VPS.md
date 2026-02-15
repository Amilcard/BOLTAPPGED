# 🚀 Guide de déploiement VPS Hostinger

## 📋 Prérequis

- Accès au terminal VPS Hostinger
- Docker installé sur le VPS
- Repository Git BOLTAPPGED cloné dans `~/BOLTAPPGED`
- Fichier `.env` configuré avec les variables d'environnement

---

## 🎯 Déploiement rapide (méthode recommandée)

### Depuis votre machine locale

1. **Pousser les dernières modifications**
   ```bash
   cd /path/to/BOLTAPPGED
   git add .
   git commit -m "Prêt pour déploiement"
   git push origin work
   ```

### Sur le VPS Hostinger (via terminal web)

2. **Se connecter et naviguer vers le projet**
   ```bash
   cd ~/BOLTAPPGED
   ```

3. **Exécuter le script de déploiement**
   ```bash
   chmod +x deploy-vps.sh
   ./deploy-vps.sh
   ```

Le script va automatiquement :
- ✅ Vérifier que vous êtes sur la branche `work`
- ✅ Pull les dernières modifications
- ✅ Arrêter et supprimer l'ancien container
- ✅ Rebuild l'image Docker
- ✅ Démarrer le nouveau container avec Traefik
- ✅ Vérifier que tout fonctionne

**C'est tout ! 🎉**

---

## 🔧 Déploiement manuel (étape par étape)

Si vous préférez contrôler chaque étape :

### 1. Pull des modifications
```bash
cd ~/BOLTAPPGED
git checkout work
git pull origin work
```

### 2. Vérifier le fichier .env
```bash
cat .env | grep -v PASSWORD | grep -v SECRET
```

Vérifiez que ces variables sont présentes :
- `DATABASE_URL`
- `NEXTAUTH_URL` (doit être `https://app.groupeetdecouverte.fr`)
- `NEXTAUTH_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. Arrêter l'ancien container (si existant)
```bash
docker stop ged-app 2>/dev/null || true
docker rm ged-app 2>/dev/null || true
```

### 4. Rebuild l'image Docker
```bash
docker build -t ged-app:latest .
```

⏱️ Cette étape prend **3-5 minutes**. Attendez le message :
```
Successfully built [image-id]
Successfully tagged ged-app:latest
```

### 5. Démarrer le container
```bash
docker run -d \
  --name ged-app \
  --network n8n_default \
  --restart unless-stopped \
  --env-file .env \
  -l "traefik.enable=true" \
  -l "traefik.http.routers.ged-app.rule=Host(\`app.groupeetdecouverte.fr\`)" \
  -l "traefik.http.routers.ged-app.entrypoints=websecure" \
  -l "traefik.http.routers.ged-app.tls.certresolver=myresolver" \
  -l "traefik.http.services.ged-app.loadbalancer.server.port=3000" \
  ged-app:latest
```

### 6. Vérifier que le container tourne
```bash
docker ps | grep ged-app
```

Devrait afficher quelque chose comme :
```
CONTAINER ID   IMAGE              STATUS         PORTS      NAMES
abc123def456   ged-app:latest     Up 10 seconds             ged-app
```

### 7. Vérifier les logs
```bash
docker logs ged-app
```

Vous devriez voir :
```
▲ Next.js 14.x.x
- Local:        http://0.0.0.0:3000
✓ Ready in Xms
```

---

## ✅ Vérification du déploiement

### Test 1 : Connectivité locale
```bash
curl -I http://localhost:3000
```
✅ Attendu : `HTTP/1.1 200 OK` ou `HTTP/1.1 307`

### Test 2 : Accès HTTPS externe
Depuis votre navigateur ou n'importe quelle machine :
```bash
curl -I https://app.groupeetdecouverte.fr
```
✅ Attendu : `HTTP/2 200` ou `HTTP/2 307`

### Test 3 : Vérifier Traefik
```bash
docker logs traefik | grep ged-app
```
✅ Attendu : Logs mentionnant le router `ged-app`

---

## 🔍 Diagnostic en cas de problème

### Le build Docker échoue

**Symptôme:**
```
ERROR: failed to solve: process "/bin/sh -c npm run build" did not complete successfully
```

**Solutions:**
1. Vérifier que vous êtes sur la branche `work` : `git branch`
2. Vérifier que `.env.production` existe : `ls -la .env.production`
3. Lire les logs complets : `docker build -t ged-app:latest . 2>&1 | tee build.log`

**Problèmes connus résolus:**
- ✅ "Failed to collect page data" → Résolu par `.env.production` + `dynamic = 'force-dynamic'`
- ✅ "PrismaClient not generated" → Résolu par `RUN npx prisma generate` dans Dockerfile
- ✅ "Next.js listening on localhost" → Résolu par `HOSTNAME=0.0.0.0`

---

### Le container démarre puis s'arrête

**Diagnostic:**
```bash
docker logs ged-app
```

**Causes courantes:**
- ❌ Variable `DATABASE_URL` incorrecte ou database inaccessible
- ❌ Variable `NEXTAUTH_SECRET` manquante
- ❌ Erreur de syntaxe dans le code

**Solution:**
Vérifier le `.env` et corriger les variables manquantes.

---

### 502 Bad Gateway sur le domaine

**Symptôme:**
`https://app.groupeetdecouverte.fr` retourne une erreur 502

**Diagnostic:**
```bash
# 1. Vérifier que le container tourne
docker ps | grep ged-app

# 2. Vérifier que Next.js répond
docker exec ged-app wget -qO- http://localhost:3000

# 3. Vérifier le réseau Docker
docker network inspect n8n_default | grep ged-app

# 4. Vérifier les logs Traefik
docker logs traefik | tail -50
```

**Causes courantes:**
- Container non démarré
- Container pas sur le réseau `n8n_default`
- Port 3000 non exposé ou mal configuré
- Label Traefik incorrect (vérifier les backticks!)

---

### DNS ne pointe pas vers le VPS

**Symptôme:**
```bash
nslookup app.groupeetdecouverte.fr
# Retourne une IP différente de celle du VPS
```

**Solution:**
1. Aller dans le panneau Hostinger
2. Section DNS
3. Vérifier que le record A `app` pointe vers l'IP du VPS
4. Supprimer le record AAAA conflictuel si présent
5. Désactiver le CDN/proxy pour ce sous-domaine
6. Attendre 5-10 minutes pour la propagation

---

## 🛠️ Commandes utiles

### Gestion du container
```bash
# Voir les logs en temps réel
docker logs -f ged-app

# Redémarrer le container
docker restart ged-app

# Arrêter le container
docker stop ged-app

# Supprimer le container
docker rm ged-app

# Shell dans le container
docker exec -it ged-app sh
```

### Gestion de l'image
```bash
# Lister les images
docker images | grep ged-app

# Supprimer l'ancienne image
docker rmi ged-app:latest

# Rebuild sans cache
docker build --no-cache -t ged-app:latest .
```

### Monitoring
```bash
# Stats en temps réel
docker stats ged-app

# Inspecter le container
docker inspect ged-app

# Voir les processus dans le container
docker top ged-app
```

---

## 📝 Structure du projet déployé

```
~/BOLTAPPGED/
├── .env                    # Variables d'environnement (NE PAS COMMITTER!)
├── .env.production         # Force le mode dynamique pour le build
├── Dockerfile              # Configuration Docker multi-stage
├── next.config.js          # Config Next.js (dynamic build)
├── deploy-vps.sh           # Script de déploiement automatique
├── DIAGNOSTIC.md           # Guide de dépannage détaillé
├── DEPLOY_VPS.md           # Ce fichier
├── app/
│   ├── page.tsx           # Homepage (avec export const dynamic)
│   └── layout.tsx         # Layout racine
└── prisma/
    └── schema.prisma      # Schéma Prisma
```

---

## 🎯 Workflow de mise à jour

### Déploiement d'une nouvelle version

```bash
# 1. Sur votre machine locale
git add .
git commit -m "Description des changements"
git push origin work

# 2. Sur le VPS
cd ~/BOLTAPPGED
./deploy-vps.sh
```

### Rollback en cas de problème

```bash
# 1. Revenir au commit précédent
git log --oneline  # Noter le hash du commit stable
git checkout [hash-du-commit-stable]

# 2. Rebuild et redéployer
docker build -t ged-app:latest .
docker stop ged-app && docker rm ged-app
# Puis relancer avec docker run (voir étape 5 plus haut)
```

---

## 📞 Support

En cas de blocage, voici les informations à collecter :

```bash
# Créer un rapport de diagnostic
echo "=== BUILD INFO ===" > diagnostic.txt
docker images | grep ged-app >> diagnostic.txt
echo -e "\n=== CONTAINER STATUS ===" >> diagnostic.txt
docker ps -a | grep ged-app >> diagnostic.txt
echo -e "\n=== LOGS ===" >> diagnostic.txt
docker logs --tail 100 ged-app >> diagnostic.txt
echo -e "\n=== TRAEFIK ===" >> diagnostic.txt
docker logs --tail 50 traefik >> diagnostic.txt

# Envoyer diagnostic.txt pour analyse
cat diagnostic.txt
```

---

## ✅ Checklist de validation finale

Après déploiement, vérifiez :

- [ ] `docker ps` affiche le container `ged-app` en état `Up`
- [ ] `docker logs ged-app` affiche "Ready in Xms"
- [ ] `curl -I http://localhost:3000` retourne 200/307
- [ ] `curl -I https://app.groupeetdecouverte.fr` retourne 200/307
- [ ] Le site s'affiche correctement dans le navigateur
- [ ] Les données Supabase se chargent (test en navigant)
- [ ] L'authentification fonctionne (si applicable)

**🎉 Si tous les points sont verts → Déploiement réussi !**
