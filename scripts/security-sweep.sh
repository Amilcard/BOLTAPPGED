#!/usr/bin/env bash
# scripts/security-sweep.sh
#
# Détection static de patterns sécurité à risque — complément ESLint + tsc + jest.
# Référencé par CLAUDE.md § "Prelude anti-pièges".
#
# Règles scannées (warning, non bloquant par défaut — passer STRICT=1 pour fail) :
#   1. require(Editor|Admin|...) sans await — doublonne ESLint rule no-restricted-syntax
#   2. Mutation Supabase (.update/.insert/.delete) sur table PII sans auditLog ±15 lignes
#   3. req.json() sans validator de taille (validateBase64Image/Upload) ±10 lignes
#
# Usage :
#   bash scripts/security-sweep.sh               # warnings seulement (exit 0)
#   STRICT=1 bash scripts/security-sweep.sh      # exit 1 si findings
#
# Installation pre-commit (optionnel — déjà couvert par eslint rule) :
#   Ajouter ligne dans .husky/pre-commit :  bash scripts/security-sweep.sh

set -u
cd "$(dirname "$0")/.."

RED='\033[0;31m'
YEL='\033[0;33m'
GRN='\033[0;32m'
NC='\033[0m'

FINDINGS=0
warn() { echo -e "${YEL}[warn]${NC} $*"; FINDINGS=$((FINDINGS+1)); }
info() { echo -e "${GRN}[ok]${NC}   $*"; }

AUTH_HELPERS='require(Editor|Admin|Auth|ProSession|StructureRole|InscriptionOwnership)|verify(Auth|ProSession)'

# 1. Auth helper sans await (doublon ESLint — filet supplémentaire)
# Match : "const x = requireEditor(" sans "await" sur la même ligne
echo "── 1. Auth helpers sans await ─────────────────────────"
if grep -rnE "(const|let|var|if\s*\(!?)\s*[a-zA-Z_]*\s*=?\s*${AUTH_HELPERS}\s*\(" \
    app/api --include="*.ts" \
    | grep -vE "await\s+${AUTH_HELPERS}" \
    | grep -vE "^\s*\*" \
    | grep -vE "\.(test|spec)\.ts" ; then
  warn "Trouvé au moins une auth helper sans await ci-dessus."
else
  info "Toutes les invocations auth/ownership sont awaited."
fi

# 2. Mutations Supabase sur tables PII sans auditLog ±15 lignes
echo ""
echo "── 2. Mutations tables PII sans auditLog ──────────────"
PII_TABLES='gd_inscriptions|gd_dossier_enfant|gd_propositions_tarifaires|gd_factures|gd_medical_events|gd_incidents|gd_calls|gd_notes|gd_structure_access_codes|gd_educateur_emails|gd_souhaits'
# Grep : fichiers contenant mutation sur table PII
FILES_WITH_MUTATION=$(grep -rlE "\.from\(['\"](${PII_TABLES})['\"]\).*\s+\.(update|insert|delete)\(" app/api lib --include="*.ts" 2>/dev/null | sort -u)
for file in $FILES_WITH_MUTATION; do
  # Chaque fichier doit appeler auditLog au moins une fois
  if ! grep -q "auditLog" "$file"; then
    warn "Mutation PII sans auditLog : $file"
  fi
done
info "Scan mutations PII terminé."

# 3. req.json() sans validator de taille (warning contextuel)
echo ""
echo "── 3. req.json() sans validateBase64Image/Size ±10L ───"
# On cherche uniquement les routes qui manipulent signature_image_url OU upload sans validator
ROUTES_JSON=$(grep -rlE "await req\.json\(\)" app/api --include="*.ts" 2>/dev/null)
for file in $ROUTES_JSON; do
  # Ignore si validateur déjà présent ou pas de body signature/image
  if grep -qE "validateBase64Image|validateUploadSize" "$file"; then
    continue
  fi
  # Flag uniquement si body parse explicitement un champ image/signature/base64
  # (vs string "image/png" dans un template HTML email — faux positif).
  # Heuristique : match le destructuring `{ signature_* }` ou variable base64 assignée.
  if grep -qE "signature_image_url|signatureBase64|signature_data|data:image|base64Data\s*=" "$file"; then
    warn "req.json() sans validator taille (signature/base64 suspect) : $file"
  fi
done
info "Scan req.json() terminé."

echo ""
echo "─────────────────────────────────────────────────────"
if [ "$FINDINGS" -eq 0 ]; then
  echo -e "${GRN}[security-sweep] 0 findings.${NC}"
  exit 0
fi

echo -e "${YEL}[security-sweep] ${FINDINGS} findings.${NC}"
if [ "${STRICT:-0}" = "1" ]; then
  exit 1
fi
exit 0
