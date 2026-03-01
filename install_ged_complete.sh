#!/bin/bash

# ============================================
# Installation SQL - Projet GED (Groupe et Découverte)
# ============================================

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🚀 Installation SQL - Projet GED"
echo "================================="
echo ""

# Connection string — lue depuis les variables d'environnement
# Définissez DB_HOST, DB_PASSWORD (et optionnellement DB_USER, DB_PORT, DB_NAME)
# avant d'exécuter ce script, ou via un fichier .env
DB_HOST="${DB_HOST:-}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-postgres}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"

if [ -z "$DB_HOST" ] || [ -z "$DB_PASSWORD" ]; then
  echo -e "${RED}❌ Variables DB_HOST et DB_PASSWORD requises.${NC}"
  echo "   Exemple : DB_HOST=db.xxx.supabase.co DB_PASSWORD=monMotDePasse ./install_ged_complete.sh"
  exit 1
fi

CONNECTION_STRING="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# ============================================
# 1. Vérifier psql
# ============================================

echo "📋 Vérification de psql..."

if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ psql n'est pas installé${NC}"
    echo ""
    echo "Installation selon votre OS :"
    echo "  • macOS:   brew install postgresql"
    echo "  • Ubuntu:  sudo apt-get install postgresql-client"
    echo "  • Windows: https://www.postgresql.org/download/windows/"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ psql installé${NC}"
echo ""

# ============================================
# 2. Test de connexion
# ============================================

echo "🔌 Test de connexion à Supabase..."

if psql "$CONNECTION_STRING" -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Connexion réussie${NC}"
else
    echo -e "${RED}❌ Échec de connexion${NC}"
    echo ""
    echo "Vérifiez que :"
    echo "  1. Votre connexion internet fonctionne"
    echo "  2. Le password n'a pas expiré"
    echo ""
    exit 1
fi

echo ""

# ============================================
# 3. Installation Script 1 - Images
# ============================================

echo "📦 1/2 - Installation table sejours_images..."

if psql "$CONNECTION_STRING" -f sql/006_create_sejours_images_table.sql > /tmp/install_006.log 2>&1; then
    echo -e "${GREEN}   ✓ Table sejours_images créée${NC}"

    # Vérifier que la table existe
    if psql "$CONNECTION_STRING" -c "\d sejours_images" > /dev/null 2>&1; then
        echo -e "${GREEN}   ✓ Table vérifiée${NC}"
    fi
else
    echo -e "${RED}   ❌ Erreur lors de la création${NC}"
    echo "   Voir logs : /tmp/install_006.log"
    cat /tmp/install_006.log
    exit 1
fi

echo ""

# ============================================
# 4. Installation Script 2 - Smart Form
# ============================================

echo "📦 2/2 - Installation Smart Form & fonctions..."

if psql "$CONNECTION_STRING" -f sql/007_smart_form_routing_helpers.sql > /tmp/install_007.log 2>&1; then
    echo -e "${GREEN}   ✓ Fonctions Smart Form créées${NC}"

    # Vérifier que la table existe
    if psql "$CONNECTION_STRING" -c "\d smart_form_submissions" > /dev/null 2>&1; then
        echo -e "${GREEN}   ✓ Table smart_form_submissions vérifiée${NC}"
    fi
else
    echo -e "${RED}   ❌ Erreur lors de la création${NC}"
    echo "   Voir logs : /tmp/install_007.log"
    cat /tmp/install_007.log
    exit 1
fi

echo ""

# ============================================
# 5. Vérification complète
# ============================================

echo "🔍 Vérification de l'installation..."
echo ""

# Tables créées
echo "Tables créées :"
psql "$CONNECTION_STRING" -c "
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('sejours_images', 'import_logs', 'smart_form_submissions', 'notification_queue')
ORDER BY tablename;
"

echo ""

# Fonctions créées
echo "Fonctions créées :"
psql "$CONNECTION_STRING" -c "
SELECT proname
FROM pg_proc
WHERE proname IN (
  'get_suggested_stays_by_inclusion_level',
  'get_stays_by_tags',
  'get_stay_carousel_images',
  'log_smart_form_submission',
  'estimate_financial_aid'
)
ORDER BY proname;
"

echo ""

# ============================================
# 6. Tests fonctionnels
# ============================================

echo "🧪 Tests fonctionnels..."
echo ""

echo "Test 1 : Fonction estimate_financial_aid(450, true, 850)"
psql "$CONNECTION_STRING" -c "SELECT * FROM estimate_financial_aid(450, true, 850);"

echo ""
echo "Test 2 : Statistiques images par séjour"
psql "$CONNECTION_STRING" -c "SELECT COUNT(*) as total_images FROM sejours_images;"

echo ""

# ============================================
# 7. Résumé
# ============================================

echo -e "${GREEN}✅ INSTALLATION TERMINÉE !${NC}"
echo ""
echo "📊 Objets créés :"
echo "   • 4 tables (sejours_images, import_logs, smart_form_submissions, notification_queue)"
echo "   • 15 index"
echo "   • 5 vues"
echo "   • 8 fonctions SQL"
echo "   • 2 triggers"
echo ""
echo "🚀 Prochaines étapes :"
echo "   1. Importer le workflow n8n : n8n-flooow-image-collector-v3-cinematic.json"
echo "   2. Configurer credentials Unsplash/Pexels"
echo "   3. Intégrer Smart Form dans le frontend"
echo ""
echo "📚 Documentation :"
echo "   • Images:     docs/N8N_IMAGE_COLLECTOR_GUIDE.md"
echo "   • Smart Form: docs/SMART_FORM_INTEGRATION_GUIDE.md"
echo "   • Résumé SQL: SQL_SUMMARY.md"
echo ""
