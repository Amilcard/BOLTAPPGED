#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# guard-destructive.sh — PreToolUse hook bloquant les actions destructives
#
# Bloque via exit code 1 + stderr les patterns suivants dans Bash :
#   - rm -rf sur / ~ * ou chemin court non-spécifique
#   - git push --force / -f vers main
#   - git reset --hard origin/main
#   - DROP TABLE / TRUNCATE TABLE (SQL dangereux via bash)
#   - supabase db reset (détruit DB)
#   - supabase branches delete <projet-prod> (protège branche prod)
#
# Reçoit sur stdin : {"tool_name": "Bash", "tool_input": {"command": "..."}}
# Exit 0 = autorisé ; Exit 1 = bloqué (stderr remonté à l'IA).
# ---------------------------------------------------------------------------
set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null || echo "")

[[ -z "$COMMAND" ]] && exit 0

# 1. rm -rf destructeur
if echo "$COMMAND" | grep -qE 'rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\s+(/|~|\*|\.)(\s|$)'; then
  echo "[GUARD] rm -rf sur /, ~, *, ou . est BLOQUÉ. Spécifie un chemin exact." >&2
  exit 1
fi

# 2. git push --force sur main
if echo "$COMMAND" | grep -qE 'git\s+push\s+(-f|--force|--force-with-lease)[^|;]*\smain(\s|$)'; then
  echo "[GUARD] git push --force sur main est BLOQUÉ. Utilise une branche feature + PR." >&2
  exit 1
fi

# 3. git reset --hard origin/main ou HEAD~N
if echo "$COMMAND" | grep -qE 'git\s+reset\s+--hard\s+(origin/main|HEAD~[0-9]+)'; then
  echo "[GUARD] git reset --hard sur main/historique est BLOQUÉ. Revert/commit plutôt." >&2
  exit 1
fi

# 4. DROP TABLE / TRUNCATE via bash
if echo "$COMMAND" | grep -qiE '(DROP\s+(TABLE|SCHEMA|DATABASE)|TRUNCATE\s+TABLE)'; then
  echo "[GUARD] DROP/TRUNCATE via Bash est BLOQUÉ. Passe par supabase MCP apply_migration avec confirmation." >&2
  exit 1
fi

# 5. supabase db reset
if echo "$COMMAND" | grep -qE 'supabase\s+db\s+reset'; then
  echo "[GUARD] supabase db reset est BLOQUÉ. Détruit toutes les données." >&2
  exit 1
fi

# 6. supabase branches delete sur prod ref
if echo "$COMMAND" | grep -qE 'supabase\s+branches\s+delete\s+.*iirfvndgzutbxwfdwawu'; then
  echo "[GUARD] Destruction d'une branch sur projet prod via ref direct BLOQUÉE." >&2
  exit 1
fi

# 7. .env / credentials lecture en clair via cat vers stdout
if echo "$COMMAND" | grep -qE 'cat\s+\.env(\.|\s|$)' && ! echo "$COMMAND" | grep -q '>'; then
  echo "[GUARD] cat .env en clair BLOQUÉ (risque secrets dans logs). Utilise grep ciblé." >&2
  exit 1
fi

exit 0
