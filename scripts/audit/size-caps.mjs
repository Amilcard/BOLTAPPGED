#!/usr/bin/env node
/**
 * audit/size-caps.mjs
 *
 * Audit déterministe des caps de taille sur les routes qui acceptent un payload
 * user-controlled (formData, upload, json body long).
 *
 * Règle métier :
 *   - Toute route qui accepte un upload ou un gros body doit borner la taille
 *     (MAX_FILE_BYTES / MAX_BODY_BYTES / contentLength check) pour éviter :
 *     - DoS par upload massif
 *     - explosion mémoire serveur (FluidCompute partagé)
 *     - coût S3 illimité
 *
 * Patterns protections :
 *   - `request.formData()` doit être suivi d'un check sur `file.size`
 *   - S3 presign doit borner contentLength
 *   - `request.json()` pour form long doit checker contentLength header
 *
 * Scope : routes qui appellent formData() OU File/Blob OU presign S3.
 *
 * Output : audit-reports/size-caps.txt
 * Exit   : 0 si toutes capées, 1 sinon.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const API_DIR = path.join(ROOT, 'app/api');
const OUT_DIR = path.join(ROOT, 'audit-reports');
const OUT_FILE = path.join(OUT_DIR, 'size-caps.txt');

const UPLOAD_MARKERS = [
  /\brequest\.formData\s*\(/,
  /\breq\.formData\s*\(/,
  /getSignedUrl\s*\(.*PutObjectCommand/s,
  /PutObjectCommand/,
];

const SIZE_CAP_MARKERS = [
  /\bfile\.size\s*>/,
  /\bMAX_FILE_BYTES\b/,
  /\bMAX_UPLOAD_SIZE\b/,
  /\bMAX_BODY_SIZE\b/,
  /\bcontentLength\s*:/, // dans createPresignedPost
  /\bcontentLengthRange\b/,
  /\bConditions\s*:\s*\[[^\]]*content-length-range/s,
  /\s413\b/, // Payload Too Large status
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

function analyzeFile(absFile) {
  const src = readFileSync(absFile, 'utf8');
  const hasUpload = UPLOAD_MARKERS.some((p) => p.test(src));
  if (!hasUpload) return null;

  const hasCap = SIZE_CAP_MARKERS.some((p) => p.test(src));
  const firstMarker = UPLOAD_MARKERS.find((p) => p.test(src));
  const line = firstMarker ? src.slice(0, src.search(firstMarker)).split('\n').length : 1;
  return { file: absFile, line, capped: hasCap };
}

function formatRel(p) {
  return path.relative(ROOT, p);
}

function main() {
  const files = walk(API_DIR);
  const all = [];
  for (const f of files) {
    const r = analyzeFile(f);
    if (r) all.push(r);
  }

  const capped = all.filter((x) => x.capped);
  const uncapped = all.filter((x) => !x.capped);

  let sha = 'unknown';
  try {
    sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    // ok
  }
  const stamp = new Date().toISOString();

  const lines = [];
  lines.push(`[size-caps audit] ${stamp}  commit=${sha}`);
  lines.push(`scope: app/api/**/route.ts avec upload/formData/presign — ${all.length} route(s) détectée(s)`);
  lines.push('');

  lines.push(`CAPPED (cap de taille détecté) — ${capped.length} :`);
  for (const f of capped) lines.push(`  ${formatRel(f.file)}:${f.line}`);
  lines.push('');

  lines.push(`UNCAPPED (upload détecté mais aucun cap) — ${uncapped.length}  ⚠️ DoS :`);
  for (const f of uncapped) lines.push(`  ${formatRel(f.file)}:${f.line}`);
  lines.push('');

  lines.push('─'.repeat(70));
  lines.push(`TOTAL routes upload: ${all.length} | capped=${capped.length} | uncapped=${uncapped.length}`);
  lines.push(`VIOLATIONS: ${uncapped.length}`);
  lines.push(`EXIT: ${uncapped.length > 0 ? 1 : 0}`);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, lines.join('\n') + '\n', 'utf8');
  console.log(lines.join('\n'));
  process.exit(uncapped.length > 0 ? 1 : 0);
}

main();
