#!/usr/bin/env node
/**
 * audit/post-action-assertions.mjs
 *
 * Audit T1 — Silence de la Réussite (Success-but-Failed).
 *
 * Règle : toute mutation Supabase (insert/update/upsert/delete) doit être
 * suivie d'un guard post-action :
 *   - destructuring `{ data, error }` ET check `if (error)` ET assert*
 *   - OU appel direct à `assertInserted | assertUpdatedOne | assertDeleted |
 *     assertUpdatedAtLeastOne | assertSelectedOne` dans les 8 lignes suivantes
 *
 * Scope : app/api/**, lib/**
 * Output : audit-reports/post-action-assertions.txt
 * Exit   : 0 si toutes protégées, 1 sinon.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'audit-reports');
const OUT_FILE = path.join(OUT_DIR, 'post-action-assertions.txt');

// Regex élargi 2026-04-25 : matche `await supabase.from('X').update(...)` et
// `await getSupabaseAdmin().from('Y').upsert(...)` — le pattern précédent
// `[\w.]*supabase[\w.]*` ne traversait pas `.from('...')` (parenthèses non-\w),
// résultant en 0 mutation détectée sur 142 fichiers (faux 0 violation).
// Single-line uniquement — les mutations multi-line (chain sur 2-5 lignes)
// sont détectées via MUTATION_CHAIN_RE ci-dessous.
const MUTATION_RE = /await\s+[^;]*?(?:supabase|getSupabase\w*\(\))[^;]*?\.(insert|update|upsert|delete)\s*\(/;
// Détection de la fin de chain `.insert/update/upsert/delete(` — pour les
// mutations multi-line on cherche le mot-clé sur sa ligne et on regarde 6
// lignes en arrière pour confirmer qu'un `await supabase` ouvre la chain.
const MUTATION_TAIL_RE = /^\s*\.(insert|update|upsert|delete)\s*\(/;
const AWAIT_SUPABASE_RE = /await\s+(?:supabase|getSupabase\w*\(\))/;
const ASSERT_RE = /\bassert(Inserted|UpdatedOne|UpdatedAtLeastOne|Deleted|SelectedOne)\s*\(/;
const DATA_ERROR_RE = /\{\s*data\s*(?::\s*\w+)?\s*,\s*error\s*\}\s*=\s*await/;
const ERROR_CHECK_RE = /if\s*\(\s*error\b/;

function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name === 'tests') continue;
      walk(full, acc);
    } else if (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.tsx'))) {
      acc.push(full);
    }
  }
  return acc;
}

const files = [
  ...walk(path.join(ROOT, 'app/api')),
  ...walk(path.join(ROOT, 'lib')),
];

const violations = [];
const protectedCount = { assertGuarded: 0, errorOnly: 0 };

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    let isMutation = MUTATION_RE.test(lines[i]);
    // Détection multi-line : mot-clé `.insert/update/upsert/delete(` en tête
    // de ligne avec `await supabase` dans les 6 lignes précédentes.
    if (!isMutation && MUTATION_TAIL_RE.test(lines[i])) {
      const lookback = lines.slice(Math.max(0, i - 6), i).join('\n');
      if (AWAIT_SUPABASE_RE.test(lookback)) {
        isMutation = true;
      }
    }
    if (!isMutation) continue;
    // Scan 8 lignes suivantes pour un guard
    const window = lines.slice(i, Math.min(i + 10, lines.length)).join('\n');
    const hasAssert = ASSERT_RE.test(window);
    const hasDataError = DATA_ERROR_RE.test(window) && ERROR_CHECK_RE.test(window);
    if (hasAssert) {
      protectedCount.assertGuarded++;
    } else if (hasDataError) {
      protectedCount.errorOnly++;
      violations.push({ file: path.relative(ROOT, file), line: i + 1, kind: 'error-only', preview: lines[i].trim().slice(0, 100) });
    } else {
      violations.push({ file: path.relative(ROOT, file), line: i + 1, kind: 'no-guard', preview: lines[i].trim().slice(0, 100) });
    }
  }
}

let sha = 'unknown';
try {
  sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch {
  /* ok */
}

const out = [];
out.push(`[post-action-assertions audit] ${new Date().toISOString()}  commit=${sha}`);
out.push(`scope: app/api + lib — ${files.length} fichier(s) TS`);
out.push('');
out.push(`PROTECTED (assert* present) — ${protectedCount.assertGuarded} mutation(s)`);
out.push(`WEAK (error check mais pas d'assert*) — ${protectedCount.errorOnly} mutation(s)`);
out.push(`UNGUARDED (ni error check ni assert*) — ${violations.filter(v => v.kind === 'no-guard').length} mutation(s) ⚠️ T1 risk :`);
for (const v of violations.filter(v => v.kind === 'no-guard').slice(0, 50)) {
  out.push(`  ${v.file}:${v.line}  ${v.preview}`);
}
if (violations.filter(v => v.kind === 'no-guard').length > 50) {
  out.push(`  ... et ${violations.filter(v => v.kind === 'no-guard').length - 50} autres`);
}
out.push('');
out.push('──────────────────────────────────────────────────────────────────────');
out.push(`TOTAL mutations: ${protectedCount.assertGuarded + violations.length}`);
out.push(`VIOLATIONS (no-guard + weak): ${violations.length}`);
out.push(`EXIT: ${violations.length > 0 ? 1 : 0}`);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, out.join('\n') + '\n', 'utf8');
console.log(out.join('\n'));
process.exit(violations.length > 0 ? 1 : 0);
