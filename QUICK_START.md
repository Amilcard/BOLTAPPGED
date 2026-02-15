# ⚡ Quick Start - Déploiement GED App

> **Pour déployer rapidement, suivez uniquement les 3 étapes ci-dessous**

---

## 1️⃣ Sur votre machine locale

```bash
cd /path/to/BOLTAPPGED
git add .
git commit -m "Deploy to production"
git push origin work
```

---

## 2️⃣ Sur le VPS Hostinger (terminal web)

```bash
cd ~/BOLTAPPGED
git pull origin work
chmod +x deploy-vps.sh
./deploy-vps.sh
```

---

## 3️⃣ Vérification

Ouvrez dans votre navigateur :
```
https://app.groupeetdecouverte.fr
```

✅ **Si le site s'affiche → Déploiement réussi !**

---

## 🔍 En cas de problème

### Le script deploy-vps.sh échoue au build

```bash
# Voir les logs détaillés du build
docker build -t ged-app:latest . 2>&1 | tee build.log
tail -50 build.log
```

**Consulter:** `DIAGNOSTIC.md` section "Erreur: Failed to collect page data"

---

### Le container démarre puis s'arrête

```bash
# Voir pourquoi le container s'est arrêté
docker logs ged-app
```

**Causes fréquentes:**
- Variable `DATABASE_URL` incorrecte dans `.env`
- Variable `NEXTAUTH_SECRET` manquante dans `.env`

---

### 502 Bad Gateway sur le domaine

```bash
# Vérifier que le container tourne
docker ps | grep ged-app

# Vérifier les logs
docker logs ged-app
docker logs traefik
```

**Causes fréquentes:**
- Container non démarré
- Problème de configuration Traefik

---

## 📚 Documentation complète

- **Déploiement pas-à-pas:** Voir `DEPLOY_VPS.md`
- **Dépannage avancé:** Voir `DIAGNOSTIC.md`
- **Détails techniques:** Voir `CORRECTIONS_RESUME.md`

---

## 🛠️ Commandes utiles

```bash
# Voir les logs en temps réel
docker logs -f ged-app

# Redémarrer l'application
docker restart ged-app

# Rebuild complet
docker build --no-cache -t ged-app:latest .

# Status des containers
docker ps -a

# Nettoyer les anciennes images
docker system prune -a
```

---

## ✅ Checklist de validation

- [ ] Site accessible sur `https://app.groupeetdecouverte.fr`
- [ ] Données (séjours) se chargent
- [ ] Aucune erreur dans `docker logs ged-app`
- [ ] Container en status "Up" dans `docker ps`

**🎉 Si tout est coché → C'est bon !**
