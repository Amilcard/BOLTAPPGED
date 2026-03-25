/**
 * create-test-fixtures.js
 *
 * Crée deux inscriptions de test réelles en base via l'API de production,
 * puis génère le fichier .env.test prêt à l'emploi pour Jest et Playwright.
 *
 * Usage :
 *   node scripts/create-test-fixtures.js
 *   node scripts/create-test-fixtures.js --url https://app.groupeetdecouverte.fr
 *
 * Ce script crée :
 *   - 1 inscription incomplète  → TEST_SUIVI_TOKEN + TEST_INSCRIPTION_ID
 *   - 1 inscription soumise     → TEST_SENT_SUIVI_TOKEN + TEST_SENT_INSCRIPTION_ID
 *
 * Les inscriptions sont identifiables par l'email test-fixtures@ged-test.internal
 * et peuvent être supprimées via Supabase Studio après les tests.
 */

'use strict';
const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// ─── Config ────────────────────────────────────────────────────────────────

const BASE_URL = (() => {
  const arg = process.argv.find(a => a.startsWith('--url='));
  if (arg) return arg.split('=')[1].replace(/\/$/, '');
  return process.env.NEXT_PUBLIC_API_URL || 'https://app.groupeetdecouverte.fr';
})();

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_EMAIL    = 'test-fixtures@ged-test.internal';
const ENV_TEST_PATH = path.join(__dirname, '..', '.env.test');

// Combo séjour/session/ville valide en base (vérifié le 2026-03-25)
const FIXTURE_PAYLOAD = {
  staySlug:         'mountain-and-chill',
  sessionDate:      '2026-08-02',
  cityDeparture:    'sans_transport',
  organisation:     'Structure Test GED',
  socialWorkerName: 'Référent Test',
  email:            TEST_EMAIL,
  phone:            '0600000000',
  childFirstName:   'TestEnfant',
  childLastName:    'Fixture',
  childBirthDate:   '2014-06-15',
  remarques:        '[FIXTURE TEST AUTOMATIQUE — à supprimer après tests]',
  priceTotal:       885,
  consent:          true,
  paymentMethod:    'transfer',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function post(url, body) {
  return new Promise((resolve, reject) => {
    const parsed   = new URL(url);
    const lib      = parsed.protocol === 'https:' ? https : http;
    const bodyStr  = JSON.stringify(body);
    const options  = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    };
    const req = lib.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function supabasePatch(table, id, data) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`);
    const bodyStr = JSON.stringify(data);
    const options = {
      hostname: parsed.hostname,
      port:     443,
      path:     parsed.pathname + parsed.search,
      method:   'PATCH',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'apikey':         SERVICE_KEY,
        'Authorization':  'Bearer ' + SERVICE_KEY,
        'Prefer':         'return=representation',
      },
    };
    const req = https.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function supabasePost(table, data) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
    const bodyStr = JSON.stringify(data);
    const options = {
      hostname: parsed.hostname,
      port:     443,
      path:     parsed.pathname,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'apikey':         SERVICE_KEY,
        'Authorization':  'Bearer ' + SERVICE_KEY,
        'Prefer':         'return=representation',
      },
    };
    const req = https.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔧 GED_APP — Création fixtures de test`);
  console.log(`   URL : ${BASE_URL}`);
  console.log(`   Email test : ${TEST_EMAIL}\n`);

  // ── 1. Inscription incomplète ──────────────────────────────────────────
  console.log('1/3 Création inscription incomplète...');
  const r1 = await post(`${BASE_URL}/api/inscriptions`, FIXTURE_PAYLOAD);
  if (r1.status !== 201) {
    console.error(`   ❌ Échec (${r1.status}) :`, JSON.stringify(r1.body));
    process.exit(1);
  }
  const insc1 = r1.body;
  console.log(`   ✅ id          : ${insc1.id}`);
  console.log(`   ✅ suivi_token : ${insc1.suivi_token}`);
  console.log(`   ✅ dossier_ref : ${insc1.dossier_ref}`);

  // ── 2. Inscription soumise ─────────────────────────────────────────────
  console.log('\n2/3 Création inscription soumise...');
  const r2 = await post(`${BASE_URL}/api/inscriptions`, {
    ...FIXTURE_PAYLOAD,
    childFirstName: 'TestEnfantSoumis',
    remarques: '[FIXTURE TEST SOUMIS — à supprimer après tests]',
  });
  if (r2.status !== 201) {
    console.error(`   ❌ Échec (${r2.status}) :`, JSON.stringify(r2.body));
    process.exit(1);
  }
  const insc2 = r2.body;
  console.log(`   ✅ id          : ${insc2.id}`);
  console.log(`   ✅ suivi_token : ${insc2.suivi_token}`);

  // Créer le dossier enfant et le marquer comme envoyé via service_role
  console.log('   → Création et soumission du dossier enfant...');
  const dossierData = {
    inscription_id:           insc2.id,
    bulletin_completed:       true,
    sanitaire_completed:      true,
    liaison_completed:        true,
    renseignements_completed: true,
    ged_sent_at:              new Date().toISOString(),
    documents_joints:         [],
  };
  const rd = await supabasePost('gd_dossier_enfant', dossierData);
  if (rd.status !== 201) {
    console.error(`   ❌ Dossier non créé (${rd.status}) :`, JSON.stringify(rd.body));
    process.exit(1);
  }
  console.log(`   ✅ Dossier créé et marqué soumis`);

  // ── 3. Écriture .env.test ──────────────────────────────────────────────
  console.log('\n3/3 Écriture .env.test...');

  // Lire le token admin existant si dispo
  let existingAdminToken = '';
  if (fs.existsSync(ENV_TEST_PATH)) {
    const existing = fs.readFileSync(ENV_TEST_PATH, 'utf-8');
    const match = existing.match(/TEST_ADMIN_SESSION=(.+)/);
    if (match) existingAdminToken = match[1].trim();
  }

  const envContent = `# .env.test — GED_APP fixtures de test
# Généré automatiquement par scripts/create-test-fixtures.js
# Date : ${new Date().toISOString().split('T')[0]}
# NE PAS COMMITTER CE FICHIER

PLAYWRIGHT_BASE_URL=${BASE_URL}
NEXT_PUBLIC_API_URL=${BASE_URL}

# Inscription incomplète (dossier non soumis)
TEST_INSCRIPTION_ID=${insc1.id}
TEST_SUIVI_TOKEN=${insc1.suivi_token}

# Inscription soumise (ged_sent_at renseigné)
TEST_SENT_INSCRIPTION_ID=${insc2.id}
TEST_SENT_SUIVI_TOKEN=${insc2.suivi_token}

# Session admin — obtenir via : node scripts/generate-admin-token.js
TEST_ADMIN_SESSION=${existingAdminToken}
`;

  fs.writeFileSync(ENV_TEST_PATH, envContent, 'utf-8');
  console.log(`   ✅ .env.test écrit`);

  // ── Résumé ─────────────────────────────────────────────────────────────
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Fixtures créées avec succès

  Inscription incomplète : ${insc1.dossier_ref}
  Inscription soumise    : ${insc2.dossier_ref}

  Fichier .env.test mis à jour.

${existingAdminToken ? '' : '⚠️  TEST_ADMIN_SESSION manquant.\n  Exécute : node scripts/generate-admin-token.js\n  Puis ajoute la valeur dans .env.test\n'}
Lancer les tests :
  npm run test:api
  npx playwright test tests/e2e/dossier-enfant.spec.ts

Nettoyage après tests (Supabase SQL Editor) :
  DELETE FROM gd_inscriptions WHERE referent_email = '${TEST_EMAIL}';
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main().catch(err => {
  console.error('❌ Erreur fatale :', err.message);
  process.exit(1);
});
