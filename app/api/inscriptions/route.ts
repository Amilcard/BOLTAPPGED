import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { sendInscriptionConfirmation, sendAdminNewInscriptionNotification } from '@/lib/email';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const inscriptionSchema = z.object({
  staySlug: z.string().min(1),
  sessionDate: z.string().min(1), // Date de début session
  cityDeparture: z.string().min(1),
  organisation: z.string().min(1),
  socialWorkerName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  childFirstName: z.string().min(1),
  childLastName: z.string().optional().default(''),
  childBirthDate: z.string().min(1),
  optionsEducatives: z.string().optional(),
  remarques: z.string().optional(),
  priceTotal: z.number().min(0),
  consent: z.boolean().refine(v => v === true, { message: 'Consentement requis' }),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = inscriptionSchema.safeParse(body);

    if (!parsed.success) {
      console.error('Validation error:', parsed.error.issues);
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Données invalides' } },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Créer l'inscription dans gd_inscriptions
    const { data: inscription, error } = await supabase
      .from('gd_inscriptions')
      .insert({
        sejour_slug: data.staySlug,
        session_date: data.sessionDate,
        city_departure: data.cityDeparture,
        jeune_prenom: data.childFirstName,
        jeune_nom: data.childLastName,
        jeune_date_naissance: data.childBirthDate,
        organisation: data.organisation,
        referent_nom: data.socialWorkerName,
        referent_email: data.email,
        referent_tel: data.phone,
        options_educatives: data.optionsEducatives,
        remarques: data.remarques,
        price_total: data.priceTotal,
        status: 'en_attente',
        // Les champs payment_* sont auto-générés via trigger (payment_reference)
        // payment_status est DEFAULT 'pending_payment'
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }

    // Emails non-bloquants (fire-and-forget)
    const emailData = {
      referentNom: data.socialWorkerName,
      referentEmail: data.email,
      jeunePrenom: data.childFirstName,
      jeuneNom: data.childLastName || '',
      sejourSlug: data.staySlug,
      sessionDate: data.sessionDate,
      cityDeparture: data.cityDeparture,
      priceTotal: data.priceTotal,
    };
    sendInscriptionConfirmation(emailData).catch(() => {});
    sendAdminNewInscriptionNotification(emailData).catch(() => {});

    return NextResponse.json(
      {
        id: inscription.id,
        payment_reference: inscription.payment_reference,
        status: inscription.status,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('POST /api/inscriptions error:', error);
    const message = error instanceof Error ? error.message : 'Erreur';

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur', details: message } },
      { status: 500 }
    );
  }
}
