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
 * Deux couches :
 *   1. HANDLER-level : chaque handler POST/PATCH/DELETE/PUT sur zone PII
 *      doit contenir au moins un auditLog() dans son corps.
 *   2. MUTATION-level (strict, Axe 3.3) : chaque appel
 *      `.from('gd_<pii_table>').(insert|update|delete)(...)` doit être
 *      précédé ou suivi d'un `auditLog(` dans le handler englobant
 *      (entre deux `export async function METHOD`).
 *
 * Scope : app/api/** hors /webhooks/ (Stripe géré séparément)
 *         et hors /cron/ (events internes).
 *
 * Output : audit-reports/auditlog-coverage.txt
 * Exit   : 0 si aucune violation PII (handler OU mutation),
 *          1 sinon.
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

// Tables PII (source de vérité : CLAUDE.md § "Tables PII").
// Toute mutation sur ces tables DOIT appeler auditLog() dans ±15 lignes.
const PII_TABLES = [
  'gd_inscriptions',
  'gd_dossier_enfant',
  'gd_propositions_tarifaires',
  'gd_factures',
  'gd_incidents',
  'gd_medical_events',
  'gd_calls',
  'gd_notes',
  'gd_structure_access_codes',
  'gd_educateur_emails',
  'gd_stay_sessions',
  'gd_souhaits',
  'smart_form_submissions',
];

/**
 * Retourne les bornes [start, end] (en numéros de ligne 1-based) du handler
 * englobant la ligne `lineNo` dans le fichier dont les lignes sont passées.
 * Si aucun handler trouvé, retourne [1, lines.length].
 */
function findEnclosingHandler(lines, lineNo) {
  // Trouve le dernier `export async function (GET|POST|PATCH|DELETE|PUT)` avant lineNo.
  const headerRe = /export\s+async\s+function\s+(GET|POST|PATCH|DELETE|PUT)\b/;
  let start = 0;
  for (let i = 0; i < lineNo; i++) {
    if (headerRe.test(lines[i])) start = i;
  }
  // Trouve le prochain `export async function` après start.
  let end = lines.length - 1;
  for (let i = start + 1; i < lines.length; i++) {
    if (headerRe.test(lines[i])) {
      end = i - 1;
      break;
    }
  }
  return [start, end];
}

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

/**
 * Analyse handler-level : un handler write a-t-il au moins un auditLog() ?
 */
function analyzeHandlers(absFile) {
  const src = readFileSync(absFile, 'utf8');
  const findings = [];

  for (const method of WRITE_METHODS) {
    const re = new RegExp(`export\\s+async\\s+function\\s+${method}\\b`, 'g');
    let match;
    while ((match = re.exec(src)) !== null) {
      const startLine = src.slice(0, match.index).split('\n').length;
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

/**
 * Analyse mutation-level : chaque .from('gd_pii_table').(insert|update|delete)(
 * a-t-il un auditLog() dans ±AUDITLOG_WINDOW lignes ?
 */
function analyzeMutations(absFile) {
  const src = readFileSync(absFile, 'utf8');
  const lines = src.split('\n');
  const findings = [];

  // Regex : capture .from('gd_XXX') ... .(insert|update|delete)(
  //         ou la forme multi-ligne via from(...) chaînée dans les ~4 lignes suivantes.
  const fromRe = /\.from\(\s*['"`]([a-z_]+)['"`]\s*\)/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    fromRe.lastIndex = 0;
    while ((m = fromRe.exec(line)) !== null) {
      const table = m[1];
      if (!PII_TABLES.includes(table)) continue;

      // Scanner les 6 lignes suivantes (chaining Supabase) pour insert/update/delete.
      const scanEnd = Math.min(lines.length, i + 6);
      let mutationLine = -1;
      let mutationKind = null;
      for (let j = i; j < scanEnd; j++) {
        const mut = lines[j].match(/\.(insert|update|delete)\s*\(/);
        if (mut) {
          mutationLine = j;
          mutationKind = mut[1];
          break;
        }
      }
      if (mutationLine === -1) continue;

      // Chercher auditLog( dans le handler englobant la mutation.
      const [hStart, hEnd] = findEnclosingHandler(lines, mutationLine);
      const handlerBody = lines.slice(hStart, hEnd + 1).join('\n');
      const hasAuditLog = /\bauditLog\s*\(/.test(handlerBody);

      findings.push({
        file: absFile,
        line: i + 1,
        mutationLine: mutationLine + 1,
        table,
        kind: mutationKind,
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

  // Couche 1 : handler-level.
  const handlers = [];
  for (const f of files) handlers.push(...analyzeHandlers(f.abs));
  const handlerCovered = handlers.filter((x) => x.covered);
  const handlerMissing = handlers.filter((x) => !x.covered);
  const handlerMissingPII = handlerMissing.filter((x) => isPII(formatRel(x.file)));
  const handlerMissingNonPII = handlerMissing.filter((x) => !isPII(formatRel(x.file)));

  // Couche 2 : mutation-level strict sur tables PII.
  const mutations = [];
  for (const f of files) mutations.push(...analyzeMutations(f.abs));
  const mutationCovered = mutations.filter((x) => x.covered);
  const mutationMissing = mutations.filter((x) => !x.covered);

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
    `scope: app/api/**/route.ts (hors webhooks/cron/waitlist) — ${files.length} fichier(s)`,
  );
  lines.push('');
  lines.push('═══ COUCHE 1 — HANDLER-level (handler write sans auditLog dans le corps) ═══');
  lines.push(`Handlers write totaux : ${handlers.length} | covered=${handlerCovered.length} | missing=${handlerMissing.length}`);
  lines.push('');

  lines.push(`HANDLER MISSING zone PII — ${handlerMissingPII.length} handler(s)  ⚠️ RGPD :`);
  for (const f of handlerMissingPII) lines.push(`  ${formatRel(f.file)}:${f.line}  ${f.method}`);
  lines.push('');

  lines.push(`HANDLER MISSING zone non-PII (info) — ${handlerMissingNonPII.length} handler(s) :`);
  for (const f of handlerMissingNonPII) lines.push(`  ${formatRel(f.file)}:${f.line}  ${f.method}`);
  lines.push('');

  lines.push(`═══ COUCHE 2 — MUTATION-level sur tables PII (handler englobant) ═══`);
  lines.push(`Tables PII suivies (${PII_TABLES.length}) : ${PII_TABLES.join(', ')}`);
  lines.push(`Mutations PII totales : ${mutations.length} | covered=${mutationCovered.length} | missing=${mutationMissing.length}`);
  lines.push('');

  lines.push(`MUTATION MISSING (auditLog absent du handler englobant) — ${mutationMissing.length} mutation(s)  ⚠️ CNIL :`);
  for (const m of mutationMissing) {
    lines.push(`  ${formatRel(m.file)}:${m.mutationLine}  .${m.kind}(${m.table})`);
  }
  lines.push('');

  lines.push('─'.repeat(70));
  const totalViolations = handlerMissingPII.length + mutationMissing.length;
  lines.push(
    `TOTAL handler PII missing=${handlerMissingPII.length} | mutation missing=${mutationMissing.length}`,
  );
  lines.push(`VIOLATIONS: ${totalViolations}`);
  lines.push(`EXIT: ${totalViolations > 0 ? 1 : 0}`);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, lines.join('\n') + '\n', 'utf8');
  console.log(lines.join('\n'));
  process.exit(totalViolations > 0 ? 1 : 0);
}

main();
