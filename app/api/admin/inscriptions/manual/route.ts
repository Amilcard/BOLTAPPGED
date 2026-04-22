export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendInscriptionConfirmation, sendChefDeServiceInvitation } from '@/lib/email';
import { logEmailFailure } from '@/lib/email-logger';
import { auditLog } from '@/lib/audit-log';
import { assertInserted } from '@/lib/supabase-guards';
import { captureServerException } from '@/lib/sentry-capture';
import { z } from 'zod';
import { randomBytes } from 'crypto';

/**
 * POST /api/admin/inscriptions/manual
 *
 * Import administratif d'une inscription déjà validée hors flux standard.
 * Usage : dossiers confirmés via devis, à injecter sans repasser par le tunnel public.
 *
 * Différences vs POST /api/inscriptions :
 * - Aucune vérification prix UFOVAL (prix figé du devis accepté tel quel)
 * - Aucune vérification capacité (séjour déjà confirmé)
 * - Statut = 'validee' + paiement = 'paid' d'emblée
 * - Champ remarques marqué [IMPORT_DEVIS_EXTERNE] pour audit trail
 * - Option sendSuiviLink : envoie le lien de suivi à l'éducateur si true
 *
 * Auth : EDITOR ou ADMIN (JWT requis)
 */

const schema = z.object({
  // Enfant
  childFirstName: z.string().min(1),
  childLastName:  z.string().default(''),
  childBirthDate: z.string().min(1),
  // Séjour
  staySlug:      z.string().min(1),
  sessionDate:   z.string().min(1),  // ISO ou YYYY-MM-DD
  cityDeparture: z.string().default('sans_transport'),
  // Référent / éducateur (email partagé par groupe)
  referentNom:   z.string().min(1),
  referentEmail: z.string().email(),
  referentTel:   z.string().default(''),
  // Structure
  structureName:       z.string().min(1),
  structurePostalCode: z.string().regex(/^\d{5}$/),
  structureCity:       z.string().min(1),
  structureCode:       z.string().regex(/^[A-Z0-9]{6}$/).optional(),
  structureAddress:    z.string().optional(),
  // Prix figé (montant réellement facturé — pas de validation UFOVAL)
  priceTotal:       z.number().min(0),
  // Décomposition tarifaire (devis validé)
  prixSejour:       z.number().min(0).optional(),
  prixTransport:    z.number().min(0).optional(),
  prixEncadrement:  z.number().min(0).optional(),
  // Métadonnées optionnelles
  optionsEducatives: z.string().optional(),
  remarques:         z.string().optional(),
  paymentMethod:     z.enum(['transfer', 'check', 'stripe']).default('transfer'),
  // Si true → envoie le lien /suivi/[token] à referentEmail
  sendSuiviLink: z.boolean().default(false),
  // Email de la chef de service → invitation /structure/[code] (vue globale)
  chefDeServiceEmail: z.string().email().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireEditor(request);
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Accès réservé aux administrateurs.' } },
      { status: 401 }
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Données invalides' } },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const normalizedDate = data.sessionDate.split('T')[0];

    // Vérification âge 3-17 ans (réglementaire — séjours éducatifs mineurs)
    const birthDate = new Date(data.childBirthDate);
    const sessionStart = new Date(normalizedDate);
    const ageAtSession = Math.floor((sessionStart.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (ageAtSession < 3 || ageAtSession > 17) {
      return NextResponse.json(
        { error: { code: 'AGE_INVALID', message: `Âge au séjour : ${ageAtSession} ans. Les séjours sont réservés aux 3-17 ans.` } },
        { status: 400 }
      );
    }

    // Vérifier que le séjour existe
    const { data: stayRows } = await supabase
      .from('gd_stays')
      .select('slug, marketing_title')
      .eq('slug', data.staySlug)
      .limit(1);

    if (!stayRows || stayRows.length === 0) {
      return NextResponse.json(
        { error: { code: 'STAY_NOT_FOUND', message: `Séjour "${data.staySlug}" introuvable.` } },
        { status: 400 }
      );
    }

    const sejourDisplayName = (stayRows[0] as { marketing_title?: string }).marketing_title
      || data.staySlug.replace(/-/g, ' ');

    // Anti-doublon (même enfant, même séjour, même email, même date)
    const { data: existing } = await supabase
      .from('gd_inscriptions')
      .select('id, dossier_ref')
      .eq('referent_email', data.referentEmail)
      .eq('sejour_slug', data.staySlug)
      .eq('session_date', normalizedDate)
      .eq('jeune_date_naissance', data.childBirthDate)
      .not('status', 'eq', 'annulee')
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: { code: 'DUPLICATE', message: 'Une inscription identique existe déjà.', dossierRef: (existing as { dossier_ref: string }).dossier_ref } },
        { status: 409 }
      );
    }

    // Résolution structure (même logique que le flux standard)
    // On récupère aussi le code pour le retourner au chef de service
    let structureId: string | null = null;
    let structureCode: string | null = null;
    let structureCreated = false;

    if (data.structureCode) {
      const { data: struct } = await supabase
        .from('gd_structures')
        .select('id, code')
        .eq('code', data.structureCode.toUpperCase())
        .eq('status', 'active')
        .single();
      if (struct) {
        const s = struct as { id: string; code: string };
        structureId   = s.id;
        structureCode = s.code;
      }
    }

    if (!structureId) {
      const { data: existingStruct } = await supabase
        .from('gd_structures')
        .select('id, code')
        .ilike('name', data.structureName)
        .eq('postal_code', data.structurePostalCode)
        .eq('status', 'active')
        .maybeSingle();

      if (existingStruct) {
        const s = existingStruct as { id: string; code: string };
        structureId   = s.id;
        structureCode = s.code;
      } else {
        // Création de la structure — génère un code à 6 chars
        // Non-bloquant : si l'INSERT échoue, on log et on continue avec structureId=null
        // (l'inscription peut exister sans structure attachée côté admin manual).
        const { data: newStruct, error: structErr } = await supabase
          .from('gd_structures')
          .insert({
            name: data.structureName,
            address: data.structureAddress || null,
            postal_code: data.structurePostalCode,
            city: data.structureCity,
            created_by_email: data.referentEmail,
          })
          .select('id, code')
          .single();
        if (structErr) {
          console.error('[admin/inscriptions/manual] Structure insert error (non-blocking):', structErr);
        }
        if (newStruct) {
          const s = newStruct as { id: string; code: string };
          structureId     = s.id;
          structureCode   = s.code;
          structureCreated = true;
        }
      }
    }

    // Génération dossier_ref
    const now = new Date();
    const datePrefix = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = randomBytes(5).toString('hex').substring(0, 8).toUpperCase();
    const dossierRef = `DOS-${datePrefix}-${randomSuffix}`;

    // Audit trail dans remarques
    const remarquesWithSource = [data.remarques, '[IMPORT_DEVIS_EXTERNE]']
      .filter(Boolean)
      .join(' | ');

    // Insertion — statut validée, prix figé, paiement déjà réglé
    const { data: row, error: insertError } = await supabase
      .from('gd_inscriptions')
      .insert({
        sejour_slug:          data.staySlug,
        session_date:         normalizedDate,
        city_departure:       data.cityDeparture,
        jeune_prenom:         data.childFirstName,
        jeune_nom:            data.childLastName,
        jeune_date_naissance: data.childBirthDate,
        referent_nom:         data.referentNom,
        referent_email:       data.referentEmail,
        referent_tel:         data.referentTel,
        organisation:         data.structureName,
        dossier_ref:          dossierRef,
        options_educatives:   data.optionsEducatives || null,
        remarques:            remarquesWithSource,
        price_total:          Math.round(data.priceTotal),
        prix_sejour:          data.prixSejour    ? Math.round(data.prixSejour)    : null,
        prix_transport:       data.prixTransport ? Math.round(data.prixTransport) : null,
        prix_encadrement:     data.prixEncadrement ? Math.round(data.prixEncadrement) : null,
        price_locked:         true,
        price_source:         'devis_externe',
        status:               'validee',
        payment_status:       'paid',
        payment_method:       data.paymentMethod,
        structure_id:         structureId,
        structure_postal_code: data.structurePostalCode,
        structure_city:       data.structureCity,
        structure_address:    data.structureAddress || null,
      })
      .select()
      .single();

    if (insertError) {
      const pgCode = (insertError as { code?: string }).code;
      if (pgCode === '23505') {
        // Race avec idx_inscriptions_nodouplon : une inscription identique a été
        // créée entre le pre-check maybeSingle() et l'INSERT. UX-friendly 409.
        console.warn('[admin/inscriptions/manual] Unique violation (race pre-check):', insertError);
        return NextResponse.json(
          { error: { code: 'DUPLICATE', message: 'Une inscription identique existe déjà.' } },
          { status: 409 }
        );
      }
      console.error('[admin/inscriptions/manual] Insert error:', insertError);
      return NextResponse.json(
        { error: { code: 'INSERT_ERROR', message: 'Impossible de créer l\'inscription.' } },
        { status: 500 }
      );
    }

    const inscription = assertInserted(row, 'admin_manual_create_inscription') as Record<string, unknown>;

    await auditLog(supabase, {
      action: 'create',
      resourceType: 'inscription',
      resourceId: String(inscription.id),
      actorType: 'admin',
      actorId: auth.email,
      metadata: { source: 'manual', dossier_ref: dossierRef, sejour_slug: data.staySlug },
    });
    const appBaseUrl  = process.env.NEXTAUTH_URL || 'https://app.groupeetdecouverte.fr';
    const structureUrl = structureCode ? `${appBaseUrl}/structure/${structureCode}` : null;
    const suiviUrl = inscription.suivi_token
      ? `${appBaseUrl}/suivi/${inscription.suivi_token}`
      : null;

    // Lot L4/6 — on ne bloque JAMAIS la création (201 conservé même email KO),
    // mais l'admin reçoit la liste des warnings dans la réponse pour les afficher
    // sans devoir relire les logs serveur.
    const warnings: Array<{ type: 'email_failed'; context: string; reason: string }> = [];

    // Invitation chef de service (vue globale /structure/[code])
    if (data.chefDeServiceEmail && structureCode && structureUrl) {
      try {
        const cdsResult = await sendChefDeServiceInvitation({
          recipientEmail: data.chefDeServiceEmail,
          structureName:  data.structureName,
          structureCode,
          structureUrl,
        });
        if (!cdsResult.sent) {
          await logEmailFailure(
            'admin_manual_cds_invite',
            cdsResult,
            'structure',
            structureId ?? structureCode
          );
          warnings.push({ type: 'email_failed', context: 'cds_invitation', reason: cdsResult.reason });
        }
      } catch (err) {
        console.error('[admin/inscriptions/manual] sendChefDeServiceInvitation exception:', err);
        warnings.push({ type: 'email_failed', context: 'cds_invitation', reason: 'provider_error' });
      }
    }

    // Envoi optionnel du lien suivi à l'éducateur
    if (data.sendSuiviLink && suiviUrl) {
      try {
        const suiviResult = await sendInscriptionConfirmation({
          referentNom:      data.referentNom,
          referentEmail:    data.referentEmail,
          jeunePrenom:      data.childFirstName,
          jeuneNom:         data.childLastName,
          sejourSlug:       sejourDisplayName,
          sessionDate:      normalizedDate,
          cityDeparture:    data.cityDeparture === 'sans_transport' ? 'Sans transport' : data.cityDeparture,
          priceTotal:       data.priceTotal,
          paymentMethod:    data.paymentMethod,
          paymentReference: dossierRef,
          dossierRef,
          organisation:     data.structureName,
          suiviUrl,
        });
        if (!suiviResult.sent) {
          await logEmailFailure(
            'admin_manual_suivi_link',
            suiviResult,
            'inscription',
            String(inscription.id)
          );
          warnings.push({ type: 'email_failed', context: 'suivi_link', reason: suiviResult.reason });
        }
      } catch (err) {
        console.error('[admin/inscriptions/manual] sendSuiviLink exception:', err);
        warnings.push({ type: 'email_failed', context: 'suivi_link', reason: 'provider_error' });
      }
    }

    return NextResponse.json(
      {
        id:              inscription.id,
        dossier_ref:     dossierRef,
        suivi_token:     inscription.suivi_token,
        suivi_url:       suiviUrl,
        status:          inscription.status,
        payment_status:  inscription.payment_status,
        // Code structure pour accès chef de service → /structure/[code]
        structure_code:    structureCode,
        structure_created: structureCreated,
        structure_url:     structureUrl,
        warnings:         warnings.length > 0 ? warnings : undefined,
      },
      { status: 201 }
    );
  } catch (err) {
    captureServerException(err, { domain: 'rgpd', operation: 'admin_manual_create_inscription' });
    console.error('[admin/inscriptions/manual] Error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur.' } },
      { status: 500 }
    );
  }
}
