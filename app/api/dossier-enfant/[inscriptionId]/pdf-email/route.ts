export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

const DOC_LABELS: Record<string, string> = {
  bulletin: "Bulletin d'inscription",
  sanitaire: 'Fiche sanitaire de liaison',
  liaison: 'Fiche de liaison jeune',
};

/**
 * POST /api/dossier-enfant/[inscriptionId]/pdf-email
 * Génère le PDF et l'envoie par email au référent.
 * Body : { token, type }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ inscriptionId: string }> }
) {
  try {
    const { inscriptionId } = await params;
    const { token, type } = await req.json();

    if (!token || !type || !DOC_LABELS[type]) {
      return NextResponse.json({ error: 'Paramètres manquants.' }, { status: 400 });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token) || !uuidRegex.test(inscriptionId)) {
      return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Vérifier ownership
    const { data: source } = await supabase
      .from('gd_inscriptions')
      .select('referent_email')
      .eq('suivi_token', token)
      .single();

    if (!source) {
      return NextResponse.json({ error: 'Token invalide.' }, { status: 404 });
    }

    const { data: inscription } = await supabase
      .from('gd_inscriptions')
      .select('referent_email, referent_nom, jeune_prenom, jeune_nom')
      .eq('id', inscriptionId)
      .single();

    if (!inscription || inscription.referent_email !== (source as Record<string, string>).referent_email) {
      return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
    }

    // Générer le PDF via la route existante (appel interne)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.groupeetdecouverte.fr';
    // SSRF guard: s'assurer que l'URL est bien sur notre domaine
    const allowedOrigins = ['https://app.groupeetdecouverte.fr', 'http://localhost:3000'];
    if (!allowedOrigins.some(o => appUrl.startsWith(o))) {
      console.error('SSRF blocked: NEXT_PUBLIC_APP_URL invalide:', appUrl);
      return NextResponse.json({ error: 'Configuration serveur invalide.' }, { status: 500 });
    }
    const pdfRes = await fetch(
      `${appUrl}/api/dossier-enfant/${inscriptionId}/pdf?token=${token}&type=${type}`
    );

    if (!pdfRes.ok) {
      return NextResponse.json({ error: 'Génération PDF échouée.' }, { status: 500 });
    }

    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    const apiKey = process.env.EMAIL_SERVICE_API_KEY;

    if (!apiKey || apiKey === 'YOUR_EMAIL_API_KEY_HERE') {
      return NextResponse.json({ error: 'Service email non configuré.' }, { status: 503 });
    }

    const insc = inscription as Record<string, string>;
    const fileName = `${DOC_LABELS[type].replace(/ /g, '_')}_${insc.jeune_prenom}_${insc.jeune_nom}.pdf`;

    // Envoi via Resend avec pièce jointe
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Groupe & Découverte <noreply@groupeetdecouverte.fr>',
        to: insc.referent_email,
        subject: `Votre document : ${DOC_LABELS[type]} — ${insc.jeune_prenom} ${insc.jeune_nom}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #2a383f; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 20px;">Groupe &amp; Découverte</h1>
            </div>
            <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
              <p>Bonjour ${insc.referent_nom || ''},</p>
              <p>Vous trouverez en pièce jointe le document <strong>${DOC_LABELS[type]}</strong> concernant <strong>${insc.jeune_prenom} ${insc.jeune_nom}</strong>.</p>
              <p style="color: #6b7280; font-size: 14px;">Ce document a été envoyé suite à votre demande depuis l'espace de suivi.</p>
              <p style="margin-top: 24px; color: #6b7280; font-size: 13px;">
                Une question ? Contactez-nous au 04 23 16 16 71 ou à contact@groupeetdecouverte.fr
              </p>
            </div>
          </div>
        `,
        attachments: [
          {
            filename: fileName,
            content: pdfBuffer.toString('base64'),
          },
        ],
      }),
    });

    if (!resendRes.ok) {
      console.error('[pdf-email] Resend error:', await resendRes.text());
      return NextResponse.json({ error: 'Envoi email échoué.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, sentTo: insc.referent_email });
  } catch (err) {
    console.error('[pdf-email] Erreur:', err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
