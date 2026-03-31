/**
 * TOTP (RFC 6238) — implémentation minimaliste avec Node.js crypto.
 * Compatible Google Authenticator, Authy, 1Password, etc.
 * Aucune dépendance externe.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

// ── Base32 ────────────────────────────────────────────────────────────────────

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateSecret(bytes = 20): string {
  const buf = randomBytes(bytes);
  let result = '';
  for (let i = 0; i < buf.length; i += 5) {
    const chunk = [buf[i], buf[i+1] ?? 0, buf[i+2] ?? 0, buf[i+3] ?? 0, buf[i+4] ?? 0];
    result += BASE32_CHARS[(chunk[0] >> 3) & 31];
    result += BASE32_CHARS[((chunk[0] & 7) << 2) | ((chunk[1] >> 6) & 3)];
    result += BASE32_CHARS[(chunk[1] >> 1) & 31];
    result += BASE32_CHARS[((chunk[1] & 1) << 4) | ((chunk[2] >> 4) & 15)];
    result += BASE32_CHARS[((chunk[2] & 15) << 1) | ((chunk[3] >> 7) & 1)];
    result += BASE32_CHARS[(chunk[3] >> 2) & 31];
    result += BASE32_CHARS[((chunk[3] & 3) << 3) | ((chunk[4] >> 5) & 7)];
    result += BASE32_CHARS[chunk[4] & 31];
  }
  return result.slice(0, Math.ceil(bytes * 8 / 5));
}

function base32Decode(input: string): Buffer {
  const str = input.toUpperCase().replace(/=+$/, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bitsLeft = 0;
  for (const char of str) {
    const val = BASE32_CHARS.indexOf(char);
    if (val < 0) continue;
    buffer = (buffer << 5) | val;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      bitsLeft -= 8;
      bytes.push((buffer >> bitsLeft) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

// ── TOTP ──────────────────────────────────────────────────────────────────────

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac('sha1', key).update(buf).digest();
  const offset = hmac[19] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return (code % 1_000_000).toString().padStart(6, '0');
}

export function generateToken(secret: string, time = Date.now()): string {
  return hotp(secret, Math.floor(time / 1000 / 30));
}

/** Vérifie le code TOTP avec une fenêtre de ±1 step (±30s) pour la dérive d'horloge */
export function verifyToken(token: string, secret: string, time = Date.now()): boolean {
  const counter = Math.floor(time / 1000 / 30);
  const tokenBuf = Buffer.from(token.padStart(6, '0'));
  for (const delta of [-1, 0, 1]) {
    const expected = Buffer.from(hotp(secret, counter + delta));
    if (expected.length === tokenBuf.length && timingSafeEqual(expected, tokenBuf)) return true;
  }
  return false;
}

/** Génère l'URL otpauth:// pour QR code (compatible tous les authenticators) */
export function generateOtpAuthUrl(email: string, secret: string, issuer = 'GED Admin'): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/** Génère un QR code SVG inline (sans dépendance externe) via API Google Charts */
export function getQrCodeUrl(otpAuthUrl: string): string {
  return `https://chart.googleapis.com/chart?chs=200x200&chld=M|0&cht=qr&chl=${encodeURIComponent(otpAuthUrl)}`;
}
