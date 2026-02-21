#!/bin/bash
# Script: remove-stripe-safe.sh
# Date: 2026-02-17
# Objectif: Supprimer Stripe en toute sécurité et préparer Lyra (PayZen)

set -e  # Exit on error

echo "=========================================="
echo "🔥 SUPPRESSION STRIPE - GED APP"
echo "=========================================="
echo ""

# ============================================
# PHASE 0: PRÉ-VÉRIFICATIONS
# ============================================

echo "📋 PHASE 0: Pré-vérifications..."

# Vérifier qu'on est à la racine du projet
if [ ! -f "package.json" ]; then
  echo "❌ ERREUR: Exécuter depuis la racine du projet (où se trouve package.json)"
  exit 1
fi

# Vérifier que git est clean (recommandé)
if [ -n "$(git status --porcelain)" ]; then
  echo "⚠️  WARNING: Git working directory is not clean"
  echo "   Recommandation: git add . && git commit -m 'pre: Backup before Stripe removal'"
  read -p "   Continuer quand même ? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Annulé par l'utilisateur"
    exit 1
  fi
fi

echo "✅ Pré-vérifications OK"
echo ""

# ============================================
# PHASE 1: SUPPRESSION FICHIERS API
# ============================================

echo "📋 PHASE 1: Suppression fichiers API Stripe..."

# Supprimer le dossier webhook Stripe
if [ -d "app/api/webhooks/stripe" ]; then
  echo "   🗑️  Suppression: app/api/webhooks/stripe/"
  rm -rf app/api/webhooks/stripe
  echo "   ✅ Dossier supprimé"
else
  echo "   ℹ️  Dossier déjà absent: app/api/webhooks/stripe/"
fi

# Supprimer create-intent
if [ -f "app/api/payment/create-intent/route.ts" ]; then
  echo "   🗑️  Suppression: app/api/payment/create-intent/route.ts"
  rm -rf app/api/payment/create-intent
  echo "   ✅ Fichier supprimé"
else
  echo "   ℹ️  Fichier déjà absent: app/api/payment/create-intent/route.ts"
fi

# Supprimer les patches archives
if [ -f "patches-securite-financiere/stripe-webhook_route.ts" ]; then
  echo "   🗑️  Suppression: patches-securite-financiere/stripe-webhook_route.ts"
  rm -f patches-securite-financiere/stripe-webhook_route.ts
  echo "   ✅ Patch supprimé"
fi

if [ -f "patches-securite-financiere/create-intent_route.ts" ]; then
  echo "   🗑️  Suppression: patches-securite-financiere/create-intent_route.ts"
  rm -f patches-securite-financiere/create-intent_route.ts
  echo "   ✅ Patch supprimé"
fi

echo "✅ Phase 1 terminée"
echo ""

# ============================================
# PHASE 2: MIGRATION BASE DE DONNÉES
# ============================================

echo "📋 PHASE 2: Migration base de données..."
echo "⚠️  ATTENTION: Cette étape nécessite un accès Supabase"
echo ""
echo "Options:"
echo "  A) Exécuter manuellement dans Supabase SQL Editor"
echo "  B) Skip (si déjà fait)"
echo ""
read -p "Voulez-vous afficher la migration SQL ? (y/N) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo ""
  echo "📄 Contenu de sql/010_remove_stripe_lyra_migration.sql:"
  echo "=========================================="
  cat sql/010_remove_stripe_lyra_migration.sql
  echo "=========================================="
  echo ""
  echo "👉 Copiez ce SQL et exécutez-le dans Supabase SQL Editor"
  echo "   URL: https://supabase.com/dashboard/project/[PROJECT]/sql"
  echo ""
  read -p "Migration exécutée dans Supabase ? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "⚠️  Migration BDD non confirmée. Continuez quand même..."
  fi
fi

echo "✅ Phase 2 terminée (ou skipped)"
echo ""

# ============================================
# PHASE 3: NETTOYAGE VARIABLES .ENV
# ============================================

echo "📋 PHASE 3: Nettoyage variables .env..."

if [ -f ".env" ]; then
  echo "   📝 Suppression des variables STRIPE_* dans .env"

  # Backup .env
  cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
  echo "   💾 Backup créé: .env.backup.$(date +%Y%m%d_%H%M%S)"

  # Supprimer les lignes Stripe
  sed -i.tmp '/STRIPE_PUBLISHABLE_KEY/d' .env
  sed -i.tmp '/STRIPE_SECRET_KEY/d' .env
  sed -i.tmp '/STRIPE_WEBHOOK_SECRET/d' .env
  rm -f .env.tmp

  echo "   ✅ Variables STRIPE_* supprimées de .env"
else
  echo "   ℹ️  Fichier .env absent"
fi

echo "✅ Phase 3 terminée"
echo ""

# ============================================
# PHASE 4: DÉSINSTALLATION PACKAGE STRIPE
# ============================================

echo "📋 PHASE 4: Désinstallation package npm..."

if grep -q '"stripe"' package.json; then
  echo "   🗑️  npm uninstall stripe"
  npm uninstall stripe
  echo "   ✅ Package stripe désinstallé"
else
  echo "   ℹ️  Package stripe déjà absent de package.json"
fi

echo "✅ Phase 4 terminée"
echo ""

# ============================================
# PHASE 5: VÉRIFICATION BUILD
# ============================================

echo "📋 PHASE 5: Vérification build..."

echo "   🔨 npm run build"
if npm run build > /tmp/build.log 2>&1; then
  echo "   ✅ Build réussi sans erreur"
else
  echo "   ❌ Build échoué. Voir /tmp/build.log"
  tail -30 /tmp/build.log
  exit 1
fi

echo "✅ Phase 5 terminée"
echo ""

# ============================================
# PHASE 6: RECHERCHE RÉSIDUELLE
# ============================================

echo "📋 PHASE 6: Recherche résidus Stripe..."

echo "   🔍 Recherche 'stripe' (case-insensitive)..."
STRIPE_MATCHES=$(grep -ri 'stripe' \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=.next \
  --exclude-dir=dist \
  --exclude='*.log' \
  --exclude='AUDIT_STRIPE_*.json' \
  --exclude='remove-stripe-safe.sh' \
  . 2>/dev/null || true)

if [ -z "$STRIPE_MATCHES" ]; then
  echo "   ✅ Aucun résidu 'stripe' trouvé"
else
  echo "   ⚠️  Résidus trouvés (vérifier manuellement):"
  echo "$STRIPE_MATCHES" | head -10
  echo ""
  echo "   💡 Ces résidus peuvent être:"
  echo "      - Documentation/commentaires (OK)"
  echo "      - Fichiers d'audit (OK)"
  echo "      - Code à nettoyer manuellement"
fi

echo "✅ Phase 6 terminée"
echo ""

# ============================================
# RÉSUMÉ FINAL
# ============================================

echo "=========================================="
echo "🎉 SUPPRESSION STRIPE TERMINÉE"
echo "=========================================="
echo ""
echo "✅ Fichiers API supprimés"
echo "✅ Variables .env nettoyées"
echo "✅ Package npm désinstallé"
echo "✅ Build vérifié"
echo ""
echo "📋 PROCHAINES ÉTAPES:"
echo ""
echo "1. 🗄️  Exécuter migration SQL dans Supabase (si pas encore fait)"
echo "   Fichier: sql/010_remove_stripe_lyra_migration.sql"
echo ""
echo "2. 💾 Commiter les changements"
echo "   git add ."
echo "   git commit -m 'feat: Remove Stripe, prepare for Lyra PayZen'"
echo ""
echo "3. 🚀 Intégrer Lyra (PayZen)"
echo "   - Créer app/api/payment/lyra/route.ts"
echo "   - Créer app/api/webhooks/lyra/route.ts"
echo "   - Configurer .env avec LYRA_* keys"
echo ""
echo "=========================================="
echo "📄 Rapport complet: AUDIT_STRIPE_REMOVAL_2026-02-17.json"
echo "=========================================="
