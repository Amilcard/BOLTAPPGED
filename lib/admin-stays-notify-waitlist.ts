import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase-server';

/**
 * Shared helper pour notify-waitlist.
 * Partagé entre :
 *   - POST /api/admin/stays/[id]/notify-waitlist (legacy, conservé)
 *   - POST /api/admin/stays/notify-waitlist (body-based, anti-SSRF préemptif)
 *
 * Pattern cohérent avec Lot 1 users (commit 91657eb) + inscriptions
 * (bf4e8f4, 07261f2, c087698).
 *
 * Aucun NextRequest/NextResponse ici — la logique HTTP + auth reste dans
 * les routes. La boucle d'envoi emails + UPDATE `notified_at` sur succès
 * uniquement est reproduite EXACTEMENT depuis la route legacy.
 */

const FROM_EMAIL = 'Groupe & Découverte <noreply@groupeetdecouverte.fr>';

// slug : alphanum + tirets, 1 à 100 chars, premier char alphanum
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,99}$/i;

export interface NotifyWaitlistResult {
  ok: boolean;
  sent?: number;
  total?: number;
  message?: string;
  error?: string;
  status?: number;
}

export async function runNotifyWaitlist(
  staySlug: string
): Promise<NotifyWaitlistResult> {
  if (typeof staySlug !== 'string' || !SLUG_RE.test(staySlug)) {
    return { ok: false, error: 'Slug invalide', status: 400 };
  }

  const supabase = getSupabaseAdmin();

  // Récupérer le titre du séjour
  const { data: stay } = await supabase
    .from('gd_stays')
    .select('marketing_title, title, slug')
    .eq('slug', staySlug)
    .single();

  if (!stay) {
    return { ok: false, error: 'Séjour introuvable.', status: 404 };
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
    return { ok: true, sent: 0, message: 'Aucune personne en attente.' };
  }

  const apiKey = process.env.EMAIL_SERVICE_API_KEY;
  if (!apiKey || apiKey === 'YOUR_EMAIL_API_KEY_HERE') {
    return { ok: false, error: 'Service email non configuré.', status: 503 };
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

  return { ok: true, sent, total: waitlist.length };
}
