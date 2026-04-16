export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { isRateLimited, getClientIpFromHeaders } from '@/lib/rate-limit';
import { sendEducatorInviteEmail } from '@/lib/email';

/**
 * POST /api/auth/educator-invite
 *
 * Génère un lien JWT 24h pour inscription urgence sans compte GED.
 * Body : { email: string }
 * Réponse : { success: true } — le JWT n'est jamais exposé dans la réponse.
 */
export async function POST(req: NextRequest) {
  // Fail-closed si secret absent
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error('[educator-invite] NEXTAUTH_SECRET manquant');
    return NextResponse.json(
      { error: { code: 'CONFIG_ERROR', message: 'Erreur de configuration serveur.' } },
      { status: 500 }
    );
  }

  const ip = getClientIpFromHeaders(req.headers);

  // Rate-limit : 2 req / 10 min par IP
  if (await isRateLimited('invite', ip, 2, 10)) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: 'Trop de requêtes. Réessayez dans quelques minutes.' } },
      { status: 429, headers: { 'Retry-After': '600' } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Corps de requête invalide.' } },
      { status: 400 }
    );
  }

  const { email } = body as Record<string, unknown>;

  // Validation email
  if (
    !email ||
    typeof email !== 'string' ||
    email.trim().length === 0 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Email valide requis.' } },
      { status: 400 }
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const encodedSecret = new TextEncoder().encode(secret);

    const token = await new SignJWT({ type: 'educator_invite', email: normalizedEmail })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .setIssuedAt()
      .sign(encodedSecret);

    const baseUrl = process.env.NEXTAUTH_URL || 'https://app.groupeetdecouverte.fr';
    const inviteUrl = `${baseUrl}/inscription-urgence?token=${token}`;

    await sendEducatorInviteEmail(normalizedEmail, inviteUrl);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[educator-invite] Erreur génération token:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur.' } },
      { status: 500 }
    );
  }
}
