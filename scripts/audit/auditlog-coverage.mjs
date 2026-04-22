#!/usr/bin/env node
/**
 * audit/auditlog-coverage.mjs
 *
 * Audit déterministe de la couverture `auditLog(...)` sur les routes write
 * (POST/PATCH/DELETE/PUT) de l'API.
 *
 * Règle métier (RGPD / CNIL) :
 *   - Toute route write qui touche une table PII doit logger dans
 *     gd_audit_log via lib/audit-log.ts → `auditLog(...)`.
 *   - Preuve traçabilité : qui a modifié quoi, quand, depuis quelle IP.
 *
 * Scope inclus : app/api/** hors /webhooks/ (Stripe géré séparément)
 *                et hors /cron/ (events internes).
 *
 * Output : audit-reports/auditlog-coverage.txt
 * Exit   : 0 si OK, 1 si handlers write sans auditLog dans les zones PII
 *          (admin, structure, dossier-enfant, suivi, pro, inscriptions).
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const API_DIR = path.join(ROOT, 'app/api');
const OUT_DIR = path.join(ROOT, 'audit-reports');
const OUT_FILE = path.join(OUT_DIR, 'auditlog-coverage.txt');

const WRITE_METHODS = ['POST', 'PATCH', 'DELETE', 'PUT'];

// Zones PII critiques (RGPD) — un miss ici = violation bloquante.
const PII_ZONES = [
  'app/api/admin/',
  'app/api/structure/',
  'app/api/dossier-enfant/',
  'app/api/suivi/',
  'app/api/pro/',
  'app/api/inscriptions/',
  'app/api/educateur/',
  'app/api/souhaits/',
];

// Zones exclues du scope (logging ad-hoc ou non-PII).
const EXCLUDED = ['app/api/webhooks/', 'app/api/cron/', 'app/api/waitlist/'];

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

function isPII(relPath) {
  return PII_ZONES.some((z) => relPath.startsWith(z));
}
function isExcluded(relPath) {
  return EXCLUDED.some((z) => relPath.startsWith(z));
}

function analyzeFile(absFile) {
  const src = readFileSync(absFile, 'utf8');
  const findings = [];

  for (const method of WRITE_METHODS) {
    const re = new RegExp(`export\\s+async\\s+function\\s+${method}\\b`, 'g');
    let match;
    while ((match = re.exec(src)) !== null) {
      const startLine = src.slice(0, match.index).split('\n').length;
      // scan jusqu'au prochain export async function ou fin de fichier
      const rest = src.slice(match.index);
      const nextExport = rest.slice(10).search(/export\s+async\s+function\s+(GET|POST|PATCH|DELETE|PUT)\b/);
      const body = nextExport > 0 ? rest.slice(0, nextExport + 10) : rest;

      const hasAuditLog = /\bauditLog\s*\(/.test(body);

      findings.push({
        method,
        file: absFile,
        line: startLine,
        covered: hasAuditLog,
      });
    }
  }
  return findings;
}

function formatRel(p) {
  return path.relative(ROOT, p);
}

function main() {
  const files = walk(API_DIR)
    .map((f) => ({ abs: f, rel: formatRel(f) }))
    .filter((f) => !isExcluded(f.rel));

  const all = [];
  for (const f of files) all.push(...analyzeFile(f.abs));

  const covered = all.filter((x) => x.covered);
  const missing = all.filter((x) => !x.covered);

  const missingPII = missing.filter((x) => isPII(formatRel(x.file)));
  const missingNonPII = missing.filter((x) => !isPII(formatRel(x.file)));

  let sha = 'unknown';
  try {
    sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    // ok
  }
  const stamp = new Date().toISOString();

  const lines = [];
  lines.push(`[auditlog-coverage audit] ${stamp}  commit=${sha}`);
  lines.push(
    `scope: app/api/**/route.ts (hors webhooks/cron/waitlist) — ${files.length} fichier(s), ${all.length} handler(s) write`,
  );
  lines.push('');

  lines.push(`COVERED (auditLog trouvé) — ${covered.length} handler(s) :`);
  for (const f of covered) lines.push(`  ${formatRel(f.file)}:${f.line}  ${f.method}`);
  lines.push('');

  lines.push(`MISSING (aucun auditLog) sur zone PII — ${missingPII.length} handler(s)  ⚠️ RGPD :`);
  for (const f of missingPII) lines.push(`  ${formatRel(f.file)}:${f.line}  ${f.method}`);
  lines.push('');

  lines.push(`MISSING sur zone non-PII (info) — ${missingNonPII.length} handler(s) :`);
  for (const f of missingNonPII) lines.push(`  ${formatRel(f.file)}:${f.line}  ${f.method}`);
  lines.push('');

  lines.push('─'.repeat(70));
  lines.push(
    `TOTAL write: ${all.length} | covered=${covered.length} | missing=${missing.length} (PII=${missingPII.length}, non-PII=${missingNonPII.length})`,
  );
  lines.push(`VIOLATIONS (missing sur zone PII): ${missingPII.length}`);
  lines.push(`EXIT: ${missingPII.length > 0 ? 1 : 0}`);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, lines.join('\n') + '\n', 'utf8');
  console.log(lines.join('\n'));
  process.exit(missingPII.length > 0 ? 1 : 0);
}

main();
