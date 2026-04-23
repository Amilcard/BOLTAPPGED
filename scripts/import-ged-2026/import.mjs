#!/usr/bin/env node
/**
 * import-ged-2026/import.mjs
 * Import en masse des inscriptions depuis payloads.json → Supabase (service role).
 *
 * Usage :
 *   node scripts/import-ged-2026/import.mjs [--dry-run]
 *
 * --dry-run : affiche ce qui serait importé sans écrire en base.
 *
 * Prérequis : .env.local avec NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ── Env ──────────────────────────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const candidates = [
    join(__dir, '../../.env.local'),
    join(__dir, '../../.env'),
  ];
  for (const f of candidates) {
    try {
      const lines = readFileSync(f, 'utf8').split('\n');
      for (const line of lines) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m && !process.env[m[1].trim()]) {
          process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
        }
      }
    } catch { /* fichier absent */ }
  }
}
loadEnv();

const DRY_RUN = process.argv.includes('--dry-run');

// ── Supabase ─────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ── Helpers ───────────────────────────────────────────────────────────────────
const PAYMENT_MAP = { card: 'stripe', bank_transfer: 'transfer', cheque: 'check', transfer: 'transfer', check: 'check' };

function genDossierRef() {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const r = randomBytes(5).toString('hex').slice(0, 8).toUpperCase();
  return `DOS-${d}-${r}`;
}

async function resolveStructure(payload) {
  // Chercher structure existante par nom + CP
  const { data: existing } = await supabase
    .from('gd_structures')
    .select('id')
    .ilike('name', payload.structureName)
    .eq('postal_code', payload.structurePostalCode)
    .eq('status', 'active')
    .maybeSingle();

  if (existing) return { structureId: existing.id, structurePendingName: null };

  if (DRY_RUN) {
    return { structureId: null, structurePendingName: payload.structureName };
  }

  // Créer la structure
  const { data: created, error } = await supabase
    .from('gd_structures')
    .insert({
      name: payload.structureName,
      address: payload.structureAddress || null,
      postal_code: payload.structurePostalCode,
      city: payload.structureCity,
      created_by_email: payload.referentEmail,
    })
    .select('id')
    .single();

  if (error || !created) {
    console.warn(`  ⚠️  Structure non créée (${payload.structureName}) :`, error?.message);
    return { structureId: null, structurePendingName: payload.structureName };
  }
  return { structureId: created.id, structurePendingName: null };
}

// ── Main ──────────────────────────────────────────────────────────────────────
const payloads = JSON.parse(
  readFileSync(join(__dir, 'payloads.json'), 'utf8')
);

console.log(`\n📋 Import GED 2026 — ${payloads.length} entrées${DRY_RUN ? ' [DRY RUN]' : ''}\n`);

let inserted = 0;
let skipped = 0;
let errors = 0;

for (const p of payloads) {
  const id = p._meta?.id ?? '?';
  const label = `[${id}] ${p.childLastName} ${p.childFirstName}`;
  const normalizedDate = p.sessionDate.split('T')[0];

  // Anti-doublon
  const { data: existing } = await supabase
    .from('gd_inscriptions')
    .select('id, dossier_ref')
    .eq('sejour_slug', p.staySlug)
    .eq('session_date', normalizedDate)
    .eq('jeune_date_naissance', p.childBirthDate)
    .neq('status', 'annulee')
    .maybeSingle();

  if (existing) {
    console.log(`  ⏭️  ${label} — déjà inscrit (${existing.dossier_ref})`);
    skipped++;
    continue;
  }

  // Remarques : noter l'encadrement renforcé si présent
  const encadrementNote = p._meta?.encadrement
    ? `[Encadrement renforcé] Séjour: ${p.prixSejour ?? '?'}€ | Transport: ${p.prixTransport ?? '?'}€ | Encadrement: ${p.prixEncadrement ?? '?'}€`
    : '';

  const noteGroupe = p._meta?.note ? `[${p._meta.note}]` : '';
  const remarques = [encadrementNote, noteGroupe].filter(Boolean).join(' ');

  const { structureId, structurePendingName } = await resolveStructure(p);

  const row = {
    sejour_slug: p.staySlug,
    session_date: normalizedDate,
    city_departure: p.cityDeparture,
    jeune_prenom: p.childFirstName,
    jeune_nom: p.childLastName || '',
    jeune_date_naissance: p.childBirthDate,
    referent_nom: p.referentNom,
    referent_email: p.referentEmail,
    referent_tel: p.referentTel,
    organisation: p.structureName,
    dossier_ref: genDossierRef(),
    price_total: Math.round(p.priceTotal),
    status: 'en_attente',
    payment_status: 'pending_payment',
    payment_method: PAYMENT_MAP[p.paymentMethod] || 'transfer',
    structure_id: structureId,
    structure_pending_name: structurePendingName,
    structure_postal_code: p.structurePostalCode,
    structure_city: p.structureCity,
    structure_address: p.structureAddress || null,
    remarques: remarques || null,
  };

  if (DRY_RUN) {
    console.log(`  ✅ ${label} — ${p.priceTotal}€ → ${p.staySlug} (${normalizedDate}) [simulation]`);
    inserted++;
    continue;
  }

  const { error } = await supabase.from('gd_inscriptions').insert(row);

  if (error) {
    console.error(`  ❌ ${label} — ERREUR: ${error.message}`);
    errors++;
  } else {
    console.log(`  ✅ ${label} — ${p.priceTotal}€ → ${row.dossier_ref}`);
    inserted++;
  }
}

console.log(`\n── Résultat ──`);
console.log(`  Insérés  : ${inserted}`);
console.log(`  Ignorés  : ${skipped} (doublons)`);
console.log(`  Erreurs  : ${errors}`);
console.log(DRY_RUN ? '\n⚠️  Dry-run : aucune écriture en base.\n' : '\n✅ Import terminé.\n');
