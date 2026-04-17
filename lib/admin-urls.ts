import { UUID_RE } from '@/lib/validators';

/**
 * Build URL pour l'API admin inscription. Retourne null si l'ID est invalide.
 * Valide UUID + encode pour défense en profondeur vs SSRF/path-injection.
 */
export function buildAdminInscriptionUrl(id: string): string | null {
  if (!UUID_RE.test(id)) return null;
  return `/api/admin/inscriptions/${encodeURIComponent(id)}`;
}
