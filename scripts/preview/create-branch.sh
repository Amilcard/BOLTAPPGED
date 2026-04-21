#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# create-branch.sh — Crée une Supabase branch éphémère pour tests Thanh/E2E
#
# Usage :
#   ./scripts/preview/create-branch.sh [branch-name]
#
# Par défaut : branch-name = "preview-$(date +%Y%m%d-%H%M)"
#
# Prérequis :
#   - SUPABASE_ACCESS_TOKEN exporté (cf. https://supabase.com/dashboard/account/tokens)
#   - VERCEL_TOKEN exporté (cf. https://vercel.com/account/tokens)
#   - Vercel CLI installé (npm i -g vercel)
#   - Supabase CLI installé (npm i -g supabase)
#
# Coût : ~$0.01344/h — détruire avec ./scripts/preview/destroy-branch.sh <name>
# ---------------------------------------------------------------------------
set -euo pipefail

BRANCH_NAME="${1:-preview-$(date +%Y%m%d-%H%M)}"
PROJECT_REF="iirfvndgzutbxwfdwawu"  # groupeetdecouverte prod
VERCEL_PROJECT="boltappged"

echo "==> Création Supabase branch '$BRANCH_NAME' (sur projet $PROJECT_REF)"
echo "    Coût : ~\$0.01344/h. N'oubliez pas de la détruire après usage."
read -r -p "    Continuer ? [y/N] " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { echo "Annulé."; exit 1; }

# 1. Créer branch Supabase
echo "==> supabase branches create"
supabase branches create "$BRANCH_NAME" --project-ref "$PROJECT_REF"

# 2. Attendre que branch soit ACTIVE_HEALTHY (~30s)
echo "==> Attente branch active..."
for i in {1..20}; do
  STATUS=$(supabase branches get "$BRANCH_NAME" --project-ref "$PROJECT_REF" -o json | jq -r '.status')
  if [[ "$STATUS" == "ACTIVE_HEALTHY" ]]; then
    echo "    Branch active."
    break
  fi
  sleep 5
done

# 3. Récupérer credentials branch
BRANCH_REF=$(supabase branches get "$BRANCH_NAME" --project-ref "$PROJECT_REF" -o json | jq -r '.project_ref')
BRANCH_URL="https://$BRANCH_REF.supabase.co"
BRANCH_ANON=$(supabase projects api-keys --project-ref "$BRANCH_REF" -o json | jq -r '.[] | select(.name=="anon") | .api_key')
BRANCH_SERVICE=$(supabase projects api-keys --project-ref "$BRANCH_REF" -o json | jq -r '.[] | select(.name=="service_role") | .api_key')

echo "    Branch URL  : $BRANCH_URL"
echo "    Branch ref  : $BRANCH_REF"

# 4. Seed data
echo "==> Application seed supabase/seed/preview.sql"
PGURI="postgresql://postgres:postgres@db.${BRANCH_REF}.supabase.co:5432/postgres"
psql "$PGURI" -f supabase/seed/preview.sql || echo "(seed échoué — à appliquer manuellement)"

# 5. Scoper env vars Vercel sur la branche git correspondante
GIT_BRANCH="preview/$BRANCH_NAME"
echo "==> Scoping Vercel env vars sur git branch '$GIT_BRANCH'"
vercel env add NEXT_PUBLIC_SUPABASE_URL preview "$GIT_BRANCH" <<< "$BRANCH_URL"
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview "$GIT_BRANCH" <<< "$BRANCH_ANON"
vercel env add SUPABASE_SERVICE_ROLE_KEY preview "$GIT_BRANCH" <<< "$BRANCH_SERVICE"

echo ""
echo "==> OK. Preview prête."
echo "    1. git checkout -b $GIT_BRANCH"
echo "    2. git push origin $GIT_BRANCH"
echo "    3. Vercel déploiera preview auto → URL unique"
echo ""
echo "    DÉTRUIRE après tests :"
echo "    ./scripts/preview/destroy-branch.sh $BRANCH_NAME"
