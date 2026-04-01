/**
 * Smoke test email — Resend
 * Usage : node scripts/smoke-test-email.mjs votre@email.fr
 *
 * Vérifie :
 *  1. Clé API présente et valide
 *  2. Envoi réel d'un email de test
 *  3. Retour du message_id Resend (preuve d'acceptation)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Charger .env.local manuellement (pas de dotenv requis)
try {
  const envPath = resolve(__dirname, '../.env.local');
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length && !key.startsWith('#')) {
      process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
} catch {
  console.warn('[warn] .env.local non trouvé — variables Vercel utilisées si présentes');
}

const to = process.argv[2];
if (!to || !to.includes('@')) {
  console.error('Usage : node scripts/smoke-test-email.mjs votre@email.fr');
  process.exit(1);
}

const key = process.env.EMAIL_SERVICE_API_KEY;
if (!key || key.length < 5) {
  console.error('❌ EMAIL_SERVICE_API_KEY absente ou invalide');
  process.exit(1);
}

console.log('✓ Clé Resend présente (' + key.slice(0, 8) + '...)');
console.log('→ Envoi vers', to, '...');

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: 'GED Test <noreply@groupeetdecouverte.fr>',
    to: [to],
    subject: '[GED smoke test] Email de vérification',
    html: '<p>Smoke test OK — Resend fonctionne correctement.</p><p>Heure : ' + new Date().toISOString() + '</p>',
  }),
});

const data = await res.json();

if (!res.ok) {
  console.error('❌ Échec envoi:', res.status, JSON.stringify(data));
  process.exit(1);
}

console.log('✅ Email accepté par Resend');
console.log('   message_id :', data.id);
console.log('   Vérifier la réception dans la boîte :', to);
