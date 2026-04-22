#!/usr/bin/env node
/**
 * audit/cron-secret.mjs
 *
 * Audit déterministe de la protection des endpoints cron.
 *
 * Règle métier :
 *   - Chaque handler sous app/api/cron/** doit vérifier CRON_SECRET :
 *     pattern attendu : `process.env.CRON_SECRET` + check d'Authorization Bearer.
 *   - Un cron non protégé = endpoint public qui peut déclencher n'importe quand
 *     des purges, relances, etc. (DoS, abus, corruption de données).
 *
 * Output : audit-reports/cron-secret.txt
 * Exit   : 0 si tous les cron sont protégés, 1 sinon.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const CRON_DIR = path.join(ROOT, 'app/api/cron');
const OUT_DIR = path.join(ROOT, 'audit-reports');
const OUT_FILE = path.join(OUT_DIR, 'cron-secret.txt');

const METHODS = ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'];

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
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile() && e.name === 'route.ts') out.push(p);
  }
  return out;
}

function analyzeFile(absFile) {
  const src = readFileSync(absFile, 'utf8');
  const findings = [];
  for (const method of METHODS) {
    const re = new RegExp(`export\\s+async\\s+function\\s+${method}\\b`, 'g');
    let match;
    while ((match = re.exec(src)) !== null) {
      const startLine = src.slice(0, match.index).split('\n').length;
      const rest = src.slice(match.index);
      const nextExport = rest.slice(10).search(/export\s+async\s+function\s+(GET|POST|PATCH|DELETE|PUT)\b/);
      const body = nextExport > 0 ? rest.slice(0, nextExport + 10) : rest;

      const hasSecretRead = /process\.env\.CRON_SECRET/.test(body);
      const hasBearerCheck =
        /authorization.*Bearer\s*\$\{(secret|process\.env\.CRON_SECRET)\}/.test(body) ||
        /authHeader.*!==\s*`Bearer\s*\$\{secret\}`/.test(body) ||
        /authHeader.*!==\s*`Bearer\s*\$\{process\.env\.CRON_SECRET\}`/.test(body);

      let status = 'UNPROTECTED';
      if (hasSecretRead && hasBearerCheck) status = 'PROTECTED';
      else if (hasSecretRead) status = 'PARTIAL'; // lit le secret mais check imparfait

      findings.push({ method, file: absFile, line: startLine, status });
    }
  }
  return findings;
}

function formatRel(p) {
  return path.relative(ROOT, p);
}

function main() {
  const files = walk(CRON_DIR);
  const all = [];
  for (const f of files) all.push(...analyzeFile(f));

  const protectedH = all.filter((x) => x.status === 'PROTECTED');
  const partial = all.filter((x) => x.status === 'PARTIAL');
  const unprotected = all.filter((x) => x.status === 'UNPROTECTED');

  let sha = 'unknown';
  try {
    sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    // ok
  }
  const stamp = new Date().toISOString();

  const lines = [];
  lines.push(`[cron-secret audit] ${stamp}  commit=${sha}`);
  lines.push(`scope: app/api/cron/** — ${files.length} fichier(s), ${all.length} handler(s)`);
  lines.push('');

  lines.push(`PROTECTED (CRON_SECRET + Bearer check) — ${protectedH.length} :`);
  for (const f of protectedH) lines.push(`  ${formatRel(f.file)}:${f.line}  ${f.method}`);
  lines.push('');

  lines.push(`PARTIAL (lit CRON_SECRET mais Bearer check non standard) — ${partial.length}  ⚠️ :`);
  for (const f of partial) lines.push(`  ${formatRel(f.file)}:${f.line}  ${f.method}`);
  lines.push('');

  lines.push(`UNPROTECTED (aucun CRON_SECRET détecté) — ${unprotected.length}  ⚠️ BLOQUANT :`);
  for (const f of unprotected) lines.push(`  ${formatRel(f.file)}:${f.line}  ${f.method}`);
  lines.push('');

  const violations = unprotected.length + partial.length;
  lines.push('─'.repeat(70));
  lines.push(`TOTAL: protected=${protectedH.length}, partial=${partial.length}, unprotected=${unprotected.length}`);
  lines.push(`VIOLATIONS: ${violations}`);
  lines.push(`EXIT: ${violations > 0 ? 1 : 0}`);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, lines.join('\n') + '\n', 'utf8');
  console.log(lines.join('\n'));
  process.exit(violations > 0 ? 1 : 0);
}

main();
