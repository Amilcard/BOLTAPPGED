export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { verifyProSession } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendPropositionAlertGED } from '@/lib/email';

export async function POST(req: NextRequest) {
  const auth = await verifyProSession(req);
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentification requise.' } },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Corps invalide.' } },
      { status: 400 }
    );
  }

  const { sejour_slug, session_date, city_departure } = body;

  if (
    typeof sejour_slug !== 'string' || !sejour_slug.trim() ||
    typeof session_date !== 'string' || !session_date.trim() ||
    typeof city_departure !== 'string' || !city_departure.trim()
  ) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'sejour_slug, session_date et city_departure sont requis.' } },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  const { data: pricing } = await supabase
    .from('gd_session_prices')
    .select('base_price_eur, transport_surcharge_ged, price_ged_total, start_date, end_date')
    .eq('stay_slug', sejour_slug)
    .eq('start_date', session_date)
    .eq('city_departure', city_departure)
    .single();

  if (!pricing) {
    return NextResponse.json(
      { error: { code: 'SESSION_NOT_FOUND', message: 'Session ou tarif introuvable.' } },
      { status: 400 }
    );
  }

  const { data: stay } = await supabase
    .from('gd_stays')
    .select('marketing_title, title')
    .eq('slug', sejour_slug)
    .single();

  const sejourTitre = ((stay?.marketing_title || stay?.title || sejour_slug) as string);
  const dateFormatted = new Date(session_date).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const { data: proposition, error } = await supabase
    .from('gd_propositions_tarifaires')
    .insert({
      demandeur_email:  auth.email,
      demandeur_nom:    auth.structureName || auth.email,
      structure_nom:    auth.structureName || '',
      sejour_slug,
      sejour_titre:     sejourTitre,
      session_start:    pricing.start_date,
      session_end:      pricing.end_date ?? pricing.start_date,
      ville_depart:     city_departure,
      prix_sejour:      pricing.base_price_eur ?? 0,
      prix_transport:   pricing.transport_surcharge_ged ?? 0,
      prix_encadrement: 0,
      prix_total:       pricing.price_ged_total ?? 0,
      status:           'demandee',
      created_by:       auth.email,
    })
    .select('id')
    .single();

  if (error || !proposition) {
    console.error('[propositions/request] insert error:', error?.message);
    return NextResponse.json(
      { error: { code: 'INSERT_ERROR', message: 'Impossible de créer la demande.' } },
      { status: 500 }
    );
  }

  sendPropositionAlertGED({
    demandeurNom:   auth.structureName || auth.email,
    demandeurEmail: auth.email,
    sejourTitre,
    sessionDate:    dateFormatted,
    villeDepart:    city_departure,
    propositionId:  proposition.id,
  }).catch(err => console.error('[propositions/request] alert email failed:', err));

  return NextResponse.json({ ok: true, propositionId: proposition.id }, { status: 201 });
}
