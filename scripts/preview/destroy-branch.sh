#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# destroy-branch.sh — Détruit la Supabase branch + nettoie env vars Vercel
#
# Usage : ./scripts/preview/destroy-branch.sh <branch-name>
# ---------------------------------------------------------------------------
set -euo pipefail

BRANCH_NAME="${1:?Usage: $0 <branch-name>}"
PROJECT_REF="iirfvndgzutbxwfdwawu"
GIT_BRANCH="preview/$BRANCH_NAME"

echo "==> Destruction branch '$BRANCH_NAME' (projet $PROJECT_REF)"
read -r -p "    Confirmer destruction ? [y/N] " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { echo "Annulé."; exit 1; }

# 1. Delete Supabase branch
echo "==> supabase branches delete"
supabase branches delete "$BRANCH_NAME" --project-ref "$PROJECT_REF" --yes

# 2. Nettoyer env vars Vercel
echo "==> vercel env rm (preview/$GIT_BRANCH)"
for VAR in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY; do
  vercel env rm "$VAR" preview "$GIT_BRANCH" --yes 2>/dev/null || echo "    ($VAR absent, skip)"
done

echo ""
echo "==> OK. Branch détruite. Coût arrêté."
echo "    Pense à : git branch -D $GIT_BRANCH (si locale)"
echo "              git push origin --delete $GIT_BRANCH (si remote)"
