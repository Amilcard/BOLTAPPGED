#!/bin/bash
# Script de déploiement pour VPS Hostinger
# Ce script doit être exécuté sur le VPS via le terminal Hostinger

set -e  # Arrêter en cas d'erreur

echo "=== DÉPLOIEMENT GED APP SUR VPS ==="
echo ""

# 1. Vérifier qu'on est sur la branche work
echo "📌 Étape 1: Vérification de la branche Git"
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "work" ]; then
    echo "❌ Erreur: Vous n'êtes pas sur la branche 'work' (branche actuelle: $CURRENT_BRANCH)"
    echo "   Exécutez: git checkout work"
    exit 1
fi
echo "✅ Branche 'work' active"
echo ""

# 2. Pull des dernières modifications
echo "📥 Étape 2: Récupération des dernières modifications"
git pull origin work
echo "✅ Code à jour"
echo ""

# 3. Arrêter et supprimer l'ancien container (si existant)
echo "🛑 Étape 3: Nettoyage des anciens containers"
if docker ps -a | grep -q ged-app; then
    docker stop ged-app 2>/dev/null || true
    docker rm ged-app 2>/dev/null || true
    echo "✅ Ancien container supprimé"
else
    echo "ℹ️  Aucun container existant"
fi
echo ""

# 4. Supprimer l'ancienne image
echo "🗑️  Étape 4: Suppression de l'ancienne image"
if docker images | grep -q ged-app; then
    docker rmi ged-app:latest 2>/dev/null || true
    echo "✅ Ancienne image supprimée"
else
    echo "ℹ️  Aucune image existante"
fi
echo ""

# 5. Build de la nouvelle image
echo "🔨 Étape 5: Construction de la nouvelle image Docker"
echo "   (Cette étape peut prendre 3-5 minutes)"
docker build -t ged-app:latest .
if [ $? -eq 0 ]; then
    echo "✅ Image construite avec succès"
else
    echo "❌ Erreur lors du build de l'image"
    exit 1
fi
echo ""

# 6. Vérifier que le fichier .env existe
echo "🔑 Étape 6: Vérification du fichier .env"
if [ ! -f .env ]; then
    echo "❌ Erreur: Le fichier .env est manquant"
    echo "   Créez-le avec les variables DATABASE_URL, NEXTAUTH_SECRET, etc."
    exit 1
fi
echo "✅ Fichier .env présent"
echo ""

# 7. Démarrer le nouveau container
echo "🚀 Étape 7: Démarrage du container"
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

if [ $? -eq 0 ]; then
    echo "✅ Container démarré avec succès"
else
    echo "❌ Erreur lors du démarrage du container"
    exit 1
fi
echo ""

# 8. Vérifier que le container tourne
echo "🔍 Étape 8: Vérification du container"
sleep 3
if docker ps | grep -q ged-app; then
    echo "✅ Container actif"
    echo ""
    echo "📊 Logs du container (10 dernières lignes):"
    docker logs --tail 10 ged-app
else
    echo "❌ Le container ne semble pas actif"
    echo ""
    echo "📊 Logs complets:"
    docker logs ged-app
    exit 1
fi
echo ""

# 9. Récapitulatif
echo "======================================"
echo "✅ DÉPLOIEMENT TERMINÉ"
echo "======================================"
echo ""
echo "🌐 URL: https://app.groupeetdecouverte.fr"
echo ""
echo "📝 Commandes utiles:"
echo "   - Voir les logs:        docker logs -f ged-app"
echo "   - Redémarrer:           docker restart ged-app"
echo "   - Arrêter:              docker stop ged-app"
echo "   - État des containers:  docker ps -a"
echo ""
echo "🔧 En cas de problème:"
echo "   - Vérifier les logs:    docker logs ged-app"
echo "   - Vérifier Traefik:     docker logs traefik"
echo "   - Tester en local:      curl -I http://localhost:3000"
echo ""
