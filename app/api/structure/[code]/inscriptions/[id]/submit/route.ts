export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireStructureRole } from '@/lib/structure-guard';
import { requireInscriptionInStructure } from '@/lib/resource-guard';
import { auditLog, getClientIp } from '@/lib/audit-log';
import { structureRateLimitGuard } from '@/lib/rate-limit-structure';
import {
  sendDossierCompletEmail,
  sendDossierGedAdminNotification,
  sendStructureArchivageEmail,
  sendStructureDocumentsPapierEmail,
} from '@/lib/email';
import { REQUIS_TO_JOINT } from '@/lib/dossier-shared';
import { UUID_RE } from '@/lib/validators';
import { captureServerException } from '@/lib/sentry-capture';

/**
 * POST /api/structure/[code]/inscriptions/[id]/submit
 *
 * Soumet le dossier enfant complet à l'équipe GED — version staff structure
 * (secrétariat/direction/CDS/cds_delegated). Miroir fonctionnel de la route
 * référent `/api/dossier-enfant/[inscriptionId]/submit` avec auth JWT session.
 *
 * Décision produit 2026-04-19 : le staff est mandataire légitime de
 * l'éducateur absent — il peut finaliser et envoyer à GED à sa place.
 *
 * Vérifications identiques à la route référent :
 *  1. Auth structure + ownership inscription dans structure
 *  2. Tous les blocs requis completed=true
 *  3. Docs optionnels requis présents
 *  4. Anti-doublon atomique via `.is('ged_sent_at', null)`
 *
 * Différences vs route référent :
 *  - Auth par session cookie (pas de suivi_token)
 *  - Email de confirmation envoyé au référent (inchangé) + BCC staff
 *    → preuve d'envoi pour le staff qui a validé en dépannage
 *  - AuditLog metadata `actor_role` + `context: 'staff_submit_dossier'`
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string; id: string }> },
) {
  try {
    const rateLimited = await structureRateLimitGuard(req);
    if (rateLimited) return rateLimited;

    const { code, id: inscriptionId } = await params;

    if (!UUID_RE.test(inscriptionId)) {
      return NextResponse.json(
        { error: { code: 'INVALID_ID', message: "ID inscription invalide." } },
        { status: 400 },
      );
    }

    const guard = await requireStructureRole(req, code, {
      allowRoles: ['secretariat', 'direction', 'cds', 'cds_delegated'],
      forbiddenMessage: 'Accès réservé au staff structure.',
    });
    if (!guard.ok) return guard.response;
    const resolved = guard.resolved;

    const supabase = getSupabaseAdmin();
    const structureId = resolved.structure.id as string;

    const ownership = await requireInscriptionInStructure({
      supabase,
      inscriptionId,
      structureId,
    });
    if (!ownership.ok) return ownership.response;

    // Charger le dossier (identique à la route référent)
    const { data: dossierRaw, error: dossierErr } = await supabase
      .from('gd_dossier_enfant')
      .select('id, bulletin_completed, sanitaire_completed, liaison_completed, renseignements_completed, renseignements_required, documents_joints, ged_sent_at')
      .eq('inscription_id', inscriptionId)
      .single();

    if (dossierErr || !dossierRaw) {
      return NextResponse.json({ error: 'Dossier introuvable.' }, { status: 404 });
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

    if (dossier.ged_sent_at) {
      return NextResponse.json({ error: 'Dossier déjà envoyé.', alreadySent: true }, { status: 409 });
    }

    // Complétude 4 blocs + renseignements conditionnels
    const renseignementsOk = !dossier.renseignements_required || dossier.renseignements_completed;
    if (!dossier.bulletin_completed || !dossier.sanitaire_completed ||
        !dossier.liaison_completed || !renseignementsOk) {
      return NextResponse.json({ error: 'Dossier incomplet.' }, { status: 400 });
    }

    // Docs optionnels — NON-BLOQUANT depuis 2026-04-19 (décision CEO).
    // Mêmes règles que la route référent : 4 blocs OK suffit, PJ manquantes
    // sont remontées dans la réponse pour relance GED post-envoi.
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
          (dossier.documents_joints as Array<{ type: string }>).map(d => d.type),
        );
        partialDocsMissing = docsRequis
          .filter(k => REQUIS_TO_JOINT[k])
          .filter(k => !uploadedTypes.has(REQUIS_TO_JOINT[k]));
      }
    }

    // UPDATE conditionnel atomique (anti-doublon) — identique à la route référent
    const { data: updatedRows, error: updateErr } = await supabase
      .from('gd_dossier_enfant')
      .update({ ged_sent_at: new Date().toISOString() })
      .eq('id', dossier.id)
      .is('ged_sent_at', null)
      .select('id');

    if (updateErr) {
      console.error('[structure/submit] update ged_sent_at error:', updateErr);
      return NextResponse.json({ error: 'Erreur mise à jour.' }, { status: 500 });
    }

    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json({ error: 'Dossier déjà envoyé.', alreadySent: true }, { status: 409 });
    }

    // Envoi emails — accusé référent (BCC staff) + notif admin GED + archivage structure
    const { data: insc } = await supabase
      .from('gd_inscriptions')
      .select('referent_email, referent_nom, jeune_prenom, jeune_nom, dossier_ref, sejour_slug, session_date, suivi_token')
      .eq('id', inscriptionId)
      .single();

    // Lookup email structure (séparé pour metadata auditLog).
    // structureId vient déjà du guard staff — pas besoin de l'extraire de l'inscription.
    let structureArchiveEmail: string | null = null;
    {
      const { data: structureRow } = await supabase
        .from('gd_structures')
        .select('email')
        .eq('id', structureId)
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
        suivi_token?: string;
      };
      const base = process.env.NEXT_PUBLIC_APP_URL || 'https://app.groupeetdecouverte.fr';

      // Email archivage structure : on utilise la route référent (token) pour
      // que le destinataire (secrétariat) puisse télécharger le PDF sans
      // session structure. Type=bulletin = doc principal pour registre ASE.
      // Si suivi_token absent (édge case), pas d'archivage envoyé.
      const pdfArchiveLink = i.suivi_token
        ? `${base}/api/dossier-enfant/${inscriptionId}/pdf?token=${encodeURIComponent(i.suivi_token)}&type=bulletin`
        : null;

      const emailPromises: Promise<unknown>[] = [
        sendDossierCompletEmail({
          referentEmail: i.referent_email,
          referentNom: i.referent_nom,
          jeunePrenom: i.jeune_prenom,
          jeuneNom: i.jeune_nom,
          dossierRef: i.dossier_ref ?? undefined,
          // BCC staff — preuve d'envoi pour qui a validé en dépannage.
          // Si staff.email === referent.email (édge case absurde), le helper
          // ignore le bcc pour éviter doublon.
          bcc: resolved.email || undefined,
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
      if (structureArchiveEmail && pdfArchiveLink) {
        emailPromises.push(
          sendStructureArchivageEmail({
            structureEmail: structureArchiveEmail,
            jeunePrenom: i.jeune_prenom,
            jeuneNom: i.jeune_nom,
            dossierRef: i.dossier_ref ?? undefined,
            pdfLink: pdfArchiveLink,
          }).catch(err => {
            captureServerException(err, { domain: 'email', operation: 'structure_submit_archivage_email' });
            console.error('[structure/submit] sendStructureArchivageEmail failed:', err);
            return null;
          }),
        );

        // ADR 2026-04-24 — envoi à la structure des 2 PDF papier (liaison
        // pré-remplie + renseignements vierge) à faire signer et retourner
        // via upload. Miroir du flux référent. Requiert suivi_token pour
        // générer le lien PDF liaison (pré-rempli avec données bulletin).
        if (i.suivi_token) {
          const pdfLiaisonLink = `${base}/api/dossier-enfant/${inscriptionId}/pdf?token=${encodeURIComponent(i.suivi_token)}&type=liaison`;
          const pdfRenseignementsLink = `${base}/templates/fiche-renseignements-template.pdf`;
          const suiviUploadLink = `${base}/suivi/${encodeURIComponent(i.suivi_token)}`;
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
              captureServerException(err, { domain: 'email', operation: 'structure_submit_documents_papier_email' });
              console.error('[structure/submit] sendStructureDocumentsPapierEmail failed:', err);
              return null;
            }),
          );
        }
      }

      await Promise.allSettled(emailPromises);
    } else {
      console.error('[structure/submit] inscription non trouvée pour emails', { inscriptionId });
    }

    // AuditLog RGPD Art.9 — dossier enfant soumis par staff (pas référent).
    // partial_docs : true si PJ optionnelles manquantes (envoi partiel toléré).
    // structure_archive_sent : true si l'email d'archivage structure a été déclenché.
    await auditLog(supabase, {
      action: 'submit',
      resourceType: 'dossier_enfant',
      resourceId: inscriptionId,
      inscriptionId,
      actorType: 'staff',
      actorId: resolved.email || undefined,
      ipAddress: getClientIp(req),
      metadata: {
        context: 'staff_submit_dossier',
        actor_role: resolved.role,
        bcc_staff: !!resolved.email,
        partial_docs: partialDocsMissing.length > 0,
        docs_missing_count: partialDocsMissing.length,
        structure_archive_sent: !!structureArchiveEmail,
      },
    });

    return NextResponse.json({
      ok: true,
      gedSentAt: new Date().toISOString(),
      bccStaff: !!resolved.email,
      partial_docs_missing: partialDocsMissing,
    });
  } catch (err) {
    captureServerException(err, { domain: 'audit', operation: 'structure_submit' });
    console.error('POST /api/structure/[code]/inscriptions/[id]/submit error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 },
    );
  }
}
