#!/usr/bin/env node
/**
 * check-skip-threshold.mjs
 *
 * Gate CI — fail si le nombre de tests E2E skippés dépasse un seuil.
 * Empêche la régression silencieuse : un `test.skip()` ré-introduit dans le
 * code = détecté au CI, pas en prod.
 *
 * Usage : node scripts/check-skip-threshold.mjs [results.json] [threshold]
 * Défaut : test-results/results.json, seuil = 3
 * Variable env : SKIP_THRESHOLD=N
 */
import { readFileSync, existsSync } from 'node:fs';

const RESULTS_PATH = process.argv[2] || 'test-results/results.json';
const THRESHOLD = Number(process.argv[3] ?? process.env.SKIP_THRESHOLD ?? 3);

if (!existsSync(RESULTS_PATH)) {
  console.error(`[check-skip] ${RESULTS_PATH} introuvable. Reporter JSON non configuré en CI ?`);
  process.exit(2);
}

let report;
try {
  report = JSON.parse(readFileSync(RESULTS_PATH, 'utf8'));
} catch (e) {
  console.error(`[check-skip] JSON parse error : ${e instanceof Error ? e.message : e}`);
  process.exit(2);
}

const stats = report?.stats ?? {};
const skipped = Number(stats.skipped ?? 0);
const expected = Number(stats.expected ?? 0);
const unexpected = Number(stats.unexpected ?? 0);
const flaky = Number(stats.flaky ?? 0);
const total = skipped + expected + unexpected + flaky;

console.log(
  `[check-skip] E2E : expected=${expected}, unexpected=${unexpected}, flaky=${flaky}, skipped=${skipped} / total=${total}`,
);

if (skipped > THRESHOLD) {
  console.error(
    `[check-skip] FAIL — ${skipped} tests skippés > seuil ${THRESHOLD}.\n` +
      `  Un test.skip() cache un échec silencieux. Remplacer par expect().toBe(true)\n` +
      `  ou test.fixme() explicite avec raison documentée.`,
  );
  process.exit(1);
}

if (skipped > 0) {
  console.warn(`[check-skip] WARN — ${skipped} tests skippés (seuil ${THRESHOLD}). Documenter pourquoi.`);
}

console.log(`[check-skip] OK — ${skipped} skip(s) ≤ seuil ${THRESHOLD}.`);
