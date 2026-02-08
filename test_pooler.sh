#!/bin/bash

echo "🔌 Test connexion Supabase via Pooler"
echo "======================================"
echo ""

echo -n "Project Reference (ex: abcdefghijklmnop): "
read PROJECT_REF

echo -n "Database Password: "
read -s DB_PASSWORD
echo ""

# Test avec Connection Pooler (port 6543)
POOLER_HOST="aws-0-eu-central-1.pooler.supabase.com"
POOLER_PORT="6543"

echo ""
echo "Test connexion via Pooler..."

if PGPASSWORD="$DB_PASSWORD" psql -h "$POOLER_HOST" -p "$POOLER_PORT" -U "postgres.$PROJECT_REF" -d "postgres" -c "SELECT version();" 2>/dev/null; then
    echo ""
    echo "✅ CONNEXION POOLER RÉUSSIE !"
    echo ""
    echo "Utilisez ces paramètres pour l'installation :"
    echo "  Host: $POOLER_HOST"
    echo "  Port: $POOLER_PORT"
    echo "  User: postgres.$PROJECT_REF"
    echo "  Database: postgres"
else
    echo ""
    echo "❌ ÉCHEC POOLER"
    echo ""
    echo "Vérifiez :"
    echo "  1. Project Reference correct (16 caractères)"
    echo "  2. Password correct"
fi
