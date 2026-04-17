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
