#!/usr/bin/env node
/**
 * generate-admin-token.js
 * Génère un JWT admin valide pour les tests E2E.
 *
 * Usage :
 *   node scripts/generate-admin-token.js
 *
 * Charge automatiquement NEXTAUTH_SECRET depuis .env / .env.local
 * puis affiche le token + la commande export prête à copier.
 */

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

// ── Charger NEXTAUTH_SECRET depuis .env / .env.local ──
function loadSecret() {
  const projectDir = path.resolve(__dirname, '..');

  // Chemin 1 : .env.local (prioritaire)
  const envLocalPath = path.resolve(__dirname, '../.env.local');
  if (envLocalPath.startsWith(projectDir + path.sep) && fs.existsSync(envLocalPath)) {
    const content = fs.readFileSync(envLocalPath, 'utf8');
    const match = content.match(/^NEXTAUTH_SECRET\s*=\s*"?([^"\r\n]+)"?/m);
    if (match) return { secret: match[1], source: '.env.local' };
  }

  // Chemin 2 : .env (fallback)
  const envPath = path.resolve(__dirname, '../.env');
  if (envPath.startsWith(projectDir + path.sep) && fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/^NEXTAUTH_SECRET\s*=\s*"?([^"\r\n]+)"?/m);
    if (match) return { secret: match[1], source: '.env' };
  }

  return null;
}

const result = loadSecret();
if (!result) {
  console.error('❌ NEXTAUTH_SECRET introuvable dans .env ni .env.local');
  process.exit(1);
}

const { secret, source } = result;
console.log(`✅ NEXTAUTH_SECRET chargé depuis ${source}`);

// ── Générer le JWT admin ──
const payload = {
  userId: '00000000-0000-0000-0000-000000000000',
  email: 'admin-test@groupeetdecouverte.fr',
  role: 'ADMIN',
};

const token = jwt.sign(payload, secret, { expiresIn: '8h' });

console.log('');
console.log('Token JWT admin (8h) :');
console.log(token);
console.log('');
console.log('── Commande à copier-coller ──');
console.log(`export TEST_ADMIN_SESSION="${token}"`);
