#!/usr/bin/env node
/**
 * audit/all.mjs
 *
 * Runner déterministe : enchaîne tous les scripts d'audit dans
 * scripts/audit/ (*.mjs) sauf lui-même et produit un résumé consolidé
 * dans audit-reports/summary.txt.
 *
 * Exit 0 si tous les scripts exitent 0, 1 sinon (au moins un violation).
 *
 * Usage : node scripts/audit/all.mjs
 */
import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const AUDIT_DIR = path.join(ROOT, 'scripts/audit');
const OUT_DIR = path.join(ROOT, 'audit-reports');
const OUT_FILE = path.join(OUT_DIR, 'summary.txt');

const scripts = readdirSync(AUDIT_DIR)
  .filter((f) => f.endsWith('.mjs') && f !== 'all.mjs')
  .sort();

let sha = 'unknown';
try {
  sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch {
  // ok
}
const stamp = new Date().toISOString();

const results = [];
for (const s of scripts) {
  const full = path.join(AUDIT_DIR, s);
  const r = spawnSync('node', [full], {
    encoding: 'utf8',
    maxBuffer: 50_000_000,
    timeout: 60_000, // garde-fou CI : un script qui boucle ne doit pas bloquer le runner
  });
  const exitCode = r.status ?? 2;
  // Lit le rapport fichier (plus fiable que stdout quand process.exit coupe le flush).
  const reportName = s.replace(/\.mjs$/, '.txt');
  const reportPath = path.join(OUT_DIR, reportName);
  let violations = '?';
  if (existsSync(reportPath)) {
    const txt = readFileSync(reportPath, 'utf8');
    const vline = txt.split('\n').find((l) => l.startsWith('VIOLATIONS'));
    if (vline) violations = vline.replace(/^VIOLATIONS[^:]*:\s*/, '');
  }
  results.push({ script: s, exit: exitCode, violations });
}

const lines = [];
lines.push(`[audit summary] ${stamp}  commit=${sha}`);
lines.push('');
lines.push('Script                          | Exit | Violations');
lines.push('────────────────────────────────┼──────┼────────────');
for (const r of results) {
  lines.push(`${r.script.padEnd(32)}| ${String(r.exit).padStart(4)} | ${r.violations}`);
}
lines.push('');
const failed = results.filter((r) => r.exit !== 0);
lines.push(`TOTAL: ${results.length} scripts, ${failed.length} en violation`);
lines.push(`EXIT: ${failed.length > 0 ? 1 : 0}`);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, lines.join('\n') + '\n', 'utf8');
console.log(lines.join('\n'));
process.exit(failed.length > 0 ? 1 : 0);
