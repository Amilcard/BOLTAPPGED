import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendRappelDossierIncomplet, sendRelanceAdminNotification } from '@/lib/email';

/**
 * Shared logic for admin inscription "relance" (rappel dossier incomplet).
 * Partagé entre :
 *   - POST /api/admin/inscriptions/relance (id in body, URL littérale — anti-SSRF)
 *   - POST /api/admin/inscriptions/[id]/relance (legacy, conservé)
 *
 * Reproduit à l'identique la logique métier de la route legacy :
 *  - charge gd_inscriptions
 *  - vérifie gd_dossier_enfant.ged_sent_at (guard 409)
 *  - envoie 2 emails fire-and-forget
 *
 * Auth (requireEditor) reste responsabilité de chaque route appelante.
 */
export type RelanceResult =
  | { ok: true; relance_at: string }
  | { ok: false; status: 400 | 404 | 409 | 422 | 500; error: string };

export async function runRelanceInscription(id: string): Promise<RelanceResult> {
  try {
    const supabase = getSupabaseAdmin();

    // Charger les infos référent depuis gd_inscriptions
    const { data: insc, error: inscErr } = await supabase
      .from('gd_inscriptions')
      .select('id, referent_email, referent_nom, dossier_ref, suivi_token, organisation')
      .eq('id', id)
      .single();

    if (inscErr || !insc) {
      return { ok: false, status: 404, error: 'Inscription non trouvée' };
    }

    if (!insc.referent_email || !insc.suivi_token) {
      return {
        ok: false,
        status: 422,
        error: 'Données insuffisantes pour envoyer le rappel (email ou token manquant).',
      };
    }

    // Vérifier ged_sent_at depuis gd_dossier_enfant (c'est là qu'il est défini)
    const { data: dossier } = await supabase
      .from('gd_dossier_enfant')
      .select('ged_sent_at')
      .eq('inscription_id', id)
      .maybeSingle();

    if (dossier?.ged_sent_at) {
      return { ok: false, status: 409, error: 'Dossier déjà envoyé, relance inutile.' };
    }

    // Fire-and-forget — on ne bloque pas la réponse sur l'envoi email
    sendRappelDossierIncomplet({
      referentEmail: insc.referent_email,
      referentNom: insc.referent_nom || 'Référent',
      dossierRef: insc.dossier_ref ?? undefined,
      suiviToken: insc.suivi_token,
    }).catch(() => {
      // Erreur loguée dans sendRappelDossierIncomplet, pas de crash ici
    });

    // Notification admin GED — fire-and-forget
    sendRelanceAdminNotification({
      referentNom: insc.referent_nom || 'Référent',
      referentEmail: insc.referent_email,
      structureNom: insc.organisation ?? undefined,
      dossierRef: insc.dossier_ref ?? undefined,
      inscriptionId: id,
    }).catch(() => {
      // Erreur loguée dans sendRelanceAdminNotification, pas de crash ici
    });

    return { ok: true, relance_at: new Date().toISOString() };
  } catch (err) {
    console.error('runRelanceInscription error:', err);
    return { ok: false, status: 500, error: 'Erreur serveur' };
  }
}
