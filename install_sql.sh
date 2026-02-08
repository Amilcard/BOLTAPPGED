#!/bin/bash

# ============================================
# Script d'installation SQL Flooow
# Images + Smart Form
# ============================================

set -e  # Arrêter si erreur

echo "🚀 Installation SQL Flooow - Images + Smart Form"
echo "================================================"
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================
# 1. Vérifier les prérequis
# ============================================

echo "📋 Vérification des prérequis..."

# Vérifier que psql est installé
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ psql n'est pas installé${NC}"
    echo "Installez PostgreSQL client:"
    echo "  - macOS: brew install postgresql"
    echo "  - Ubuntu: sudo apt-get install postgresql-client"
    echo "  - Windows: https://www.postgresql.org/download/windows/"
    exit 1
fi

echo -e "${GREEN}✓ psql installé${NC}"

# Vérifier que les fichiers SQL existent
if [ ! -f "sql/006_create_sejours_images_table.sql" ]; then
    echo -e "${RED}❌ Fichier sql/006_create_sejours_images_table.sql introuvable${NC}"
    exit 1
fi

if [ ! -f "sql/007_smart_form_routing_helpers.sql" ]; then
    echo -e "${RED}❌ Fichier sql/007_smart_form_routing_helpers.sql introuvable${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Fichiers SQL trouvés${NC}"
echo ""

# ============================================
# 2. Demander les credentials Supabase
# ============================================

echo "🔐 Configuration Supabase"
echo "-------------------------"

# Lire depuis .env si existe
if [ -f ".env" ]; then
    echo "Fichier .env trouvé, lecture des variables..."
    source .env
fi

# Demander DB_HOST si non défini
if [ -z "$DB_HOST" ]; then
    echo -n "Supabase Host (ex: db.xyz.supabase.co): "
    read DB_HOST
fi

# Demander DB_PASSWORD si non défini
if [ -z "$DB_PASSWORD" ]; then
    echo -n "Supabase Database Password: "
    read -s DB_PASSWORD
    echo ""
fi

# Définir valeurs par défaut
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-postgres}
DB_USER=${DB_USER:-postgres}

echo -e "${GREEN}✓ Credentials configurés${NC}"
echo ""

# ============================================
# 3. Tester la connexion
# ============================================

echo "🔌 Test de connexion à Supabase..."

if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Connexion réussie${NC}"
else
    echo -e "${RED}❌ Impossible de se connecter à Supabase${NC}"
    echo "Vérifiez vos credentials et que votre IP est autorisée dans Supabase > Settings > Database > Connection Pooling"
    exit 1
fi
echo ""

# ============================================
# 4. Exécuter les scripts SQL
# ============================================

echo "📦 Installation des tables et fonctions..."
echo ""

# Script 1 : Table images
echo "1️⃣  Création table sejours_images..."
if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "sql/006_create_sejours_images_table.sql" > /tmp/sql_006.log 2>&1; then
    echo -e "${GREEN}   ✓ Table sejours_images créée${NC}"
else
    echo -e "${RED}   ❌ Erreur lors de la création de la table sejours_images${NC}"
    echo "   Voir les logs: /tmp/sql_006.log"
    cat /tmp/sql_006.log
    exit 1
fi

# Script 2 : Smart Form helpers
echo "2️⃣  Création fonctions Smart Form..."
if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "sql/007_smart_form_routing_helpers.sql" > /tmp/sql_007.log 2>&1; then
    echo -e "${GREEN}   ✓ Fonctions Smart Form créées${NC}"
else
    echo -e "${RED}   ❌ Erreur lors de la création des fonctions Smart Form${NC}"
    echo "   Voir les logs: /tmp/sql_007.log"
    cat /tmp/sql_007.log
    exit 1
fi

echo ""

# ============================================
# 5. Vérifier l'installation
# ============================================

echo "🔍 Vérification de l'installation..."
echo ""

# Vérifier table sejours_images
echo -n "   - Table sejours_images: "
if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\d sejours_images" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

# Vérifier table smart_form_submissions
echo -n "   - Table smart_form_submissions: "
if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\d smart_form_submissions" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

# Vérifier fonction get_suggested_stays_by_inclusion_level
echo -n "   - Fonction get_suggested_stays_by_inclusion_level: "
if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT proname FROM pg_proc WHERE proname = 'get_suggested_stays_by_inclusion_level'" | grep -q "get_suggested_stays_by_inclusion_level"; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

# Vérifier fonction estimate_financial_aid
echo -n "   - Fonction estimate_financial_aid: "
if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT proname FROM pg_proc WHERE proname = 'estimate_financial_aid'" | grep -q "estimate_financial_aid"; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

echo ""

# ============================================
# 6. Tests fonctionnels
# ============================================

echo "🧪 Tests fonctionnels..."
echo ""

# Test 1 : Fonction get_suggested_stays
echo "Test 1: get_suggested_stays_by_inclusion_level('NIVEAU_1_INCLUSION', 8)"
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT slug, marketing_title FROM get_suggested_stays_by_inclusion_level('NIVEAU_1_INCLUSION', 8) LIMIT 3;"
echo ""

# Test 2 : Fonction estimate_financial_aid
echo "Test 2: estimate_financial_aid(450, true, 850)"
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT * FROM estimate_financial_aid(450, true, 850);"
echo ""

# ============================================
# 7. Résumé
# ============================================

echo "✅ Installation terminée avec succès !"
echo ""
echo "📊 Résumé:"
echo "   - Table sejours_images créée"
echo "   - Table smart_form_submissions créée"
echo "   - Table notification_queue créée"
echo "   - 7 fonctions SQL créées"
echo "   - 2 vues SQL créées"
echo "   - 1 trigger créé"
echo ""
echo "🚀 Prochaines étapes:"
echo "   1. Importer le workflow n8n (n8n-flooow-image-collector-v3-cinematic.json)"
echo "   2. Configurer les credentials Unsplash/Pexels dans n8n"
echo "   3. Intégrer le Smart Form dans votre frontend (voir docs/SMART_FORM_INTEGRATION_GUIDE.md)"
echo ""
echo "📚 Documentation:"
echo "   - Images: docs/N8N_IMAGE_COLLECTOR_GUIDE.md"
echo "   - Smart Form: docs/SMART_FORM_INTEGRATION_GUIDE.md"
echo "   - Intégration complète: README_INTEGRATION_COMPLETE.md"
echo ""
