#!/usr/bin/env node
/**
 * audit/schema-drift.mjs
 *
 * Audit T4 bis — détecte les divergences de CHECK IN (...) entre migrations SQL
 * successives sur la MÊME couple (table, colonne) (évolution enum non tracée
 * côté Zod).
 *
 * v2 (2026-04-22) : track table context via CREATE TABLE / ALTER TABLE
 * pour éliminer les faux positifs (même nom de colonne sur plusieurs tables,
 * ex: `status`).
 *
 * Exemples détectés historiquement :
 *   - gd_inscriptions.payment_method : sql/009 (stripe, transfer, check)
 *     vs sql/010 (lyra, transfer, check) — drift historique non reflétée prod.
 *   - gd_structure_access_codes.role : sql/042 (4 valeurs) vs
 *     supabase/migrations/069 (5 valeurs, ajout cds_delegated) — évolution.
 *
 * Output : audit-reports/schema-drift.txt
 * Exit   : 0 si aucune drift, 1 sinon (warning, peut être volontaire).
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'audit-reports');
const OUT_FILE = path.join(OUT_DIR, 'schema-drift.txt');

const CREATE_TABLE_RE = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:public\.)?(\w+)/i;
const ALTER_TABLE_RE = /ALTER\s+TABLE(?:\s+IF\s+EXISTS)?\s+ONLY\s+(?:public\.)?(\w+)|ALTER\s+TABLE(?:\s+IF\s+EXISTS)?\s+(?:public\.)?(\w+)/i;
const CHECK_IN_RE = /CHECK\s*\(\s*(\w+)\s+IN\s*\(\s*([^)]+?)\s*\)\s*\)/i;

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
      walk(full, acc);
    } else if (e.isFile() && e.name.endsWith('.sql')) {
      acc.push(full);
    }
  }
  return acc;
}

function parseValues(raw) {
  return raw
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
    .sort();
}

const files = [
  ...walk(path.join(ROOT, 'sql')),
  ...walk(path.join(ROOT, 'supabase/migrations')),
].sort();

// Map "table.column" → [{ file, values }]
const checksByKey = {};
// Pour colonnes sans table trackable (multi-line CHECK, CREATE absent, etc.)
const orphanChecks = [];

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  let currentTable = null;
  for (const line of lines) {
    const createM = line.match(CREATE_TABLE_RE);
    if (createM) {
      currentTable = createM[1];
      continue;
    }
    const alterM = line.match(ALTER_TABLE_RE);
    if (alterM) {
      currentTable = alterM[1] || alterM[2];
      continue;
    }
    const checkM = line.match(CHECK_IN_RE);
    if (checkM) {
      const col = checkM[1];
      const values = parseValues(checkM[2]);
      if (currentTable) {
        const key = `${currentTable}.${col}`;
        if (!checksByKey[key]) checksByKey[key] = [];
        checksByKey[key].push({ file: path.relative(ROOT, file), values });
      } else {
        orphanChecks.push({ file: path.relative(ROOT, file), col, values });
      }
    }
  }
}

const drifts = [];
for (const key of Object.keys(checksByKey)) {
  const entries = checksByKey[key];
  if (entries.length < 2) continue;
  const signatures = new Set(entries.map((e) => e.values.join('|')));
  if (signatures.size > 1) {
    drifts.push({ key, entries });
  }
}

let sha = 'unknown';
try {
  sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch {
  /* ok */
}

const out = [];
out.push(`[schema-drift audit v2] ${new Date().toISOString()}  commit=${sha}`);
out.push(`scope: sql/ + supabase/migrations/ — ${files.length} fichier(s)`);
out.push(`(table, column) pairs with CHECK IN : ${Object.keys(checksByKey).length}`);
out.push(`orphan checks (table non-trackée) : ${orphanChecks.length}`);
out.push('');
out.push(`DRIFT (même table.col, valeurs différentes entre migrations) — ${drifts.length} ⚠️ T4 :`);
for (const d of drifts) {
  out.push(`  ${d.key} :`);
  for (const e of d.entries) {
    out.push(`    ${e.file} = [${e.values.join(', ')}]`);
  }
}
out.push('');
out.push(`NOTE : une drift peut être volontaire (migration qui ajoute une valeur).`);
out.push(`       Cross-check état prod via MCP Supabase list_tables(verbose=true) avant`);
out.push(`       de considérer qu'une des migrations est autoritative.`);
out.push(`       Aligner Zod (scripts/audit/zod-sql-consistency.mjs) sur l'état prod.`);
out.push('');
out.push('──────────────────────────────────────────────────────────────────────');
out.push(`VIOLATIONS: ${drifts.length}`);
out.push(`EXIT: ${drifts.length > 0 ? 1 : 0}`);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, out.join('\n') + '\n', 'utf8');
console.log(out.join('\n'));
process.exit(drifts.length > 0 ? 1 : 0);
