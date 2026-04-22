#!/usr/bin/env node
/**
 * audit/route-auth.mjs
 *
 * Audit déterministe des guards d'authentification sur les routes API.
 *
 * Règle métier :
 *   - Chaque handler (GET/POST/PATCH/DELETE/PUT) DOIT :
 *     - soit déclarer un guard : requireAdmin / requireStructureRole /
 *       verifySuiviToken / verifyParentToken / getTokenFromCookie + check
 *     - soit apparaître dans la whitelist ci-dessous (routes publiques légitimes)
 *
 * Routes publiques légitimes (whitelist) :
 *   - auth/login, auth/logout, auth/pro-session, auth/activate-invitation
 *   - auth/structure-login, auth/educator-invite (public token-based)
 *   - auth/2fa/* (utilisent JWT temporaire)
 *   - webhooks/stripe (signature Stripe), cron/* (CRON_SECRET — couvert par cron-secret.mjs)
 *   - waitlist, structures/search, structures/verify/[code], pro/*
 *   - suivi/[token]/*, souhaits/*, educateur/*, inscriptions (public create)
 *
 * Output : audit-reports/route-auth.txt
 * Exit   : 0 si OK, 1 si handler sans guard et pas whitelisté.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const API_DIR = path.join(ROOT, 'app/api');
const OUT_DIR = path.join(ROOT, 'audit-reports');
const OUT_FILE = path.join(OUT_DIR, 'route-auth.txt');

const METHODS = ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'];

// Patterns de guards reconnus (cf. lib/auth-middleware.ts, lib/structure-guard.ts, etc.)
// Format {label, re} — le label sert à l'affichage grep-friendly du rapport.
const GUARD_PATTERNS = [
  { label: 'requireAdmin', re: /\brequireAdmin\s*\(/ },
  { label: 'requireEditor', re: /\brequireEditor\s*\(/ },
  { label: 'requireStructureRole', re: /\brequireStructureRole\s*\(/ },
  { label: 'requireInscriptionOwnership', re: /\brequireInscriptionOwnership\s*\(/ },
  { label: 'requireInscriptionInStructure', re: /\brequireInscriptionInStructure\s*\(/ },
  { label: 'verifyAuth', re: /\bverifyAuth\s*\(/ },
  { label: 'verifySuiviToken', re: /\bverifySuiviToken\s*\(/ },
  { label: 'verifyParentToken', re: /\bverifyParentToken\s*\(/ },
  { label: 'verifyInscriptionToken', re: /\bverifyInscriptionToken\s*\(/ },
  { label: 'verifyOwnership', re: /\bverifyOwnership\s*\(/ },
  { label: 'verifyEducateurAggregateToken', re: /\bverifyEducateurAggregateToken\s*\(/ },
  { label: 'verifyProSession', re: /\bverifyProSession\s*\(/ },
  { label: 'verifyAdminToken', re: /\bverifyAdminToken\s*\(/ },
  { label: 'verifyEducatorToken', re: /\bverifyEducatorToken\s*\(/ },
  { label: 'getTokenFromCookie', re: /\bgetTokenFromCookie\s*\(/ },
  { label: 'resolveCodeToStructure', re: /\bresolveCodeToStructure\s*\(/ }, // token check sémantique
  { label: 'CRON_SECRET', re: /process\.env\.CRON_SECRET/ },
  { label: 'stripeSignature', re: /stripeSignature|constructEvent|verifyStripeSignature/ },
];

// Whitelist : routes publiques légitimes (token URL, signature, etc.)
const PUBLIC_WHITELIST = [
  'app/api/auth/login/',
  'app/api/auth/logout/',
  'app/api/auth/pro-session/',
  'app/api/auth/activate-invitation/',
  'app/api/auth/structure-login/',
  'app/api/auth/educator-invite/',
  'app/api/auth/2fa/',
  'app/api/webhooks/',
  'app/api/cron/',
  'app/api/waitlist/',
  'app/api/structures/search/',
  'app/api/structures/verify/',
  'app/api/pro/request-access/',
  'app/api/pro/price-inquiry/',
  'app/api/pro/propositions/',
  'app/api/inscriptions/', // public create (réservation citoyen)
  'app/api/inscription-urgence/',
  'app/api/suivi/', // token URL
  'app/api/souhaits/', // token URL
  'app/api/educateur/', // token URL
  'app/api/pdf/', // slug public (PDF séjour)
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

function isWhitelisted(relPath) {
  return PUBLIC_WHITELIST.some((z) => relPath.startsWith(z));
}

function analyzeFile(absFile) {
  const src = readFileSync(absFile, 'utf8');
  const findings = [];
  for (const method of METHODS) {
    const re = new RegExp(`export\\s+async\\s+function\\s+${method}\\b`, 'g');
    let match;
    while ((match = re.exec(src)) !== null) {
      const startLine = src.slice(0, match.index).split('\n').length;
      const rest = src.slice(match.index);
      const nextExport = rest.slice(10).search(/export\s+async\s+function\s+(GET|POST|PATCH|DELETE|PUT)\b/);
      const body = nextExport > 0 ? rest.slice(0, nextExport + 10) : rest;

      const matchedGuards = GUARD_PATTERNS.filter((g) => g.re.test(body)).map((g) => g.label);
      findings.push({
        method,
        file: absFile,
        line: startLine,
        guards: matchedGuards,
      });
    }
  }
  return findings;
}

function formatRel(p) {
  return path.relative(ROOT, p);
}

function main() {
  const files = walk(API_DIR);
  const all = [];
  for (const f of files) all.push(...analyzeFile(f));

  const guarded = [];
  const publicOk = [];
  const missing = [];

  for (const h of all) {
    const rel = formatRel(h.file);
    if (h.guards.length > 0) guarded.push(h);
    else if (isWhitelisted(rel)) publicOk.push(h);
    else missing.push(h);
  }

  let sha = 'unknown';
  try {
    sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    // ok
  }
  const stamp = new Date().toISOString();

  const lines = [];
  lines.push(`[route-auth audit] ${stamp}  commit=${sha}`);
  lines.push(`scope: app/api/**/route.ts — ${files.length} fichier(s), ${all.length} handler(s)`);
  lines.push('');

  lines.push(`GUARDED (auth check détecté) — ${guarded.length} handler(s) :`);
  for (const h of guarded) {
    lines.push(`  ${formatRel(h.file)}:${h.line}  ${h.method}  [${h.guards.join(',')}]`);
  }
  lines.push('');

  lines.push(`PUBLIC (whitelisté — public légitime) — ${publicOk.length} handler(s) :`);
  for (const h of publicOk) lines.push(`  ${formatRel(h.file)}:${h.line}  ${h.method}`);
  lines.push('');

  lines.push(`MISSING (aucun guard détecté, non whitelisté) — ${missing.length} handler(s)  ⚠️ :`);
  for (const h of missing) lines.push(`  ${formatRel(h.file)}:${h.line}  ${h.method}`);
  lines.push('');

  lines.push('─'.repeat(70));
  lines.push(`TOTAL: guarded=${guarded.length}, public=${publicOk.length}, missing=${missing.length}`);
  lines.push(`VIOLATIONS: ${missing.length}`);
  lines.push(`EXIT: ${missing.length > 0 ? 1 : 0}`);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, lines.join('\n') + '\n', 'utf8');
  console.log(lines.join('\n'));
  process.exit(missing.length > 0 ? 1 : 0);
}

main();
