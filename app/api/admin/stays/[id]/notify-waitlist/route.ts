export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireEditor } from '@/lib/auth-middleware';

const FROM_EMAIL = 'Groupe & Découverte <noreply@groupeetdecouverte.fr>';

/**
 * POST /api/admin/stays/[id]/notify-waitlist
 * Envoie un email à toutes les personnes en attente non encore notifiées.
 * Protégé par requireEditor.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireEditor(req)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  const { id: staySlug } = await params;
  const supabase = getSupabaseAdmin();

  // Récupérer le titre du séjour
  const { data: stay } = await supabase
    .from('gd_stays')
    .select('marketing_title, title, slug')
    .eq('slug', staySlug)
    .single();

  if (!stay) {
    return NextResponse.json({ error: 'Séjour introuvable.' }, { status: 404 });
  }

  const sejourNom = (stay as Record<string, string>).marketing_title
    || (stay as Record<string, string>).title
    || staySlug;

  // Récupérer les entries non notifiées (SELECT, pas UPDATE)
  // Le marquage notified_at se fait APRÈS envoi réussi pour éviter les pertes
  const { data: waitlist } = await supabase
    .from('gd_waitlist')
    .select('id, email, nom')
    .eq('sejour_slug', staySlug)
    .is('notified_at', null);

  if (!waitlist || waitlist.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: 'Aucune personne en attente.' });
  }

  const apiKey = process.env.EMAIL_SERVICE_API_KEY;
  if (!apiKey || apiKey === 'YOUR_EMAIL_API_KEY_HERE') {
    return NextResponse.json({ error: 'Service email non configuré.' }, { status: 503 });
  }

  const resend = new Resend(apiKey);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.groupeetdecouverte.fr';
  let sent = 0;
  const notifiedIds: string[] = [];

  for (const entry of waitlist as Array<{ id: string; email: string; nom: string | null }>) {
    try {
      const { error: sendErr } = await resend.emails.send({
        from: FROM_EMAIL,
        to: entry.email,
        subject: `Des places sont disponibles — ${sejourNom}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #2a383f; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 20px;">Groupe &amp; Découverte</h1>
            </div>
            <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
              <p>Bonjour${entry.nom ? ' ' + entry.nom : ''},</p>
              <p>Bonne nouvelle — des places viennent de s'ouvrir pour le séjour <strong>${sejourNom}</strong>.</p>
              <p>Vous étiez sur notre liste d'attente pour ce séjour. Les places sont limitées.</p>
              <div style="text-align: center; margin: 24px 0;">
                <a href="${appUrl}/sejour/${staySlug}"
                   style="background: #2a383f; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
                  Inscrire un enfant maintenant
                </a>
              </div>
              <p style="color: #6b7280; font-size: 13px;">
                Une question ? 04 23 16 16 71 · contact@groupeetdecouverte.fr
              </p>
            </div>
          </div>
        `,
      });

      if (!sendErr) {
        sent++;
        notifiedIds.push(entry.id);
      } else {
        console.error(`[notify-waitlist] Resend error pour entry ${entry.id}:`, sendErr.message);
      }
    } catch (err) {
      console.error('[notify-waitlist] Erreur envoi entry', entry.id, err);
    }
  }

  // Marquer notified_at UNIQUEMENT pour les envois réussis
  if (notifiedIds.length > 0) {
    await supabase
      .from('gd_waitlist')
      .update({ notified_at: new Date().toISOString() })
      .in('id', notifiedIds);
  }

  return NextResponse.json({ ok: true, sent, total: waitlist.length });
}
