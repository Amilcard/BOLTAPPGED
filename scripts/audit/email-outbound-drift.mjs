#!/usr/bin/env node
/**
 * audit/email-outbound-drift.mjs
 *
 * Audit T2 bis — vérifie que chaque appel `tryResendSend` transporte
 * une `idempotency_key` issue du helper standardisé (sha256(template+resource+date_ymd)
 * ou UUID propagé).
 *
 * Règle : la signature tryResendSend({..., idempotencyKey?}) doit recevoir une clé
 * explicite quand le contexte de mutation est adjacent (évite double-envoi).
 *
 * Scope : app/api/**, lib/**
 * Output : audit-reports/email-outbound-drift.txt
 * Exit   : 0 si OK, 1 sinon.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'audit-reports');
const OUT_FILE = path.join(OUT_DIR, 'email-outbound-drift.txt');

const EMAIL_CALL_RE = /\btryResendSend\s*\(/;
const IDEMPOTENCY_RE = /\bidempotency(Key|_key)\b/;

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

const violations = [];
let total = 0;

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!EMAIL_CALL_RE.test(lines[i])) continue;
    total++;
    // Fenêtre de 20 lignes autour de l'appel pour chercher idempotencyKey
    const windowStart = Math.max(0, i - 5);
    const windowEnd = Math.min(lines.length, i + 20);
    const window = lines.slice(windowStart, windowEnd).join('\n');
    if (!IDEMPOTENCY_RE.test(window)) {
      violations.push({ file: rel, line: i + 1, preview: lines[i].trim().slice(0, 100) });
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
out.push(`[email-outbound-drift audit] ${new Date().toISOString()}  commit=${sha}`);
out.push(`scope: app/api + lib — ${files.length} fichier(s)`);
out.push('');
out.push(`TOTAL tryResendSend calls : ${total}`);
out.push(`WITHOUT idempotency_key (risque double-envoi) — ${violations.length} ⚠️ T2 :`);
for (const v of violations.slice(0, 50)) {
  out.push(`  ${v.file}:${v.line}  ${v.preview}`);
}
if (violations.length > 50) {
  out.push(`  ... et ${violations.length - 50} autres`);
}
out.push('');
out.push(`NOTE : l'idempotency_key recommandée est sha256(template + resource_id + date_ymd)`);
out.push(`       (voir CLAUDE.md §T2 et docs/SEMANTIC_GUARDS.md). À intégrer dans tryResendSend.`);
out.push('');
out.push('──────────────────────────────────────────────────────────────────────');
out.push(`VIOLATIONS: ${violations.length}`);
out.push(`EXIT: ${violations.length > 0 ? 1 : 0}`);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, out.join('\n') + '\n', 'utf8');
console.log(out.join('\n'));
process.exit(violations.length > 0 ? 1 : 0);
