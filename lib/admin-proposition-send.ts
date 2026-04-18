import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendPropositionEmail } from '@/lib/email';
import { generatePropositionPdf } from '@/lib/pdf-proposition';
import { auditLog } from '@/lib/audit-log';
import { UUID_RE, EMAIL_REGEX } from '@/lib/validators';

/**
 * Shared helper pour l'envoi d'une proposition tarifaire.
 * Partagé entre :
 *   - POST /api/admin/propositions/[id]/send (legacy, conservé)
 *   - POST /api/admin/propositions/send (body-based, anti-SSRF préemptif)
 *
 * Pattern cohérent avec Lot 1 users (91657eb) + Lot 2 stays (fab79a9).
 *
 * Aucun NextRequest/NextResponse ici — la logique HTTP + auth reste dans
 * les routes. Guard status='envoyee' + UPDATE conditionnelle
 * .in(['brouillon','demandee']) reproduits EXACTEMENT depuis la route legacy
 * (idempotence email).
 */

export type SendPropositionResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

export async function runSendProposition(params: {
  id: string;
  overrideEmail?: string;
  actorEmail: string;
  ip?: string;
}): Promise<SendPropositionResult> {
  const { id, actorEmail, ip } = params;

  if (!UUID_RE.test(id)) {
    return { ok: false, error: 'ID invalide', status: 400 };
  }

  const overrideEmailRaw =
    typeof params.overrideEmail === 'string' && params.overrideEmail.trim()
      ? params.overrideEmail.trim()
      : null;

  if (overrideEmailRaw && !EMAIL_REGEX.test(overrideEmailRaw)) {
    return { ok: false, error: 'Email destinataire invalide.', status: 400 };
  }

  const supabase = getSupabaseAdmin();
  const { data: prop } = await supabase
    .from('gd_propositions_tarifaires')
    .select('*')
    .eq('id', id)
    .single();

  if (!prop) {
    return { ok: false, error: 'Proposition introuvable', status: 404 };
  }

  if (prop.status === 'envoyee') {
    return { ok: false, error: 'Proposition déjà envoyée.', status: 400 };
  }

  const destEmail = prop.demandeur_email || overrideEmailRaw;
  if (!destEmail) {
    return {
      ok: false,
      error: "Pas d'email destinataire. Renseignez 'demandeurEmail' dans la requête.",
      status: 400,
    };
  }

  const pdfBytes = await generatePropositionPdf(prop as Record<string, unknown>);

  await sendPropositionEmail({
    to:              destEmail,
    destinataireNom: prop.demandeur_nom || destEmail,
    sejourTitre:     prop.sejour_titre || prop.sejour_slug,
    dossierRef:      prop.id.slice(0, 8).toUpperCase(),
    pdfBuffer:       pdfBytes,
  });

  await auditLog(supabase, {
    action: 'submit',
    resourceType: 'proposition',
    resourceId: id,
    actorType: 'admin',
    actorId: actorEmail,
    ipAddress: ip,
    metadata: { context: 'proposition_send', demandeur_email: destEmail, sejour_titre: prop.sejour_titre },
  });

  const updatePayload: Record<string, unknown> = { status: 'envoyee' };
  if (!prop.demandeur_email && overrideEmailRaw) {
    updatePayload.demandeur_email = overrideEmailRaw;
  }

  const { error: updateErr } = await supabase
    .from('gd_propositions_tarifaires')
    .update(updatePayload)
    .eq('id', id)
    .in('status', ['brouillon', 'demandee']);

  if (updateErr) {
    console.error('[propositions/send] update status failed:', updateErr.message);
    return { ok: false, error: 'Email envoyé mais statut non mis à jour.', status: 500 };
  }

  return { ok: true };
}
