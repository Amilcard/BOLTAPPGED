# 📋 MEMO - Déploiement GED App (1 page)

---

## 🎯 OBJECTIF
Déployer l'application Next.js sur **https://app.groupeetdecouverte.fr**

---

## ✅ CE QUI A ÉTÉ FAIT

### Problème résolu
❌ **"Failed to collect page data for /"** durant `docker build`

### Corrections appliquées
- ✅ Créé `.env.production` → Force mode dynamic
- ✅ Modifié `next.config.js` → Build ID dynamique
- ✅ Modifié `Dockerfile` → Ajout `prisma generate`

### Documentation créée
- ✅ `deploy-vps.sh` → Script auto (9 étapes)
- ✅ `QUICK_START.md` → Guide 3 étapes
- ✅ `DEPLOY_VPS.md` → Guide complet
- ✅ `DIAGNOSTIC.md` → Dépannage
- ✅ `README_DEPLOY.md` → Index
- ✅ `RESUME_EXECUTION.md` → Rapport détaillé

---

## 🚀 CE QU'IL RESTE À FAIRE

### 1️⃣ SUR VOTRE MACHINE LOCALE

```bash
cd /path/to/BOLTAPPGED
git add .
git commit -m "Fix Docker build + deployment docs"
git push origin work
```

**⏱️ Durée : 1 minute**

---

### 2️⃣ SUR LE VPS HOSTINGER

**Ouvrir le terminal web Hostinger et exécuter :**

```bash
cd ~/BOLTAPPGED
git pull origin work
chmod +x deploy-vps.sh
./deploy-vps.sh
```

**⏱️ Durée : 5 minutes (3-5 min de build Docker)**

---

### 3️⃣ VALIDATION

**Ouvrir dans le navigateur :**
```
https://app.groupeetdecouverte.fr
```

**✅ Attendu :** Site fonctionnel + données chargées

---

## 🔍 EN CAS DE PROBLÈME

### Le build Docker échoue
```bash
docker build -t ged-app:latest . 2>&1 | tee build.log
tail -50 build.log
```
→ Voir `DIAGNOSTIC.md`

### Le container s'arrête
```bash
docker logs ged-app
```
→ Vérifier variables `.env`

### 502 Bad Gateway
```bash
docker ps | grep ged-app
docker logs traefik
```
→ Container non démarré ou Traefik

---

## 📚 DOCUMENTATION DISPONIBLE

| Fichier | Utilité | Taille |
|---------|---------|--------|
| **QUICK_START.md** | Déploiement rapide (3 étapes) | 2 KB |
| **DEPLOY_VPS.md** | Guide complet pas-à-pas | 8 KB |
| **DIAGNOSTIC.md** | Dépannage détaillé | 5 KB |
| **deploy-vps.sh** | Script automatique | 4 KB |

---

## ✅ CHECKLIST RAPIDE

- [ ] Push vers GitHub (machine locale)
- [ ] Pull sur VPS (terminal Hostinger)
- [ ] Exécution `./deploy-vps.sh`
- [ ] Vérification `docker ps | grep ged-app`
- [ ] Test `https://app.groupeetdecouverte.fr`

---

## 🎯 RÉSULTAT ATTENDU

**Container actif :**
```
docker ps | grep ged-app
# → Status: Up X minutes
```

**Logs sains :**
```
docker logs ged-app
# → Ready in Xms
```

**Site accessible :**
```
https://app.groupeetdecouverte.fr
# → Page d'accueil avec séjours
```

---

## 📞 AIDE RAPIDE

**Logs en temps réel :**
```bash
docker logs -f ged-app
```

**Redémarrer :**
```bash
docker restart ged-app
```

**Rebuild complet :**
```bash
docker build --no-cache -t ged-app:latest .
```

---

**🎉 PRÊT POUR LE DÉPLOIEMENT !**

**📖 Pour plus de détails, voir :** `README_DEPLOY.md`
