#!/usr/bin/env node
/**
 * audit/pii-logs.mjs
 *
 * Audit déterministe des fuites PII dans les console.log/error/warn.
 *
 * Règle métier (RGPD / CNIL) :
 *   - Aucune donnée personnelle identifiante (PII) ne doit apparaître en clair
 *     dans les logs serveur :
 *     email complet, prénom/nom d'enfant, date de naissance, téléphone,
 *     adresse, numéro de sécu, suivi_token complet, JWT complet.
 *   - Les logs applicatifs doivent utiliser des IDs anonymisés / ou masquer.
 *
 * Approche :
 *   - Scanne les `console.*` dans app/ lib/ scripts/
 *   - Flag si l'expression loggée contient un champ PII par nom (via interpolation)
 *
 * Output : audit-reports/pii-logs.txt
 * Exit   : 0 si 0 leak, 1 sinon.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = [path.join(ROOT, 'app'), path.join(ROOT, 'lib')];
const OUT_DIR = path.join(ROOT, 'audit-reports');
const OUT_FILE = path.join(OUT_DIR, 'pii-logs.txt');

// Patterns PII dans une expression de log (interpolation ou concat).
// On cible les NOMS de champs PII qui pourraient être injectés.
const PII_FIELDS = [
  'email',
  'firstName',
  'lastName',
  'first_name',
  'last_name',
  'prenom',
  'nom_enfant',
  'prenom_enfant',
  'dateNaissance',
  'date_naissance',
  'dateDeNaissance',
  'birthDate',
  'birth_date',
  'phone',
  'telephone',
  'mobile',
  'address',
  'adresse',
  'numSecu',
  'num_secu',
  'socialSecurity',
  'suivi_token',
  'suiviToken',
  'token',
  'password',
  'passwordHash',
  'jwt',
];

// Patterns autorisés (IDs anonymes / metadata non-PII).
const ALLOW_MARKERS = ['id', 'inscription_id', 'structure_id', 'count', 'status'];

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && !['node_modules', '.next', 'dist', 'out'].includes(e.name))
      out.push(...walk(p));
    else if (e.isFile() && /\.(ts|tsx|mjs|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

/**
 * Extrait les console.* calls avec balance parenthèses.
 */
function extractConsoleCalls(src) {
  const calls = [];
  const re = /console\.(log|warn|error|info|debug)\s*\(/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const start = m.index + m[0].length - 1;
    let depth = 1;
    let i = start + 1;
    let inStr = null;
    while (i < src.length && depth > 0) {
      const c = src[i];
      const prev = src[i - 1];
      if (inStr) {
        if (c === inStr && prev !== '\\') inStr = null;
      } else if (c === '"' || c === "'" || c === '`') {
        inStr = c;
      } else if (c === '(') depth++;
      else if (c === ')') depth--;
      i++;
    }
    if (depth === 0) {
      const call = src.slice(m.index, i);
      const line = src.slice(0, m.index).split('\n').length;
      calls.push({ call, line, level: m[1] });
    }
  }
  return calls;
}

function hasPII(call) {
  const hits = [];
  for (const field of PII_FIELDS) {
    const re = new RegExp(`\\b${field}\\b`, 'i');
    if (re.test(call)) hits.push(field);
  }
  return hits;
}

function analyzeFile(absFile) {
  const src = readFileSync(absFile, 'utf8');
  const calls = extractConsoleCalls(src);
  const findings = [];
  for (const c of calls) {
    const hits = hasPII(c.call);
    if (hits.length > 0) {
      findings.push({
        file: absFile,
        line: c.line,
        level: c.level,
        hits,
        preview: c.call.replace(/\s+/g, ' ').slice(0, 120),
      });
    }
  }
  return findings;
}

function formatRel(p) {
  return path.relative(ROOT, p);
}

function main() {
  const files = SCAN_DIRS.flatMap((d) => walk(d));
  const all = [];
  for (const f of files) all.push(...analyzeFile(f));

  let sha = 'unknown';
  try {
    sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    // ok
  }
  const stamp = new Date().toISOString();

  const lines = [];
  lines.push(`[pii-logs audit] ${stamp}  commit=${sha}`);
  lines.push(`scope: app/ + lib/ — ${files.length} fichier(s), ${all.length} console.* suspect(s)`);
  lines.push('');

  lines.push(`LEAKS DÉTECTÉS — ${all.length} log(s) avec champ PII dans expression  ⚠️ RGPD :`);
  for (const f of all) {
    lines.push(`  ${formatRel(f.file)}:${f.line}  console.${f.level}  hits=[${f.hits.join(',')}]`);
    lines.push(`    ${f.preview}`);
  }
  lines.push('');

  lines.push('─'.repeat(70));
  lines.push(`NOTE : faux positifs possibles sur nom de variable qui contient "email" mais ne loggue pas la valeur.`);
  lines.push(`       À filtrer via LLM après pour juger chaque cas.`);
  lines.push(`VIOLATIONS candidates: ${all.length}`);
  lines.push(`EXIT: ${all.length > 0 ? 1 : 0}`);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, lines.join('\n') + '\n', 'utf8');
  console.log(lines.join('\n'));
  process.exit(all.length > 0 ? 1 : 0);
}

main();
