export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { sendInscriptionConfirmation, sendAdminNewInscriptionNotification } from '@/lib/email';

function getSupabase() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('[supabase inscriptions] SUPABASE_SERVICE_ROLE_KEY manquante');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);
}

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
  paymentMethod: z.enum(['card', 'bank_transfer', 'cheque', 'lyra', 'transfer', 'check']).optional().default('bank_transfer'),
});

// Mapping front-end → DB constraint values
const PAYMENT_METHOD_MAP: Record<string, string> = {
  card: 'lyra',
  bank_transfer: 'transfer',
  cheque: 'check',
  lyra: 'lyra',
  transfer: 'transfer',
  check: 'check',
};

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
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

    // Validation âge (garde-fou serveur : 3-17 ans global GED)
    const birthDate = new Date(data.childBirthDate);
    if (isNaN(birthDate.getTime())) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Date de naissance invalide' } },
        { status: 400 }
      );
    }
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 3 || age > 17) {
      return NextResponse.json(
        { error: { code: 'AGE_INVALID', message: `Âge hors tranche (${age} ans). Les séjours sont réservés aux 3-17 ans.` } },
        { status: 400 }
      );
    }

    // ── PATCH SÉCURITÉ FINANCIÈRE : vérification prix côté serveur ──
    // Normaliser la date envoyée par le front (peut être ISO ou date pure)
    const normalizedDate = data.sessionDate.split('T')[0]; // "2026-07-05T00:00:00Z" → "2026-07-05"
    // Stratégie: chercher par date pure d'abord, fallback par plage si timestamptz
    let priceRow: any = null;
    let priceError: any = null;

    // Tentative 1: match exact date pure
    const { data: priceRows1, error: priceErr1 } = await supabase
      .from('gd_session_prices')
      .select('price_ged_total, transport_surcharge_ged, city_departure')
      .eq('stay_slug', data.staySlug)
      .eq('start_date', normalizedDate)
      .eq('city_departure', data.cityDeparture)
      .limit(1);

    if (priceRows1 && priceRows1.length > 0) {
      priceRow = priceRows1[0];
    } else {
      // Tentative 2: plage timestamps
      const { data: priceRows2, error: priceErr2 } = await supabase
        .from('gd_session_prices')
        .select('price_ged_total, transport_surcharge_ged, city_departure')
        .eq('stay_slug', data.staySlug)
        .gte('start_date', `${normalizedDate}T00:00:00`)
        .lte('start_date', `${normalizedDate}T23:59:59`)
        .eq('city_departure', data.cityDeparture)
        .limit(1);
      priceRow = priceRows2?.[0] ?? null;
      priceError = priceErr2;
    }

    if (priceError || !priceRow) {
      // Fallback : prix sans transport si ville non trouvée pour cette date
      const { data: baseRows1 } = await supabase
        .from('gd_session_prices')
        .select('price_ged_total')
        .eq('stay_slug', data.staySlug)
        .eq('start_date', normalizedDate)
        .eq('city_departure', 'sans_transport')
        .limit(1);

      let basePriceRow = baseRows1?.[0] ?? null;

      if (!basePriceRow) {
        // Tentative 2: plage timestamps
        const { data: baseRows2 } = await supabase
          .from('gd_session_prices')
          .select('price_ged_total')
          .eq('stay_slug', data.staySlug)
          .gte('start_date', `${normalizedDate}T00:00:00`)
          .lte('start_date', `${normalizedDate}T23:59:59`)
          .eq('city_departure', 'sans_transport')
          .limit(1);
        basePriceRow = baseRows2?.[0] ?? null;
      }

      if (!basePriceRow) {
        console.error('PRICE_NOT_FOUND:', { slug: data.staySlug, date: data.sessionDate, city: data.cityDeparture });
        return NextResponse.json(
          { error: { code: 'PRICE_NOT_FOUND', message: 'Impossible de vérifier le prix pour cette session.' } },
          { status: 400 }
        );
      }

      // FIX PRIX MULTI-SÉJOURS: le front calcule base(sans_transport) + transport_surcharge
      // Si la ville n'est pas dans gd_session_prices pour cette date, chercher le surcoût
      // transport via une autre session pour cette ville (données UFOVAL peuvent être incomplètes)
      const sansBasePrice = basePriceRow.price_ged_total ?? 0;
      let cityTransportSurcharge = 0;
      if (data.cityDeparture !== 'sans_transport') {
        const { data: cityTransportRows } = await supabase
          .from('gd_session_prices')
          .select('transport_surcharge_ged')
          .eq('stay_slug', data.staySlug)
          .eq('city_departure', data.cityDeparture)
          .limit(1);
        cityTransportSurcharge = cityTransportRows?.[0]?.transport_surcharge_ged ?? 0;
      }

      // Accepter si le prix correspond à la base OU à base + transport (formule front)
      const frontCalcFallback = sansBasePrice + cityTransportSurcharge;
      const matchesSansTransport = Math.abs(data.priceTotal - sansBasePrice) <= 1;
      const matchesFrontCalcFallback = Math.abs(data.priceTotal - frontCalcFallback) <= 1;

      if (!matchesSansTransport && !matchesFrontCalcFallback) {
        console.error('PRICE_MISMATCH (fallback):', {
          frontend: data.priceTotal,
          sansBase: sansBasePrice,
          frontCalc: frontCalcFallback,
          transport: cityTransportSurcharge,
        });
        return NextResponse.json(
          { error: { code: 'PRICE_MISMATCH', message: 'Le prix envoyé ne correspond pas au tarif en base.' } },
          { status: 400 }
        );
      }
      // Forcer le prix vérifié (frontCalc si disponible, sinon sansBase)
      data.priceTotal = matchesFrontCalcFallback ? Math.round(frontCalcFallback) : sansBasePrice;
    } else {
      // Prix exact trouvé pour cette ville + session
      const serverCityPrice = priceRow.price_ged_total ?? 0;
      const transportSurcharge = priceRow.transport_surcharge_ged ?? 0;

      // FIX PRIX MULTI-SÉJOURS: Le front calcule base(sans_transport) + transport_surcharge_ged
      // Récupérer aussi le prix sans_transport pour valider la formule du front
      // (certains séjours UFOVAL ont price_ged_total(ville) ≠ price_ged_total(sans_transport) + surcharge)
      const { data: sansRows } = await supabase
        .from('gd_session_prices')
        .select('price_ged_total')
        .eq('stay_slug', data.staySlug)
        .eq('start_date', normalizedDate)
        .eq('city_departure', 'sans_transport')
        .limit(1);
      const sansBasePrice = sansRows?.[0]?.price_ged_total ?? null;
      // Formule attendue par le front: base_sans_transport + transport_surcharge_ged
      const frontCalcPrice = sansBasePrice !== null ? sansBasePrice + transportSurcharge : null;

      // Accepter si le prix correspond AU PRIX VILLE ou À LA FORMULE FRONT
      const matchesCityTotal = Math.abs(data.priceTotal - serverCityPrice) <= 1;
      const matchesFrontCalc = frontCalcPrice !== null && Math.abs(data.priceTotal - frontCalcPrice) <= 1;

      if (!matchesCityTotal && !matchesFrontCalc) {
        console.error('PRICE_MISMATCH:', {
          frontend: data.priceTotal,
          serverCityPrice,
          frontCalcPrice,
          sansBasePrice,
          transportSurcharge,
          city: data.cityDeparture,
        });
        return NextResponse.json(
          { error: { code: 'PRICE_MISMATCH', message: 'Le prix envoyé ne correspond pas au tarif en base.' } },
          { status: 400 }
        );
      }
      // Forcer le prix serveur validé (prix ville DB = source de vérité)
      data.priceTotal = serverCityPrice;
    }

    // ── CAPACITY CHECK (read-only, pas de décrement) ──
    const { data: sessionRows } = await supabase
      .from('gd_stay_sessions')
      .select('seats_left, age_min, age_max')
      .eq('stay_slug', data.staySlug)
      .eq('start_date', normalizedDate)
      .limit(1);
    const sessionRow = sessionRows?.[0] ?? null;

    // Validation âge spécifique au séjour
    if (sessionRow && sessionRow.age_min !== null && sessionRow.age_max !== null) {
      const sessionAgeMin = sessionRow.age_min;
      const sessionAgeMax = sessionRow.age_max;
      if (age < sessionAgeMin || age > sessionAgeMax) {
        return NextResponse.json(
          { error: { code: 'AGE_INCOMPATIBLE', message: `Âge incompatible (${age} ans). Ce séjour requiert ${sessionAgeMin}-${sessionAgeMax} ans.` } },
          { status: 400 }
        );
      }
    }

    if (sessionRow && sessionRow.seats_left !== null && sessionRow.seats_left <= 0) {
      return NextResponse.json(
        { error: { code: 'SESSION_FULL', message: 'Cette session est complète. Plus de places disponibles.' } },
        { status: 400 }
      );
    }

    // ── VÉRIFICATION cohérence session → séjour ──
    const { data: sessionCheckRows } = await supabase
      .from('gd_stay_sessions')
      .select('stay_slug')
      .eq('stay_slug', data.staySlug)
      .eq('start_date', normalizedDate)
      .limit(1);
    const sessionCheck = sessionCheckRows?.[0] ?? null;

    // Si pas de session trouvée, on vérifie au moins que le séjour existe
    // (certains séjours n'ont pas de sessions dans gd_stay_sessions mais ont des prix)
    if (!sessionCheck) {
      const { data: stayExists } = await supabase
        .from('gd_stays')
        .select('slug')
        .eq('slug', data.staySlug)
        .limit(1);
      if (!stayExists || stayExists.length === 0) {
        return NextResponse.json(
          { error: { code: 'SESSION_INVALID', message: 'Ce séjour n\'existe pas.' } },
          { status: 400 }
        );
      }
      // Le séjour existe mais pas de session dans gd_stay_sessions → on continue
      // (la vérification prix a déjà validé via gd_session_prices)
    }

    // ── VÉRIFICATION is_full UFOVAL (source de vérité) ──
    const { data: isFullRows } = await supabase
      .from('gd_session_prices')
      .select('is_full')
      .eq('stay_slug', data.staySlug)
      .eq('start_date', normalizedDate)
      .eq('city_departure', data.cityDeparture)
      .limit(1);
    const isFullRow = isFullRows?.[0] ?? null;

    if (isFullRow?.is_full === true) {
      return NextResponse.json(
        { error: { code: 'SESSION_FULL', message: 'Cette session est complète selon UFOVAL.' } },
        { status: 400 }
      );
    }

    // Créer l'inscription dans gd_inscriptions (adapté au schéma DB existant)
    // Pas de colonne 'organisation' en DB → on l'inclut dans remarques
    const remarquesWithOrga = `[ORGANISATION]: ${data.organisation}\n${data.remarques || ''}`.trim();
    // Normaliser la méthode de paiement pour correspondre à la contrainte DB
    const dbPaymentMethod = PAYMENT_METHOD_MAP[data.paymentMethod] || 'transfer';
    const { data: inscriptionRows, error } = await supabase
      .from('gd_inscriptions')
      .insert({
        sejour_slug: data.staySlug,
        session_date: normalizedDate,
        city_departure: data.cityDeparture,
        jeune_prenom: data.childFirstName,
        jeune_nom: data.childLastName || '',
        jeune_date_naissance: data.childBirthDate,
        referent_nom: data.socialWorkerName,
        referent_email: data.email,
        referent_tel: data.phone,
        options_educatives: data.optionsEducatives || null,
        remarques: remarquesWithOrga,
        price_total: Math.round(data.priceTotal),
        status: 'en_attente',
        payment_status: 'pending_payment',
        payment_method: dbPaymentMethod,
      })
      .select();
    const inscription = inscriptionRows?.[0] ?? null;

    if (error || !inscription) {
      console.error('Supabase insert error:', error);
      return NextResponse.json(
        { error: { code: 'INSERT_ERROR', message: 'Impossible de créer l\'inscription.', details: error?.message } },
        { status: 500 }
      );
    }

    // Récupérer le nom marketing du séjour pour l'email
    const { data: stayInfo } = await supabase
      .from('gd_stays')
      .select('marketing_title')
      .eq('slug', data.staySlug)
      .limit(1);
    const sejourDisplayName = stayInfo?.[0]?.marketing_title || data.staySlug.replace(/-/g, ' ');

    // Emails non-bloquants (fire-and-forget)
    const emailData = {
      referentNom: data.socialWorkerName,
      referentEmail: data.email,
      jeunePrenom: data.childFirstName,
      jeuneNom: data.childLastName || '',
      sejourSlug: sejourDisplayName,
      sessionDate: normalizedDate,
      cityDeparture: data.cityDeparture === 'sans_transport' ? 'Sans transport' : data.cityDeparture,
      priceTotal: data.priceTotal,
      paymentMethod: data.paymentMethod,
      paymentReference: inscription.payment_reference || inscription.id,
    };
    sendInscriptionConfirmation(emailData).catch(console.error);
    sendAdminNewInscriptionNotification(emailData).catch(console.error);

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
