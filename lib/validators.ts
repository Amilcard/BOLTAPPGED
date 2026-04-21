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
 * Validator de taille pour le body JSON d'une requête (Content-Length).
 * À utiliser AVANT `request.json()` pour rejeter tôt les payloads trop gros
 * (DoS, injection volumétrique, erreurs client).
 *
 * Ne remplace pas le parser JSON (qui peut encore échouer sur malformé),
 * mais coupe les payloads volumineux sans parser.
 *
 * @param headers - Headers de la requête (ex: `request.headers`)
 * @param opts.max - taille max en octets (défaut : 32 Ko = 32_768)
 * @returns { ok: true } si OK ou header absent ; { ok: false } si trop gros
 *
 * Exemple :
 *   const bodyCheck = validateBodySize(request.headers, { max: 32_768 });
 *   if (!bodyCheck.ok) return errorResponse('PAYLOAD_TOO_LARGE', '...', 413);
 */
export function validateBodySize(
  headers: Headers,
  opts: { max?: number } = {},
): { ok: true; bytes?: number } | { ok: false; reason: 'too_large'; actual: number; max: number } {
  const max = opts.max ?? 32_768;
  const raw = headers.get('content-length');
  if (!raw) return { ok: true }; // header absent : on ne bloque pas (ex: chunked)
  const bytes = Number.parseInt(raw, 10);
  if (!Number.isFinite(bytes) || bytes < 0) return { ok: true }; // malformé → laisser passer, parse gérera
  if (bytes > max) return { ok: false, reason: 'too_large', actual: bytes, max };
  return { ok: true, bytes };
}

/**
 * Validator de taille pour upload multipart (File/Blob).
 * Complémentaire de `validateBase64Image` — utilisé pour formData uploads
 * (PDF, JPEG, PNG, WebP) côté routes upload dossier-enfant par exemple.
 *
 * @param file - File ou Blob provenant de `formData.get(...)`
 * @param opts.max - taille max en octets (défaut : 5 MB = 5_000_000)
 * @returns { ok: true } ou { ok: false, reason, actual }
 *
 * Exemple :
 *   const check = validateUploadSize(file, { max: 5_000_000 });
 *   if (!check.ok) return NextResponse.json({ error: '...' }, { status: 413 });
 */
export function validateUploadSize(
  file: unknown,
  opts: { max?: number } = {},
): { ok: true; bytes: number } | { ok: false; reason: 'missing' | 'too_large'; actual?: number } {
  const max = opts.max ?? 5_000_000;

  if (!file || typeof file !== 'object') return { ok: false, reason: 'missing' };

  const size = (file as { size?: unknown }).size;
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) {
    return { ok: false, reason: 'missing' };
  }

  if (size > max) return { ok: false, reason: 'too_large', actual: size };

  return { ok: true, bytes: size };
}

/**
 * Validator d'URL image pour injection HTML (attribut src) ou JSON sortant.
 * Accepte https:// absolu uniquement. Rejette caractères de break-out d'attribut
 * ("/'/<>/backtick/\) et pseudo-protocoles (javascript:, data:, file:).
 *
 * Utilisé pour sécuriser les URLs venant de sources semi-trusted (n8n scraping
 * UFOVAL → Supabase Storage) avant injection dans templates email ou réponses API.
 */
export function isSafeImageUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return false;
  if (!/^https:\/\//i.test(value)) return false;
  if (/[\s"'<>`\\]/.test(value)) return false;
  return true;
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
