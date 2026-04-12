export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { generateSecret, generateOtpAuthUrl, getQrCodeUrl } from '@/lib/totp';

/**
 * POST /api/auth/2fa/setup
 * Génère un secret TOTP et retourne l'URL du QR code.
 * Requiert un JWT valide. L'activation est confirmée via /api/auth/2fa/confirm.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth) return NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 });

    const secret = generateSecret();
    const otpAuthUrl = generateOtpAuthUrl(auth.email, secret);
    const qrCodeUrl = getQrCodeUrl(otpAuthUrl);

    await getSupabaseAdmin().from('gd_admin_2fa').upsert(
      { user_id: auth.userId, totp_secret: secret, enabled: false, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );

    return NextResponse.json({ qrCodeUrl, secret });
  } catch (error) {
    console.error('POST /api/auth/2fa/setup error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
