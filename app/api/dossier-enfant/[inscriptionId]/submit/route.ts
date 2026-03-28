export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendDossierCompletEmail, sendDossierGedAdminNotification } from '@/lib/email';

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

/**
 * POST /api/dossier-enfant/[inscriptionId]/submit
 * Soumet le dossier enfant complet à l'équipe GED.
 * Body : { token }
 *
 * Vérifications :
 *  1. Ownership (token == referent de l'inscription)
 *  2. Tous les blocs requis sont completed = true
 *  3. Anti-doublon : ged_sent_at IS NULL
 *
 * Si OK :
 *  - Met à jour ged_sent_at = now()
 *  - Envoie email accusé de réception au référent
 *  - Envoie notification admin GED
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ inscriptionId: string }> }
) {
  try {
    const { inscriptionId } = await params;
    const body = await req.json();
    const { token } = body;

    if (!token || !inscriptionId) {
      return NextResponse.json(
        { error: 'Token et inscriptionId requis.' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // 1. Vérifier ownership
    const ownership = await verifyOwnership(supabase, token, inscriptionId);
    if (!ownership.ok) {
      return NextResponse.json(
        { error: ownership.message },
        { status: ownership.status }
      );
    }

    // 2. Charger le dossier
    const { data: dossierRaw, error: dossierErr } = await supabase
      .from('gd_dossier_enfant')
      .select('id, bulletin_completed, sanitaire_completed, liaison_completed, renseignements_completed, renseignements_required, documents_joints, ged_sent_at')
      .eq('inscription_id', inscriptionId)
      .single();

    if (dossierErr || !dossierRaw) {
      return NextResponse.json(
        { error: 'Dossier introuvable.' },
        { status: 404 }
      );
    }

    const dossier = dossierRaw as {
      id: string;
      bulletin_completed: boolean;
      sanitaire_completed: boolean;
      liaison_completed: boolean;
      renseignements_completed: boolean;
      renseignements_required: boolean;
      documents_joints: unknown[];
      ged_sent_at: string | null;
    };

    // 3. Anti-doublon
    if (dossier.ged_sent_at) {
      return NextResponse.json(
        { error: 'Dossier déjà envoyé.', alreadySent: true },
        { status: 409 }
      );
    }

    // 4. Vérifier complétude — renseignements uniquement si requis par le séjour
    const renseignementsOk = !dossier.renseignements_required || dossier.renseignements_completed;
    if (!dossier.bulletin_completed || !dossier.sanitaire_completed ||
        !dossier.liaison_completed || !renseignementsOk) {
      return NextResponse.json(
        { error: 'Dossier incomplet.' },
        { status: 400 }
      );
    }

    // 5. Marquer comme envoyé
    const { error: updateErr } = await supabase
      .from('gd_dossier_enfant')
      .update({ ged_sent_at: new Date().toISOString() })
      .eq('id', dossier.id);

    if (updateErr) {
      console.error('submit: update ged_sent_at error:', updateErr);
      throw updateErr;
    }

    // 6. Récupérer les infos inscription pour les emails (fire-and-forget)
    Promise.resolve(
      supabase
        .from('gd_inscriptions')
        .select('referent_email, referent_nom, jeune_prenom, jeune_nom, dossier_ref, sejour_slug, session_date')
        .eq('id', inscriptionId)
        .single()
    ).then(({ data: insc }) => {
      if (!insc) return;
      const i = insc as {
        referent_email: string;
        referent_nom: string;
        jeune_prenom: string;
        jeune_nom: string;
        dossier_ref?: string;
        sejour_slug?: string;
        session_date?: string;
      };

      // Email accusé de réception au référent
      sendDossierCompletEmail({
        referentEmail: i.referent_email,
        referentNom: i.referent_nom,
        jeunePrenom: i.jeune_prenom,
        jeuneNom: i.jeune_nom,
        dossierRef: i.dossier_ref ?? undefined,
      }).catch((err) => { console.error('[GED submit email] sendDossierCompletEmail failed', { inscriptionId, err }); });

      // Notification admin GED avec liens PDF
      const base = process.env.NEXT_PUBLIC_APP_URL || 'https://app.groupeetdecouverte.fr';
      sendDossierGedAdminNotification({
        referentNom: i.referent_nom,
        referentEmail: i.referent_email,
        jeunePrenom: i.jeune_prenom,
        jeuneNom: i.jeune_nom,
        dossierRef: i.dossier_ref ?? undefined,
        sejourSlug: i.sejour_slug ?? '',
        sessionDate: i.session_date ?? '',
        inscriptionId,
        adminUrl: `${base}/admin/demandes`,
      }).catch((err) => { console.error('[GED submit email] sendDossierGedAdminNotification failed', { inscriptionId, err }); });
    }).catch((err) => { console.error('[GED submit email] fetch inscription for email failed', { inscriptionId, err }); });

    return NextResponse.json({ ok: true, gedSentAt: new Date().toISOString() });
  } catch (error) {
    console.error('POST /submit error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur lors de l\'envoi du dossier.' },
      { status: 500 }
    );
  }
}

// ─── Helpers ───

async function verifyOwnership(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  token: string,
  inscriptionId: string
): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(token)) return { ok: false, message: 'Token invalide.', status: 400 };
  if (!uuidRegex.test(inscriptionId)) return { ok: false, message: 'ID invalide.', status: 400 };

  const { data: source } = await supabase
    .from('gd_inscriptions')
    .select('referent_email')
    .eq('suivi_token', token)
    .single();

  if (!source) return { ok: false, message: 'Token non trouvé.', status: 404 };

  const { data: target } = await supabase
    .from('gd_inscriptions')
    .select('referent_email')
    .eq('id', inscriptionId)
    .single();

  if (!target || target.referent_email !== source.referent_email) {
    return { ok: false, message: 'Accès non autorisé.', status: 403 };
  }

  return { ok: true };
}
