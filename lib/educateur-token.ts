import jwt from 'jsonwebtoken';

const EDUCATEUR_TOKEN_EXPIRY = '30d';

/**
 * Génère un JWT signé contenant l'email éducateur.
 * Utilisé pour le lien agrégé "Voir tous mes souhaits".
 */
export function generateEducateurAggregateToken(email: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET manquant');
  return jwt.sign(
    { educateurEmail: email.toLowerCase().trim(), purpose: 'souhaits-aggregate' },
    secret,
    { expiresIn: EDUCATEUR_TOKEN_EXPIRY }
  );
}

/**
 * Vérifie et décode le token agrégé.
 * Retourne l'email ou null si invalide/expiré.
 */
export function verifyEducateurAggregateToken(token: string): string | null {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  try {
    const payload = jwt.verify(token, secret) as { educateurEmail: string; purpose: string };
    if (payload.purpose !== 'souhaits-aggregate') return null;
    return payload.educateurEmail;
  } catch {
    return null;
  }
}
