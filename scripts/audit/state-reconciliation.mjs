#!/usr/bin/env node
/**
 * audit/state-reconciliation.mjs
 *
 * Audit T2 — Fragmentation de l'État (State Desync).
 *
 * Piège : UPDATE DB suivi d'un envoi email sans trace de réconciliation
 * (paiement OK + DB OK + email KO = client payé sans confirmation).
 *
 * Vérifie que dans tout fichier qui contient à la fois :
 *   - une mutation `.insert|update|upsert` sur table PII/financière
 *   - un appel à `tryResendSend(` ou `sendPriceInquiry*|sendProAccess*|send*Email*`
 * le fichier mentionne aussi `gd_outbound_emails` (le registre de réconciliation).
 *
 * Scope : app/api/**, lib/**
 * Output : audit-reports/state-reconciliation.txt
 * Exit   : 0 si OK, 1 sinon.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'audit-reports');
const OUT_FILE = path.join(OUT_DIR, 'state-reconciliation.txt');

const MUTATION_RE = /\.(insert|update|upsert)\s*\(/;
const EMAIL_RE = /\b(tryResendSend|send\w+Email|send\w+Confirmation|send\w+Alert\w*)\s*\(/;
const OUTBOUND_RE = /gd_outbound_emails/;

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

const missingReconciliation = [];

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const content = readFileSync(file, 'utf8');
  const hasMutation = MUTATION_RE.test(content);
  const hasEmail = EMAIL_RE.test(content);
  const hasOutbound = OUTBOUND_RE.test(content);
  // Fichier qui combine mutation + email mais ne log pas dans gd_outbound_emails
  if (hasMutation && hasEmail && !hasOutbound) {
    missingReconciliation.push(rel);
  }
}

let sha = 'unknown';
try {
  sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch {
  /* ok */
}

const out = [];
out.push(`[state-reconciliation audit] ${new Date().toISOString()}  commit=${sha}`);
out.push(`scope: app/api + lib — ${files.length} fichier(s)`);
out.push('');
out.push(`MISSING_RECONCILIATION (mutation + email sans gd_outbound_emails) — ${missingReconciliation.length} ⚠️ T2 :`);
for (const r of missingReconciliation.slice(0, 50)) {
  out.push(`  ${r}`);
}
if (missingReconciliation.length > 50) {
  out.push(`  ... et ${missingReconciliation.length - 50} autres`);
}
out.push('');
out.push(`NOTE : ce check passera quand migration 085 sera déployée ET lib/email.ts`);
out.push(`       câble l'insertion dans gd_outbound_emails. D'ici là : violations attendues.`);
out.push('');
out.push('──────────────────────────────────────────────────────────────────────');
out.push(`VIOLATIONS: ${missingReconciliation.length}`);
out.push(`EXIT: ${missingReconciliation.length > 0 ? 1 : 0}`);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, out.join('\n') + '\n', 'utf8');
console.log(out.join('\n'));
process.exit(missingReconciliation.length > 0 ? 1 : 0);
