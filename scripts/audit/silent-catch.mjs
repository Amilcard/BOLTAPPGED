#!/usr/bin/env node
/**
 * audit/silent-catch.mjs
 *
 * Audit déterministe des catch blocks silencieux dans les routes API et lib/.
 *
 * Règle métier :
 *   - Un catch doit TOUJOURS faire au moins 1 de :
 *     (a) throw / re-throw
 *     (b) return NextResponse.json({ error ... })
 *     (c) captureServerException / Sentry.captureException
 *   - catch {} vide = silent failure → invisibilité en prod.
 *   - catch { console.log(...) } seul = pas grave mais suspect (oublié).
 *
 * Output : audit-reports/silent-catch.txt
 * Exit   : 0 si OK, 1 si au moins un catch silencieux (sans sentry, sans re-throw,
 *          sans return error) détecté dans app/api/ ou lib/.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = [path.join(ROOT, 'app/api'), path.join(ROOT, 'lib')];
const OUT_DIR = path.join(ROOT, 'audit-reports');
const OUT_FILE = path.join(OUT_DIR, 'silent-catch.txt');

const ACTION_PATTERNS = [
  /\bthrow\b/,
  /\bcaptureServerException\s*\(/,
  /\bcaptureServerMessage\s*\(/,
  /\bSentry\.captureException\s*\(/,
  /NextResponse\.json\s*\(\s*\{\s*['"]?(error|success)/,
  /errorResponse\s*\(/,
  /unauthorizedResponse\s*\(/,
  /forbiddenResponse\s*\(/,
  /notFoundResponse\s*\(/,
  /\breturn\s+new\s+Response/,
  /\breturn\s+\{\s*error/,
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
    else if (e.isFile() && /\.(ts|tsx|mjs|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

/**
 * Match chaque catch block et extrait son contenu avec brace-matching.
 */
function extractCatchBlocks(src) {
  const blocks = [];
  const re = /catch\s*(?:\([^)]*\))?\s*\{/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const start = m.index + m[0].length - 1; // position du `{`
    let depth = 1;
    let i = start + 1;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      i++;
    }
    if (depth === 0) {
      const body = src.slice(start + 1, i - 1);
      const line = src.slice(0, m.index).split('\n').length;
      blocks.push({ body, line, matchIdx: m.index });
    }
  }
  return blocks;
}

function analyzeFile(absFile) {
  const src = readFileSync(absFile, 'utf8');
  const blocks = extractCatchBlocks(src);
  const findings = [];

  for (const b of blocks) {
    const trimmed = b.body.trim();
    // Extrait tous les commentaires (//... et /*...*/, multi-lignes)
    const comments = [];
    for (const m of b.body.matchAll(/\/\*[\s\S]*?\*\//g)) comments.push(m[0].slice(2, -2).trim());
    for (const m of b.body.matchAll(/\/\/[^\n]*/g)) comments.push(m[0].slice(2).trim());
    const commentTextLen = comments.join(' ').replace(/\s+/g, ' ').trim().length;

    // Le body est "comment-only" si, après suppression de tous les commentaires, rien ne reste.
    const withoutComments = b.body
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
      .trim();
    const isCommentOnly = withoutComments === '';
    const isTrulyEmpty = trimmed === '';

    const hasAction = ACTION_PATTERNS.some((p) => p.test(b.body));
    const hasOnlyConsole = /console\.(log|warn|error|info)/.test(withoutComments) && !hasAction;

    let classification = 'OK';
    if (isTrulyEmpty) classification = 'EMPTY';
    else if (isCommentOnly && commentTextLen < 10) classification = 'EMPTY'; // commentaire trop court = pas une vraie justification
    else if (isCommentOnly && commentTextLen >= 10) classification = 'OK'; // catch intentionnel documenté — acceptable
    else if (!hasAction && hasOnlyConsole) classification = 'CONSOLE_ONLY';
    else if (!hasAction) classification = 'NO_ACTION';

    if (classification !== 'OK') {
      findings.push({ file: absFile, line: b.line, classification, preview: trimmed.slice(0, 80).replace(/\n/g, ' ') });
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

  const empty = all.filter((x) => x.classification === 'EMPTY');
  const consoleOnly = all.filter((x) => x.classification === 'CONSOLE_ONLY');
  const noAction = all.filter((x) => x.classification === 'NO_ACTION');

  let sha = 'unknown';
  try {
    sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    // ok
  }
  const stamp = new Date().toISOString();

  const lines = [];
  lines.push(`[silent-catch audit] ${stamp}  commit=${sha}`);
  lines.push(`scope: app/api/ + lib/ — ${files.length} fichier(s), ${all.length} catch block(s) suspect(s)`);
  lines.push('');

  lines.push(`EMPTY (catch vide ou commentaires seulement) — ${empty.length}  ⚠️ BLOQUANT :`);
  for (const f of empty) lines.push(`  ${formatRel(f.file)}:${f.line}  { ${f.preview} }`);
  lines.push('');

  lines.push(`CONSOLE_ONLY (catch avec console.* mais pas de return/throw/sentry) — ${consoleOnly.length}  ⚠️ :`);
  for (const f of consoleOnly) lines.push(`  ${formatRel(f.file)}:${f.line}  { ${f.preview} }`);
  lines.push('');

  lines.push(`NO_ACTION (catch sans return/throw/sentry, pas non plus console) — ${noAction.length}  ⚠️ :`);
  for (const f of noAction) lines.push(`  ${formatRel(f.file)}:${f.line}  { ${f.preview} }`);
  lines.push('');

  const violations = empty.length + consoleOnly.length + noAction.length;
  lines.push('─'.repeat(70));
  lines.push(`TOTAL catch suspects: ${violations} (empty=${empty.length}, console-only=${consoleOnly.length}, no-action=${noAction.length})`);
  lines.push(`VIOLATIONS: ${violations}`);
  lines.push(`EXIT: ${violations > 0 ? 1 : 0}`);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, lines.join('\n') + '\n', 'utf8');
  console.log(lines.join('\n'));
  process.exit(violations > 0 ? 1 : 0);
}

main();
