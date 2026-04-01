export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { getSupabase } from '@/lib/supabase-server';
import { sendInscriptionConfirmation } from '@/lib/email';
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
  priceTotal:    z.number().min(0),
  // Métadonnées optionnelles
  optionsEducatives: z.string().optional(),
  remarques:         z.string().optional(),
  paymentMethod:     z.enum(['transfer', 'check', 'stripe']).default('transfer'),
  // Si true → envoie le lien /suivi/[token] à referentEmail
  sendSuiviLink: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  const auth = requireEditor(request);
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Accès réservé aux administrateurs.' } },
      { status: 401 }
    );
  }

  try {
    const supabase = getSupabase();
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
    let structureId: string | null = null;

    if (data.structureCode) {
      const { data: struct } = await supabase
        .from('gd_structures')
        .select('id')
        .eq('code', data.structureCode.toUpperCase())
        .eq('status', 'active')
        .single();
      if (struct) structureId = (struct as { id: string }).id;
    }

    if (!structureId) {
      const { data: existingStruct } = await supabase
        .from('gd_structures')
        .select('id')
        .ilike('name', data.structureName)
        .eq('postal_code', data.structurePostalCode)
        .eq('status', 'active')
        .maybeSingle();

      if (existingStruct) {
        structureId = (existingStruct as { id: string }).id;
      } else {
        const { data: newStruct } = await supabase
          .from('gd_structures')
          .insert({
            name: data.structureName,
            address: data.structureAddress || null,
            postal_code: data.structurePostalCode,
            city: data.structureCity,
            created_by_email: data.referentEmail,
          })
          .select('id')
          .single();
        if (newStruct) structureId = (newStruct as { id: string }).id;
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

    if (insertError || !row) {
      console.error('[admin/inscriptions/manual] Insert error:', insertError);
      return NextResponse.json(
        { error: { code: 'INSERT_ERROR', message: 'Impossible de créer l\'inscription.' } },
        { status: 500 }
      );
    }

    const inscription = row as Record<string, unknown>;
    const appBaseUrl = process.env.NEXTAUTH_URL || 'https://app.groupeetdecouverte.fr';
    const suiviUrl = inscription.suivi_token
      ? `${appBaseUrl}/suivi/${inscription.suivi_token}`
      : null;

    // Envoi optionnel du lien suivi à l'éducateur
    if (data.sendSuiviLink && suiviUrl) {
      await sendInscriptionConfirmation({
        referentNom:      data.referentNom,
        referentEmail:    data.referentEmail,
        jeunePrenom:      data.childFirstName,
        jeuneNom:         data.childLastName,
        sejourSlug:       sejourDisplayName,
        sessionDate:      normalizedDate,
        cityDeparture:    data.cityDeparture === 'sans_transport' ? 'Sans transport' : data.cityDeparture,
        priceTotal:       data.priceTotal,
        paymentMethod:    data.paymentMethod,
        paymentReference: String(inscription.id),
        dossierRef,
        organisation:     data.structureName,
        suiviUrl,
      }).catch(err => console.error('[admin/inscriptions/manual] sendSuiviLink error:', err));
    }

    return NextResponse.json(
      {
        id:             inscription.id,
        dossier_ref:    dossierRef,
        suivi_token:    inscription.suivi_token,
        suivi_url:      suiviUrl,
        status:         inscription.status,
        payment_status: inscription.payment_status,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[admin/inscriptions/manual] Error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur.' } },
      { status: 500 }
    );
  }
}
