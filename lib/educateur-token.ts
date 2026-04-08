import { SignJWT, jwtVerify } from 'jose';

const EDUCATEUR_TOKEN_EXPIRY = '30d';

/**
 * Génère un JWT signé contenant l'email éducateur.
 * Utilisé pour le lien agrégé "Voir tous mes souhaits".
 */
export async function generateEducateurAggregateToken(email: string): Promise<string | null> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  const encodedSecret = new TextEncoder().encode(secret);
  return new SignJWT({ educateurEmail: email.toLowerCase().trim(), purpose: 'souhaits-aggregate' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(EDUCATEUR_TOKEN_EXPIRY)
    .sign(encodedSecret);
}

/**
 * Vérifie et décode le token agrégé.
 * Retourne l'email ou null si invalide/expiré.
 */
export async function verifyEducateurAggregateToken(token: string): Promise<string | null> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  try {
    const encodedSecret = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, encodedSecret);
    if (payload.purpose !== 'souhaits-aggregate') return null;
    return payload.educateurEmail as string;
  } catch {
    return null;
  }
}
