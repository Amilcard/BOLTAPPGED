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
  // Priorité : .env.local > .env (même logique que Next.js)
  const candidates = ['.env.local', '.env'];
  for (const file of candidates) {
    const filepath = path.resolve(__dirname, '..', file);
    if (!fs.existsSync(filepath)) continue;
    const content = fs.readFileSync(filepath, 'utf8');
    const match = content.match(/^NEXTAUTH_SECRET\s*=\s*"?([^"\r\n]+)"?/m);
    if (match) return { secret: match[1], source: file };
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
