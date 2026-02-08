#!/bin/bash

# ============================================
# Test de connexion Supabase
# ============================================

echo "🔌 Test de connexion à Supabase"
echo "================================"
echo ""

# Demander les credentials
echo -n "Supabase Host (ex: db.xyz.supabase.co): "
read DB_HOST

echo -n "Database Password: "
read -s DB_PASSWORD
echo ""

DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres

echo ""
echo "Test de connexion..."
echo ""

# Test connexion
if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" 2>/dev/null; then
    echo ""
    echo "✅ CONNEXION RÉUSSIE !"
    echo ""
    echo "Informations base de données :"
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT
            current_database() as database,
            current_user as user,
            inet_server_addr() as server_ip,
            version() as postgres_version;
    "
    echo ""
    echo "Tables existantes :"
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename;
    "
    echo ""
    echo "🚀 Vous pouvez maintenant lancer : ./install_sql.sh"
else
    echo ""
    echo "❌ ÉCHEC DE CONNEXION"
    echo ""
    echo "Vérifiez :"
    echo "  1. Votre Host est correct (db.xxxxx.supabase.co)"
    echo "  2. Votre password est correct"
    echo "  3. Votre IP est autorisée dans Supabase :"
    echo "     → Supabase Dashboard > Settings > Database"
    echo "     → Section 'Connection Pooling'"
    echo "     → Vérifier les restrictions IP"
    echo ""
    exit 1
fi
