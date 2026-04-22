#!/usr/bin/env node
/**
 * audit/role-guards.mjs
 *
 * Audit déterministe des guards de rôle sur les routes app/api/structure/[code]/**.
 *
 * Règle métier (CLAUDE.md) :
 *   - Les routes write (POST/PATCH/DELETE/PUT) sur tables PII doivent utiliser
 *     `allowRoles: [...]` (whitelist STRICTE) — pas `excludeRoles: [...]`
 *     (blacklist FRAGILE : un nouveau rôle ajouté en DB passerait).
 *
 * Tables PII concernées : incidents, medical, calls, notes, dossier, upload,
 *   submit, pdf, pdf-email, invite, delegation, settings, team, route racine.
 *
 * Output : audit-reports/role-guards.txt (versionnable, grep-friendly)
 * Exit   : 0 si OK, 1 si FRAGILE ou MISSING sur un POST/PATCH/DELETE/PUT PII.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const STRUCTURE_DIR = path.join(ROOT, 'app/api/structure/[code]');
const OUT_DIR = path.join(ROOT, 'audit-reports');
const OUT_FILE = path.join(OUT_DIR, 'role-guards.txt');

const WRITE_METHODS = new Set(['POST', 'PATCH', 'DELETE', 'PUT']);
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
      const body = src.slice(match.index, match.index + 4000);

      let guard = 'MISSING';
      let roles = '-';

      const reqIdx = body.indexOf('requireStructureRole');
      if (reqIdx >= 0) {
        const window = body.slice(reqIdx, reqIdx + 400);
        const allowM = window.match(/allowRoles\s*:\s*\[([^\]]+)\]/);
        const excludeM = window.match(/excludeRoles\s*:\s*\[([^\]]+)\]/);
        if (allowM) {
          guard = 'STRICT';
          roles = allowM[1].replace(/\s+/g, '').replace(/['"]/g, '');
        } else if (excludeM) {
          guard = 'FRAGILE';
          roles = excludeM[1].replace(/\s+/g, '').replace(/['"]/g, '');
        } else {
          guard = 'DEFAULT';
          roles = '(no options)';
        }
      }

      findings.push({ method, file: absFile, line: startLine, guard, roles });
    }
  }
  return findings;
}

function formatRel(p) {
  return path.relative(ROOT, p);
}

function main() {
  const files = walk(STRUCTURE_DIR);
  const all = [];
  for (const f of files) all.push(...analyzeFile(f));

  const strict = all.filter((x) => x.guard === 'STRICT');
  const fragile = all.filter((x) => x.guard === 'FRAGILE');
  const missing = all.filter((x) => x.guard === 'MISSING');
  const defaultGuard = all.filter((x) => x.guard === 'DEFAULT');

  const writeFragile = fragile.filter((x) => WRITE_METHODS.has(x.method));
  const writeMissing = missing.filter((x) => WRITE_METHODS.has(x.method));
  const violations = writeFragile.length + writeMissing.length;

  let sha = 'unknown';
  try {
    sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    // pas grave si hors git
  }
  const stamp = new Date().toISOString();

  const lines = [];
  lines.push(`[role-guards audit] ${stamp}  commit=${sha}`);
  lines.push(`scope: app/api/structure/[code]/** — ${files.length} fichier(s), ${all.length} handler(s)`);
  lines.push('');

  lines.push(`STRICT (allowRoles) — ${strict.length} handler(s) :`);
  for (const f of strict) {
    lines.push(`  ${formatRel(f.file)}:${f.line}  ${f.method}  allowRoles=[${f.roles}]`);
  }
  lines.push('');

  lines.push(`FRAGILE (excludeRoles) — ${fragile.length} handler(s), ${writeFragile.length} sur route write :`);
  for (const f of fragile) {
    const flag = WRITE_METHODS.has(f.method) ? '  ⚠️ WRITE' : '';
    lines.push(`  ${formatRel(f.file)}:${f.line}  ${f.method}  excludeRoles=[${f.roles}]${flag}`);
  }
  lines.push('');

  lines.push(`DEFAULT (requireStructureRole sans options) — ${defaultGuard.length} handler(s) :`);
  for (const f of defaultGuard) {
    lines.push(`  ${formatRel(f.file)}:${f.line}  ${f.method}  (tous rôles autorisés sauf exclus par défaut)`);
  }
  lines.push('');

  lines.push(`MISSING (aucun requireStructureRole) — ${missing.length} handler(s), ${writeMissing.length} sur route write :`);
  for (const f of missing) {
    const flag = WRITE_METHODS.has(f.method) ? '  ⚠️ WRITE' : '';
    lines.push(`  ${formatRel(f.file)}:${f.line}  ${f.method}${flag}`);
  }
  lines.push('');

  lines.push('─'.repeat(70));
  lines.push(
    `TOTAL: strict=${strict.length}, fragile=${fragile.length}, default=${defaultGuard.length}, missing=${missing.length}`,
  );
  lines.push(`VIOLATIONS (write FRAGILE + write MISSING): ${violations}`);
  lines.push(`EXIT: ${violations > 0 ? 1 : 0}`);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, lines.join('\n') + '\n', 'utf8');

  console.log(lines.join('\n'));
  process.exit(violations > 0 ? 1 : 0);
}

main();
