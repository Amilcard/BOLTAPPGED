export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import {
  sendDossierCompletEmail,
  sendDossierGedAdminNotification,
  sendStructureArchivageEmail,
  sendStructureDocumentsPapierEmail,
} from '@/lib/email';
import { REQUIS_TO_JOINT } from '@/lib/dossier-shared';
import { verifyOwnership } from '@/lib/verify-ownership';
import { auditLog, getClientIp } from '@/lib/audit-log';
import { captureServerException } from '@/lib/sentry-capture';
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
    const { token, email_consent } = body as { token?: string; email_consent?: boolean };

    if (!token || !inscriptionId) {
      return NextResponse.json(
        { error: 'Token et inscriptionId requis.' },
        { status: 400 }
      );
    }

    // Consentement mail obligatoire (ADR 2026-04-24) : le parent confirme
    // qu'il recevra par mail 2 documents (liaison + renseignements) à
    // compléter et retourner. Traçabilité RGPD dans auditLog.
    if (email_consent !== true) {
      return NextResponse.json(
        { error: { code: 'EMAIL_CONSENT_REQUIRED', message: 'Consentement envoi mail requis.' } },
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

    // 5. Calculer les PJ optionnelles manquantes (NON-BLOQUANT — décision CEO 2026-04-19).
    //    Règle : un dossier rempli à 90% vaut mieux que rien à cause d'un petit doc.
    //    Si les 4 blocs sont signés, l'envoi est OK ; GED relance manuellement
    //    en post-envoi pour récupérer les PJ manquantes (vaccins, ordonnance, etc.).
    let partialDocsMissing: string[] = [];
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
        partialDocsMissing = docsRequis
          .filter(k => REQUIS_TO_JOINT[k])
          .filter(k => !uploadedTypes.has(REQUIS_TO_JOINT[k]));
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
      .select('referent_email, referent_nom, jeune_prenom, jeune_nom, dossier_ref, sejour_slug, session_date, structure_id')
      .eq('id', inscriptionId)
      .single();

    // Lookup email structure pour archivage automatique (fire-and-forget plus bas).
    // Hors du `await Promise.allSettled` ci-dessous : on veut connaître la valeur
    // pour le metadata auditLog `structure_archive_sent`.
    let structureArchiveEmail: string | null = null;
    if (insc && (insc as { structure_id?: string }).structure_id) {
      const { data: structureRow } = await supabase
        .from('gd_structures')
        .select('email')
        .eq('id', (insc as { structure_id: string }).structure_id)
        .maybeSingle();
      structureArchiveEmail = (structureRow as { email?: string | null } | null)?.email ?? null;
    }

    if (insc) {
      const i = insc as {
        referent_email: string;
        referent_nom: string;
        jeune_prenom: string;
        jeune_nom: string;
        dossier_ref?: string;
        sejour_slug?: string;
        session_date?: string;
        structure_id?: string;
      };
      const base = process.env.NEXT_PUBLIC_APP_URL || 'https://app.groupeetdecouverte.fr';

      // Email archivage structure : type=bulletin (récap principal pré-rempli).
      // Pas de type "complet" disponible côté générateur PDF — bulletin couvre
      // l'usage registre ASE structure (identité jeune + responsable + séjour).
      // Lien suivi_token (mode référent) : structure peut télécharger sans login.
      const pdfArchiveLink = `${base}/api/dossier-enfant/${inscriptionId}/pdf?token=${encodeURIComponent(token)}&type=bulletin`;

      const emailPromises: Promise<unknown>[] = [
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
      ];

      // Fire-and-forget archivage structure — n'altère ni le statut HTTP ni
      // le timing critique de la réponse. Echec loggé dans la fonction email.
      if (structureArchiveEmail) {
        emailPromises.push(
          sendStructureArchivageEmail({
            structureEmail: structureArchiveEmail,
            jeunePrenom: i.jeune_prenom,
            jeuneNom: i.jeune_nom,
            dossierRef: i.dossier_ref ?? undefined,
            pdfLink: pdfArchiveLink,
          }).catch(err => {
            console.error('[submit] sendStructureArchivageEmail failed:', err);
            captureServerException(err, { domain: 'email', operation: 'sendStructureArchivageEmail' }, { inscriptionId });
            return null;
          }),
        );

        // ADR 2026-04-24 — envoi à la structure des 2 PDF papier (liaison
        // pré-remplie + renseignements vierge) à imprimer, faire signer et
        // retourner via upload. Fire-and-forget comme l'archivage.
        const pdfLiaisonLink = `${base}/api/dossier-enfant/${inscriptionId}/pdf?token=${encodeURIComponent(token)}&type=liaison`;
        const pdfRenseignementsLink = `${base}/templates/fiche-renseignements-template.pdf`;
        const suiviUploadLink = `${base}/suivi/${encodeURIComponent(token)}`;
        emailPromises.push(
          sendStructureDocumentsPapierEmail({
            structureEmail: structureArchiveEmail,
            jeunePrenom: i.jeune_prenom,
            jeuneNom: i.jeune_nom,
            dossierRef: i.dossier_ref ?? undefined,
            pdfLiaisonLink,
            pdfRenseignementsLink,
            suiviUploadLink,
          }).catch(err => {
            console.error('[submit] sendStructureDocumentsPapierEmail failed:', err);
            captureServerException(err, { domain: 'email', operation: 'sendStructureDocumentsPapierEmail' }, { inscriptionId });
            return null;
          }),
        );
      }

      await Promise.allSettled(emailPromises);
    } else {
      console.error('[GED submit email] inscription non trouvée pour envoi emails', { inscriptionId });
    }

    // Audit log : soumission dossier complet (RGPD).
    // partial_docs : true si des PJ optionnelles manquent (envoi partiel toléré).
    // GED voit dans les logs si une relance manuelle des PJ est nécessaire.
    // structure_archive_sent : true si l'email d'archivage structure a été déclenché.
    await auditLog(supabase, {
      action: 'submit',
      resourceType: 'dossier_enfant',
      resourceId: inscriptionId,
      inscriptionId,
      actorType: 'referent',
      actorId: ownership.ok ? ownership.referentEmail : undefined,
      ipAddress: getClientIp(req),
      metadata: {
        partial_docs: partialDocsMissing.length > 0,
        docs_missing_count: partialDocsMissing.length,
        structure_archive_sent: !!structureArchiveEmail,
        // ADR 2026-04-24 — traçabilité consentement mail structure (RGPD)
        email_consent_given: email_consent === true,
        structure_docs_papier_sent: !!structureArchiveEmail,
      },
    });

    return NextResponse.json({
      ok: true,
      gedSentAt: new Date().toISOString(),
      partial_docs_missing: partialDocsMissing,
    });
  } catch (error) {
    console.error('POST /submit error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur lors de l\'envoi du dossier.' },
      { status: 500 }
    );
  }
}

// verifyOwnership importé depuis @/lib/verify-ownership (centralisé RGPD)
