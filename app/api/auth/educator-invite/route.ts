export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { isRateLimited, getClientIpFromHeaders } from '@/lib/rate-limit';
import { sendEducatorInviteEmail } from '@/lib/email';
import { logEmailFailure } from '@/lib/email-logger';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireEditor } from '@/lib/auth-middleware';

/**
 * POST /api/auth/educator-invite
 *
 * Génère un lien JWT 24h pour inscription urgence sans compte GED.
 * L'admin sélectionne l'email éducateur + séjour + session.
 * Le JWT encode ces infos — l'éducateur n'a plus qu'à remplir les infos enfant.
 *
 * Body : { email, sejour_slug, session_date, city_departure }
 */
export async function POST(req: NextRequest) {
  const auth = await requireEditor(req);
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Accès réservé aux éditeurs.' } },
      { status: 401 }
    );
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error('[educator-invite] NEXTAUTH_SECRET manquant');
    return NextResponse.json(
      { error: { code: 'CONFIG_ERROR', message: 'Erreur de configuration serveur.' } },
      { status: 500 }
    );
  }

  const ip = getClientIpFromHeaders(req.headers);
  if (await isRateLimited('invite', ip, 10, 10)) {
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

  const { email, sejour_slug, session_date, city_departure } = body as Record<string, unknown>;

  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Email valide requis.' } },
      { status: 400 }
    );
  }
  if (!sejour_slug || typeof sejour_slug !== 'string') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Séjour requis.' } },
      { status: 400 }
    );
  }
  if (!session_date || typeof session_date !== 'string') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Session requise.' } },
      { status: 400 }
    );
  }
  if (!city_departure || typeof city_departure !== 'string') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Ville de départ requise.' } },
      { status: 400 }
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedDate = session_date.split('T')[0];

  // Vérifier que la session + le prix existent bien en base
  const supabase = getSupabaseAdmin();
  const { data: priceRow } = await supabase
    .from('gd_session_prices')
    .select('price_ged_total, stay_slug, start_date, city_departure')
    .eq('stay_slug', sejour_slug)
    .eq('start_date', normalizedDate)
    .eq('city_departure', city_departure)
    .single();

  if (!priceRow) {
    return NextResponse.json(
      { error: { code: 'SESSION_NOT_FOUND', message: 'Session ou prix introuvable pour ce séjour.' } },
      { status: 400 }
    );
  }

  // Récupérer le nom marketing du séjour pour l'email
  const { data: stay } = await supabase
    .from('gd_stays')
    .select('marketing_title')
    .eq('slug', sejour_slug)
    .single();

  const sejourTitle = stay?.marketing_title ?? sejour_slug;

  try {
    const encodedSecret = new TextEncoder().encode(secret);

    const token = await new SignJWT({
      type: 'educator_invite',
      email: normalizedEmail,
      sejour_slug,
      session_date: normalizedDate,
      city_departure,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .setIssuedAt()
      .sign(encodedSecret);

    const baseUrl = process.env.NEXTAUTH_URL || 'https://app.groupeetdecouverte.fr';
    const inviteUrl = `${baseUrl}/inscription-urgence?token=${token}`;

    // Lot L4/6 — callsite critique : on privilégie 502 (Bad Gateway) plutôt que 500,
    // car le token JWT a été généré avec succès, seul le provider email a échoué.
    // L'admin peut retenter l'action sans régénérer la ressource amont.
    const emailResult = await sendEducatorInviteEmail(
      normalizedEmail,
      inviteUrl,
      sejourTitle,
      normalizedDate,
      city_departure
    );
    if (!emailResult.sent) {
      // resourceId = slug + date + city (non-PII) — permet de corréler sans logger l'email.
      const inviteRef = `${sejour_slug}:${normalizedDate}:${city_departure}`;
      await logEmailFailure('educator_invite', emailResult, 'educator_invitation', inviteRef);
      return NextResponse.json(
        {
          error: {
            code: 'EMAIL_FAILED',
            message: 'Le lien d\'invitation n\'a pas pu être envoyé. Réessayez dans quelques minutes.',
          },
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[educator-invite] Erreur génération token:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur.' } },
      { status: 500 }
    );
  }
}
