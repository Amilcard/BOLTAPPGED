#!/usr/bin/env node
/**
 * audit/zod-sql-consistency.mjs
 *
 * Audit T4 — Décalage Zod ↔ SQL.
 *
 * Piège : z.enum([...]) TS accepte une valeur que CHECK IN (...) SQL rejette
 * → erreur 23514 silencieuse en prod.
 *
 * Approche : extrait les enums Zod TS + extrait les CHECK IN (...) SQL,
 * flag divergences par nom de champ quand détectable (payment_method, role,
 * status, methode, etc.).
 *
 * Scope : app/**, lib/** pour Zod ; sql/** + supabase/migrations/** pour CHECK.
 * Output : audit-reports/zod-sql-consistency.txt
 * Exit : 0 si aucune divergence détectée, 1 sinon.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'audit-reports');
const OUT_FILE = path.join(OUT_DIR, 'zod-sql-consistency.txt');

// Match simple z.enum(['a', 'b', 'c']) — pas les refs de const arrays.
const ZOD_ENUM_RE = /(\w+)\s*:\s*z\.enum\s*\(\s*\[\s*([^\]]+?)\s*\]\s*\)/g;
const CHECK_IN_RE = /CHECK\s*\(\s*(\w+)\s+IN\s*\(\s*([^)]+?)\s*\)\s*\)/gi;

function walk(dir, exts, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name === 'coverage') continue;
      walk(full, exts, acc);
    } else if (e.isFile() && exts.some((x) => e.name.endsWith(x))) {
      acc.push(full);
    }
  }
  return acc;
}

function parseValues(raw) {
  return raw
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

// 1. Extraire Zod enums
const zodFiles = [
  ...walk(path.join(ROOT, 'app'), ['.ts', '.tsx']),
  ...walk(path.join(ROOT, 'lib'), ['.ts']),
];
const zodEnums = {};
for (const file of zodFiles) {
  const content = readFileSync(file, 'utf8');
  let m;
  const re = new RegExp(ZOD_ENUM_RE.source, ZOD_ENUM_RE.flags);
  while ((m = re.exec(content)) !== null) {
    const column = m[1];
    const values = parseValues(m[2]);
    if (!zodEnums[column]) zodEnums[column] = [];
    zodEnums[column].push({ file: path.relative(ROOT, file), values });
  }
}

// 2. Extraire CHECK IN SQL
const sqlFiles = [
  ...walk(path.join(ROOT, 'sql'), ['.sql']),
  ...walk(path.join(ROOT, 'supabase/migrations'), ['.sql']),
];
const sqlChecks = {};
for (const file of sqlFiles) {
  const content = readFileSync(file, 'utf8');
  let m;
  const re = new RegExp(CHECK_IN_RE.source, CHECK_IN_RE.flags);
  while ((m = re.exec(content)) !== null) {
    const column = m[1];
    const values = parseValues(m[2]);
    if (!sqlChecks[column]) sqlChecks[column] = [];
    sqlChecks[column].push({ file: path.relative(ROOT, file), values });
  }
}

// 3. Croiser par nom de colonne
const divergences = [];
const matches = [];
const commonCols = Object.keys(zodEnums).filter((c) => sqlChecks[c]);
for (const col of commonCols) {
  const zodVals = new Set(zodEnums[col].flatMap((e) => e.values));
  // Plusieurs CHECK possibles (migrations successives) — prend le dernier fichier.
  const sqlLatest = sqlChecks[col].sort((a, b) => a.file.localeCompare(b.file)).pop();
  const sqlVals = new Set(sqlLatest.values);
  const inZodNotSql = [...zodVals].filter((v) => !sqlVals.has(v));
  const inSqlNotZod = [...sqlVals].filter((v) => !zodVals.has(v));
  if (inZodNotSql.length === 0 && inSqlNotZod.length === 0) {
    matches.push({ col, zodVals: [...zodVals], sqlVals: [...sqlVals] });
  } else {
    divergences.push({
      col,
      zodVals: [...zodVals],
      sqlVals: [...sqlVals],
      inZodNotSql,
      inSqlNotZod,
      zodFiles: zodEnums[col].map((e) => e.file),
      sqlFile: sqlLatest.file,
    });
  }
}

let sha = 'unknown';
try {
  sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch {
  /* ok */
}

const out = [];
out.push(`[zod-sql-consistency audit] ${new Date().toISOString()}  commit=${sha}`);
out.push(`scope: Zod=${zodFiles.length} files, SQL=${sqlFiles.length} files`);
out.push(`columns with both Zod + CHECK: ${commonCols.length}`);
out.push('');
out.push(`MATCH (Zod enum == CHECK IN SQL) — ${matches.length} :`);
for (const m of matches) {
  out.push(`  ${m.col} = [${m.zodVals.join(', ')}]`);
}
out.push('');
out.push(`DIVERGENCE (Zod accepte valeur que SQL rejette OU inverse) — ${divergences.length} ⚠️ T4 :`);
for (const d of divergences) {
  out.push(`  ${d.col}`);
  out.push(`    Zod  (${d.zodFiles.join(', ')}) = [${d.zodVals.join(', ')}]`);
  out.push(`    SQL  (${d.sqlFile}) = [${d.sqlVals.join(', ')}]`);
  if (d.inZodNotSql.length) out.push(`    ⚠️ Zod accepte mais SQL rejette : [${d.inZodNotSql.join(', ')}]`);
  if (d.inSqlNotZod.length) out.push(`    ⚠️ SQL accepte mais Zod rejette : [${d.inSqlNotZod.join(', ')}]`);
}
out.push('');
out.push('──────────────────────────────────────────────────────────────────────');
out.push(`TOTAL columns: ${commonCols.length} | match=${matches.length} | divergence=${divergences.length}`);
out.push(`VIOLATIONS: ${divergences.length}`);
out.push(`EXIT: ${divergences.length > 0 ? 1 : 0}`);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, out.join('\n') + '\n', 'utf8');
console.log(out.join('\n'));
process.exit(divergences.length > 0 ? 1 : 0);
