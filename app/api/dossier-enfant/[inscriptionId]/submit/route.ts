export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendDossierCompletEmail, sendDossierGedAdminNotification } from '@/lib/email';
import { REQUIS_TO_JOINT } from '@/lib/dossier-shared';
import { verifyOwnership } from '@/lib/verify-ownership';
import { auditLog, getClientIp } from '@/lib/audit-log';
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

    const supabase = getSupabaseAdmin();

    // 1. Vérifier ownership + expiration token (RGPD centralisé)
    const ownership = await verifyOwnership(supabase, token, inscriptionId);
    if (!ownership.ok) {
      return NextResponse.json(
        { error: { code: ownership.code, message: ownership.message } },
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

    // 5. Vérifier documents optionnels requis par le séjour
    const { data: inscForStay } = await supabase
      .from('gd_inscriptions')
      .select('sejour_slug')
      .eq('id', inscriptionId)
      .single();

    if (inscForStay) {
      const { data: stayForDocs } = await supabase
        .from('gd_stays')
        .select('documents_requis')
        .eq('slug', (inscForStay as { sejour_slug?: string }).sejour_slug)
        .maybeSingle();

      if (stayForDocs) {
        const docsRequis = Array.isArray((stayForDocs as { documents_requis?: unknown[] }).documents_requis)
          ? ((stayForDocs as { documents_requis: unknown[] }).documents_requis as string[])
          : [];
        const uploadedTypes = new Set(
          (dossier.documents_joints as Array<{ type: string }>).map(d => d.type)
        );
        const manquants = docsRequis
          .filter(k => REQUIS_TO_JOINT[k])
          .filter(k => !uploadedTypes.has(REQUIS_TO_JOINT[k]));

        if (manquants.length > 0) {
          return NextResponse.json(
            { error: 'Documents requis manquants.', docs_manquants: manquants },
            { status: 400 }
          );
        }
      }
    }

    // 6. Marquer comme envoyé — UPDATE conditionnel (anti-doublon atomique)
    const { data: updatedRows, error: updateErr } = await supabase
      .from('gd_dossier_enfant')
      .update({ ged_sent_at: new Date().toISOString() })
      .eq('id', dossier.id)
      .is('ged_sent_at', null)
      .select('id');

    if (updateErr) {
      console.error('submit: update ged_sent_at error:', updateErr);
      throw updateErr;
    }

    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json(
        { error: 'Dossier déjà envoyé.', alreadySent: true },
        { status: 409 }
      );
    }

    // 6. Récupérer les infos inscription et envoyer les emails AVANT le return
    // (en serverless, les Promise après return ne sont pas garanties d'être exécutées)
    const { data: insc } = await supabase
      .from('gd_inscriptions')
      .select('referent_email, referent_nom, jeune_prenom, jeune_nom, dossier_ref, sejour_slug, session_date')
      .eq('id', inscriptionId)
      .single();

    if (insc) {
      const i = insc as {
        referent_email: string;
        referent_nom: string;
        jeune_prenom: string;
        jeune_nom: string;
        dossier_ref?: string;
        sejour_slug?: string;
        session_date?: string;
      };
      const base = process.env.NEXT_PUBLIC_APP_URL || 'https://app.groupeetdecouverte.fr';

      await Promise.allSettled([
        sendDossierCompletEmail({
          referentEmail: i.referent_email,
          referentNom: i.referent_nom,
          jeunePrenom: i.jeune_prenom,
          jeuneNom: i.jeune_nom,
          dossierRef: i.dossier_ref ?? undefined,
        }),
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
        }),
      ]);
    } else {
      console.error('[GED submit email] inscription non trouvée pour envoi emails', { inscriptionId });
    }

    // Audit log : soumission dossier complet (RGPD)
    await auditLog(supabase, {
      action: 'submit',
      resourceType: 'dossier_enfant',
      resourceId: inscriptionId,
      inscriptionId,
      actorType: 'referent',
      actorId: ownership.ok ? ownership.referentEmail : undefined,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ ok: true, gedSentAt: new Date().toISOString() });
  } catch (error) {
    console.error('POST /submit error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur lors de l\'envoi du dossier.' },
      { status: 500 }
    );
  }
}

// verifyOwnership importé depuis @/lib/verify-ownership (centralisé RGPD)
