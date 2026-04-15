#!/usr/bin/env node
/**
 * check-bundle-size.mjs
 * Vérifie les tailles de bundles après `next build`.
 * Lit .next/static/chunks/ et échoue si un seuil est dépassé.
 *
 * Seuils (non-compressé — ratio gzip ~3x) :
 *   - Total chunks JS          : 4 500 KB  (≈1 500 KB gzip)
 *   - main-app chunk           :   400 KB  (≈ 130 KB gzip)
 *   - Tout autre chunk isolé   :   600 KB  (≈ 200 KB gzip)
 *
 * Usage :
 *   node scripts/check-bundle-size.mjs
 *   node scripts/check-bundle-size.mjs --verbose
 */

import { readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

const VERBOSE = process.argv.includes('--verbose');
const CHUNKS_DIR = join(process.cwd(), '.next', 'static', 'chunks');

// Seuils en KB
const THRESHOLDS = {
  totalKB: 4500,
  mainChunkKB: 400,
  singleChunkKB: 600,
};

if (!existsSync(CHUNKS_DIR)) {
  console.error('❌  .next/static/chunks/ introuvable — lancer `next build` d\'abord.');
  process.exit(1);
}

function getAllJsFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllJsFiles(fullPath));
    } else if (entry.name.endsWith('.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = getAllJsFiles(CHUNKS_DIR);
const violations = [];
let totalBytes = 0;

for (const file of files) {
  const { size } = statSync(file);
  totalBytes += size;
  const kb = size / 1024;
  const relativeName = file.replace(process.cwd() + '/', '');

  const isMain = file.includes('main-app') || file.includes('main-');
  const limit = isMain ? THRESHOLDS.mainChunkKB : THRESHOLDS.singleChunkKB;

  if (kb > limit) {
    violations.push({ file: relativeName, kb: kb.toFixed(1), limit });
  }

  if (VERBOSE) {
    const flag = kb > limit ? '⚠️ ' : '   ';
    console.log(`${flag} ${kb.toFixed(1).padStart(7)} KB  ${relativeName}`);
  }
}

const totalKB = totalBytes / 1024;
console.log(`\n📦  Total chunks JS : ${totalKB.toFixed(0)} KB / ${THRESHOLDS.totalKB} KB`);

if (totalKB > THRESHOLDS.totalKB) {
  violations.push({ file: 'TOTAL', kb: totalKB.toFixed(0), limit: THRESHOLDS.totalKB });
}

if (violations.length > 0) {
  console.error('\n❌  Seuils dépassés :');
  for (const v of violations) {
    console.error(`   ${v.file} : ${v.kb} KB > ${v.limit} KB`);
  }
  process.exit(1);
}

console.log('✅  Tous les seuils respectés.');
