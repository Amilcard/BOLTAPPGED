#!/usr/bin/env -S npx tsx
/**
 * audit-data-integrity.ts — Audit intégrité data GED (prod ou branch)
 *
 * Appelle la fonction SQL gd_audit_data_integrity() qui tourne 10 checks.
 * Output : console summary + JSON dans test-reports/data-integrity-YYYY-MM-DD.json
 * Exit code : 0 si OK, 1 si blocking/warning fail.
 *
 * Usage :
 *   npm run audit:data
 *
 * Prérequis ENV : NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *
 * Branché cron hebdo via GitHub Action (TODO) — voir docs/adr/2026-04-21-data-integrity-audit.md
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[audit] NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY requis.');
  process.exit(2);
}

interface CheckRow {
  check_name: string;
  description: string;
  severity: 'blocking' | 'warning' | 'info';
  count_value: number;
  passed: boolean;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  console.log('\n=== Audit intégrité data GED ===');
  console.log(`DB   : ${SUPABASE_URL}`);
  console.log(`Date : ${new Date().toISOString()}\n`);

  const { data, error } = await supabase.rpc('gd_audit_data_integrity');

  if (error) {
    console.error('[audit] RPC error :', error.message);
    console.error('        → La fonction gd_audit_data_integrity() existe-t-elle en DB ?');
    console.error('        → Appliquer sql/084_audit_data_integrity_fn.sql');
    process.exit(2);
  }

  const results = (data || []) as CheckRow[];

  for (const r of results) {
    const emoji = r.passed
      ? '✓'
      : r.severity === 'blocking'
      ? '✗'
      : r.severity === 'warning'
      ? '⚠'
      : 'ℹ';
    console.log(`${emoji} [${r.severity.padEnd(8)}] ${r.check_name.padEnd(45)} ${r.count_value}`);
  }

  const blockingFailed = results.filter((r) => r.severity === 'blocking' && !r.passed);
  const warningFailed = results.filter((r) => r.severity === 'warning' && !r.passed);

  console.log('\n--- Résumé ---');
  console.log(`Blocking fails : ${blockingFailed.length}`);
  console.log(`Warnings       : ${warningFailed.length}`);
  console.log(`Total checks   : ${results.length}`);

  const reportDir = join(process.cwd(), 'test-reports');
  if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });
  const reportPath = join(
    reportDir,
    `data-integrity-${new Date().toISOString().slice(0, 10)}.json`
  );
  writeFileSync(
    reportPath,
    JSON.stringify(
      { date: new Date().toISOString(), db: SUPABASE_URL, results },
      null,
      2
    )
  );
  console.log(`\nRapport JSON : ${reportPath}`);

  // Exit code : blocking fail = 1, warning-only = 0 (info)
  process.exit(blockingFailed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[audit] Erreur fatale :', err);
  process.exit(2);
});
