/**
 * Suppression email temporaire — bugs prod en cours (2026-04-22).
 *
 * Bloque au niveau du choke point `tryResendSend` tout envoi d'email
 * destiné aux structures en pause. Reste actif tant que les entrées ci-dessous
 * ne sont pas vidées.
 *
 * REVERT quand les bugs sont clos :
 * - Vider `EMAIL_SUPPRESSION_RULES` → tableau vide
 * - Commit + push main → redeploy Vercel auto → suppression off
 *
 * Règles supportées :
 * - Email exact (case-insensitive) : `user@example.com`
 * - Suffix de domaine : `@example.com` (commence par `@`)
 *
 * Couverture actuelle :
 * - La Cordée (CDS personnel gmail)
 * - La Clairière (direction + CDS + secrétariat + ~12 éducateurs incl. Lena Cottret)
 *
 * Non impactés (vérifié 2026-04-22) :
 * - Thanh (testeur prod — domaine hors liste)
 * - GED internes (contact@groupeetdecouverte.fr, groupeetdecouverte@gmail.com)
 * - Toutes les autres structures partenaires
 */

export const EMAIL_SUPPRESSION_RULES: readonly string[] = [
  'o.geoffroy.lce@gmail.com',
  '@fondationdiaconesses.org',
  '@mecs-laclairiere.fr',
] as const;

/**
 * Vrai si l'email correspond à une règle de suppression (exact ou suffix domaine).
 * Case-insensitive. Trim implicite.
 */
export function isEmailSuppressed(email: string): boolean {
  const e = email.trim().toLowerCase();
  if (!e) return false;
  return EMAIL_SUPPRESSION_RULES.some((rule) => {
    const r = rule.toLowerCase();
    return r.startsWith('@') ? e.endsWith(r) : e === r;
  });
}

function extract(x: unknown): string | null {
  if (typeof x === 'string') return x;
  // Resend SDK accepte `{ name?: string; email: string }` — extraire `.email`
  if (typeof x === 'object' && x !== null) {
    const maybe = (x as Record<string, unknown>).email;
    if (typeof maybe === 'string') return maybe;
  }
  return null;
}

function flatten(field: unknown): string[] {
  if (!field) return [];
  if (Array.isArray(field)) {
    return field.map(extract).filter((x): x is string => x !== null);
  }
  const one = extract(field);
  return one ? [one] : [];
}

/**
 * Vrai si AU MOINS un destinataire (to / cc / bcc) matche une règle.
 * Bloque l'email entier dès qu'un destinataire est supprimé — pas de split partiel.
 * Accepte `unknown` car le payload Resend a une index-signature `[key: string]: unknown`.
 */
export function anyRecipientSuppressed(payload: {
  to?: unknown;
  cc?: unknown;
  bcc?: unknown;
}): boolean {
  const all = [
    ...flatten(payload.to),
    ...flatten(payload.cc),
    ...flatten(payload.bcc),
  ];
  return all.some((e) => isEmailSuppressed(e));
}
