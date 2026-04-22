#!/usr/bin/env node
/**
 * audit/sentry-coverage.mjs
 *
 * Audit T3 — Illusion du Grep (Sentry quality).
 *
 * Vérifie 2 règles :
 *   1. Aucun appel direct à `Sentry.captureException` hors lib/sentry-capture.ts
 *      → tout doit passer par `captureServerException(err, { domain, operation }, extra)`
 *   2. Chaque route PII mutable doit avoir SOIT `auditLog(` SOIT
 *      `captureServerException(` dans le corps
 *
 * Scope : app/api/**, lib/**
 * Output : audit-reports/sentry-coverage.txt
 * Exit   : 0 si OK, 1 sinon.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'audit-reports');
const OUT_FILE = path.join(OUT_DIR, 'sentry-coverage.txt');

// Zones PII (extrait de CLAUDE.md "Tables PII — liste à jour")
const PII_TABLES_RE = /\bfrom\s*\(\s*['"`](gd_(inscriptions|dossier_enfant|propositions_tarifaires|factures|suivi_incidents|suivi_medical|suivi_calls|suivi_notes|structure_access_codes|educateur_emails|stay_sessions|souhaits|incidents|medical_events|calls|notes)|smart_form_submissions)['"`]/;
const MUTATION_RE = /\.(insert|update|upsert|delete)\s*\(/;
const AUDIT_LOG_RE = /\bauditLog\s*\(/;
const CAPTURE_SERVER_RE = /\bcaptureServer(Exception|Message)\s*\(/;
const RAW_SENTRY_RE = /\bSentry\.capture(Exception|Message)\s*\(/;

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
      if (['node_modules', '.next', 'tests', 'coverage'].includes(e.name)) continue;
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

const rawSentryViolations = [];
const uncoveredPiiRoutes = [];

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const content = readFileSync(file, 'utf8');

  // Règle 1 : Sentry.captureException direct
  if (rel !== 'lib/sentry-capture.ts') {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (RAW_SENTRY_RE.test(lines[i])) {
        rawSentryViolations.push({ file: rel, line: i + 1, preview: lines[i].trim().slice(0, 100) });
      }
    }
  }

  // Règle 2 : route PII mutable sans couverture
  if (rel.startsWith('app/api/') && rel.endsWith('route.ts')) {
    const hasMutationOnPii = PII_TABLES_RE.test(content) && MUTATION_RE.test(content);
    if (hasMutationOnPii) {
      const hasAudit = AUDIT_LOG_RE.test(content);
      const hasCapture = CAPTURE_SERVER_RE.test(content);
      if (!hasAudit && !hasCapture) {
        uncoveredPiiRoutes.push(rel);
      }
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
out.push(`[sentry-coverage audit] ${new Date().toISOString()}  commit=${sha}`);
out.push(`scope: app/api + lib — ${files.length} fichier(s)`);
out.push('');
out.push(`RAW_SENTRY (appel direct Sentry.captureException hors helper) — ${rawSentryViolations.length} ⚠️ T3 :`);
for (const v of rawSentryViolations) {
  out.push(`  ${v.file}:${v.line}  ${v.preview}`);
}
out.push('');
out.push(`UNCOVERED_PII_ROUTES (mutation table PII sans auditLog ni captureServer*) — ${uncoveredPiiRoutes.length} ⚠️ :`);
for (const r of uncoveredPiiRoutes.slice(0, 50)) {
  out.push(`  ${r}`);
}
if (uncoveredPiiRoutes.length > 50) {
  out.push(`  ... et ${uncoveredPiiRoutes.length - 50} autres`);
}
out.push('');
out.push('──────────────────────────────────────────────────────────────────────');
const total = rawSentryViolations.length + uncoveredPiiRoutes.length;
out.push(`VIOLATIONS: ${total} (raw_sentry=${rawSentryViolations.length}, uncovered_pii=${uncoveredPiiRoutes.length})`);
out.push(`EXIT: ${total > 0 ? 1 : 0}`);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, out.join('\n') + '\n', 'utf8');
console.log(out.join('\n'));
process.exit(total > 0 ? 1 : 0);
