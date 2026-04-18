/**
 * Validators centralisés. Source unique pour regex UUID et email
 * utilisés dans les routes API et l'UI.
 */

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isUuid(value: unknown): boolean {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function isEmail(value: unknown): boolean {
  return typeof value === 'string' && EMAIL_REGEX.test(value);
}

/**
 * Validator de data URL image (PNG/JPEG) avec cap de taille.
 * Prévient les DoS par payload volumineux sur les inputs canvas/signature.
 *
 * @param value - data URL attendu `data:image/png;base64,...`
 * @param opts.max - taille max du base64 DÉCODÉ en octets (défaut : 500 KB)
 * @param opts.mimes - MIME autorisés (défaut : PNG uniquement)
 * @returns { ok: true } ou { ok: false, reason: 'empty' | 'format' | 'mime' | 'too_large' }
 *
 * Note : le cap s'applique sur le payload décodé, pas sur la chaîne base64
 * (qui est ~33% plus longue). Une signature manuscrite typique pèse 10-80 KB.
 */
export function validateBase64Image(
  value: unknown,
  opts: { max?: number; mimes?: readonly string[] } = {},
): { ok: true; bytes: number } | { ok: false; reason: 'empty' | 'format' | 'mime' | 'too_large' } {
  const max = opts.max ?? 500_000;
  const mimes = opts.mimes ?? ['image/png'];

  if (!value || typeof value !== 'string') return { ok: false, reason: 'empty' };

  const match = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(value);
  if (!match) return { ok: false, reason: 'format' };

  const [, mime, b64] = match;
  if (!mimes.includes(mime.toLowerCase())) return { ok: false, reason: 'mime' };

  // Taille décodée estimée = ceil(len(b64) * 3/4) − padding
  const padding = (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
  const bytes = Math.floor((b64.length * 3) / 4) - padding;
  if (bytes > max) return { ok: false, reason: 'too_large' };

  return { ok: true, bytes };
}
