#!/usr/bin/env node
/**
 * audit/idempotency.mjs
 *
 * Audit déterministe de l'idempotence sur les routes POST write critiques.
 *
 * Règle métier :
 *   - Un double-submit client (double-clic, retry réseau, renvoi webhook) ne
 *     doit pas créer 2 enregistrements.
 *   - Protections acceptées (au moins UNE) :
 *     (a) Header `Idempotency-Key` / `idempotencyKey` lu côté serveur
 *     (b) `clientRequestId` / `client_request_id` / `requestId`
 *     (c) Commentaire marqueur `// idempotent: <raison>` signalant que la
 *         protection est au niveau DB (unique constraint) — obligeant le dev
 *         à documenter pourquoi l'idempotence est garantie.
 *
 * Scope : POST handlers dans zones write PII (structure/[code]/**, dossier-enfant/**,
 *         inscriptions/**, webhooks/stripe, pro/propositions).
 *
 * Output : audit-reports/idempotency.txt
 * Exit   : 0 si toutes protégées, 1 sinon.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const API_DIR = path.join(ROOT, 'app/api');
const OUT_DIR = path.join(ROOT, 'audit-reports');
const OUT_FILE = path.join(OUT_DIR, 'idempotency.txt');

const CRITICAL_ZONES = [
  'app/api/structure/',
  'app/api/dossier-enfant/',
  'app/api/inscriptions/',
  'app/api/webhooks/',
  'app/api/pro/propositions/',
  'app/api/souhaits/',
];

const PROTECTION_PATTERNS = [
  /Idempotency-Key/i,
  /idempotencyKey/,
  /clientRequestId/,
  /client_request_id/,
  /requestId.*headers\.get/,
  /\/\/\s*idempotent\s*:/i, // commentaire explicite
  /ON CONFLICT/i, // SQL unique constraint dans l'appel (raw SQL)
  /constructEvent\b/, // Stripe webhook — Stripe gère l'idempotence côté leur infra via event.id
];

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

function isCritical(relPath) {
  return CRITICAL_ZONES.some((z) => relPath.startsWith(z));
}

function analyzeFile(absFile) {
  const src = readFileSync(absFile, 'utf8');
  const findings = [];
  // Uniquement POST pour l'audit idempotence — PATCH/DELETE ont d'autres protections (rowId).
  const re = /export\s+async\s+function\s+POST\b/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const startLine = src.slice(0, m.index).split('\n').length;
    const rest = src.slice(m.index);
    const nextExport = rest.slice(10).search(/export\s+async\s+function\s+(GET|POST|PATCH|DELETE|PUT)\b/);
    const body = nextExport > 0 ? rest.slice(0, nextExport + 10) : rest;

    const protection = PROTECTION_PATTERNS.find((p) => p.test(body));
    findings.push({
      file: absFile,
      line: startLine,
      protected: !!protection,
      protectionType: protection ? protection.source.slice(0, 30) : null,
    });
  }
  return findings;
}

function formatRel(p) {
  return path.relative(ROOT, p);
}

function main() {
  const files = walk(API_DIR)
    .map((f) => ({ abs: f, rel: formatRel(f) }))
    .filter((f) => isCritical(f.rel));

  const all = [];
  for (const f of files) all.push(...analyzeFile(f.abs));

  const protectedH = all.filter((x) => x.protected);
  const unprotected = all.filter((x) => !x.protected);

  let sha = 'unknown';
  try {
    sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    // ok
  }
  const stamp = new Date().toISOString();

  const lines = [];
  lines.push(`[idempotency audit] ${stamp}  commit=${sha}`);
  lines.push(
    `scope: POST handlers dans zones critiques (${CRITICAL_ZONES.length}) — ${files.length} fichier(s), ${all.length} POST(s)`,
  );
  lines.push('');

  lines.push(`PROTECTED (idempotence détectée) — ${protectedH.length} :`);
  for (const f of protectedH)
    lines.push(`  ${formatRel(f.file)}:${f.line}  POST  via=${f.protectionType}`);
  lines.push('');

  lines.push(`UNPROTECTED (aucune idempotence détectée) — ${unprotected.length}  ⚠️ DOUBLE-SUBMIT :`);
  for (const f of unprotected) lines.push(`  ${formatRel(f.file)}:${f.line}  POST`);
  lines.push('');

  lines.push('─'.repeat(70));
  lines.push(`TOTAL: protected=${protectedH.length}, unprotected=${unprotected.length}`);
  lines.push(
    `NOTE : un POST sur une table PII sans idempotence = doublon possible à chaque double-clic.`,
  );
  lines.push(
    `       Si protégé par contrainte DB unique, ajouter commentaire '// idempotent: ...' pour documenter.`,
  );
  lines.push(`VIOLATIONS: ${unprotected.length}`);
  lines.push(`EXIT: ${unprotected.length > 0 ? 1 : 0}`);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, lines.join('\n') + '\n', 'utf8');
  console.log(lines.join('\n'));
  process.exit(unprotected.length > 0 ? 1 : 0);
}

main();
