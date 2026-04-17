export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendInscriptionConfirmation } from '@/lib/email';
import { isRateLimited, getClientIpFromHeaders } from '@/lib/rate-limit';

/**
 * POST /api/suivi/resend
 * Renvoie le(s) lien(s) de suivi à l'email fourni.
 * Réponse générique pour éviter l'énumération des emails.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIpFromHeaders(req.headers);
    if (await isRateLimited('resend', ip, 3, 10)) {
      return NextResponse.json({ ok: true }); // réponse générique — pas de fuite d'info
    }

    const { email } = await req.json();

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://app.groupeetdecouverte.fr';

    const { data: inscriptions } = await supabase
      .from('gd_inscriptions')
      .select('id, referent_nom, referent_email, jeune_prenom, jeune_nom, sejour_slug, session_date, city_departure, price_total, payment_method, dossier_ref, suivi_token')
      .eq('referent_email', email.toLowerCase().trim())
      .in('status', ['en_attente', 'validee'])
      .order('created_at', { ascending: false })
      .limit(5);

    // Réponse 200 même si aucune inscription — sécurité (pas d'énumération email)
    if (!inscriptions || inscriptions.length === 0) {
      return NextResponse.json({ ok: true });
    }

    // Renvoyer uniquement le lien de la plus récente inscription
    const latest = inscriptions[0] as Record<string, unknown>;
    try {
      await sendInscriptionConfirmation({
        referentNom:    (latest.referent_nom as string) || '',
        referentEmail:  latest.referent_email as string,
        jeunePrenom:    latest.jeune_prenom as string,
        jeuneNom:       latest.jeune_nom as string,
        sejourSlug:     latest.sejour_slug as string,
        sessionDate:    latest.session_date as string,
        cityDeparture:  latest.city_departure as string,
        priceTotal:     (latest.price_total as number) || 0,
        paymentMethod:  (latest.payment_method as string) || 'bank_transfer',
        dossierRef:     latest.dossier_ref as string,
        suiviUrl:       `${appUrl}/suivi/${latest.suivi_token as string}`,
      });
    } catch (emailErr) {
      console.error('[suivi/resend] email failed:', (emailErr as Error)?.message);
      return NextResponse.json({ ok: true, emailSent: false });
    }

    return NextResponse.json({ ok: true, emailSent: true });
  } catch (err) {
    console.error('[suivi/resend] Erreur:', err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
