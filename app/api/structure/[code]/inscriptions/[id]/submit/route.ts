export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireStructureRole } from '@/lib/structure-guard';
import { requireInscriptionInStructure } from '@/lib/resource-guard';
import { auditLog, getClientIp } from '@/lib/audit-log';
import { structureRateLimitGuard } from '@/lib/rate-limit-structure';
import { sendDossierCompletEmail, sendDossierGedAdminNotification } from '@/lib/email';
import { REQUIS_TO_JOINT } from '@/lib/dossier-shared';
import { UUID_RE } from '@/lib/validators';

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

    // Docs optionnels requis par le séjour
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
        const manquants = docsRequis
          .filter(k => REQUIS_TO_JOINT[k])
          .filter(k => !uploadedTypes.has(REQUIS_TO_JOINT[k]));

        if (manquants.length > 0) {
          return NextResponse.json(
            { error: 'Documents requis manquants.', docs_manquants: manquants },
            { status: 400 },
          );
        }
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

    // Envoi emails — accusé référent (BCC staff) + notif admin GED
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
      ]);
    } else {
      console.error('[structure/submit] inscription non trouvée pour emails', { inscriptionId });
    }

    // AuditLog RGPD Art.9 — dossier enfant soumis par staff (pas référent)
    await auditLog(supabase, {
      action: 'submit',
      resourceType: 'dossier_enfant',
      resourceId: inscriptionId,
      inscriptionId,
      actorType: 'referent',
      actorId: resolved.email || undefined,
      ipAddress: getClientIp(req),
      metadata: {
        context: 'staff_submit_dossier',
        actor_role: resolved.role,
        bcc_staff: !!resolved.email,
      },
    });

    return NextResponse.json({
      ok: true,
      gedSentAt: new Date().toISOString(),
      bccStaff: !!resolved.email,
    });
  } catch (err) {
    console.error('POST /api/structure/[code]/inscriptions/[id]/submit error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 },
    );
  }
}
