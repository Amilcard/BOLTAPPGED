export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { verifyProSession } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendPropositionAlertGED } from '@/lib/email';
import { logEmailFailure } from '@/lib/email-logger';
import { isRateLimited, getClientIpFromHeaders } from '@/lib/rate-limit';
import { auditLog, getClientIp } from '@/lib/audit-log';

export async function POST(req: NextRequest) {
  const auth = await verifyProSession(req);
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentification requise.' } },
      { status: 401 }
    );
  }

  const ip = getClientIpFromHeaders(req.headers);
  if (await isRateLimited('prop', ip, 10, 5)) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: 'Trop de demandes. Réessayez dans 5 minutes.' } },
      { status: 429, headers: { 'Retry-After': '300' } }
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

  const { sejour_slug, session_date, session_end_date, city_departure } = body;

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

  // session_end_date optionnel (backward compat). Si fourni, query précise.
  // Sinon : prend la formule la plus courte (end_date min) — prix le plus bas par défaut.
  let pricingQuery = supabase
    .from('gd_session_prices')
    .select('base_price_eur, transport_surcharge_ged, price_ged_total, start_date, end_date')
    .eq('stay_slug', sejour_slug)
    .eq('start_date', session_date)
    .eq('city_departure', city_departure);

  if (typeof session_end_date === 'string' && session_end_date.trim()) {
    pricingQuery = pricingQuery.eq('end_date', session_end_date);
  }

  const { data: pricing } = await pricingQuery
    .order('end_date', { ascending: true })
    .limit(1)
    .maybeSingle();

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

  await auditLog(supabase, {
    action: 'create',
    resourceType: 'proposition',
    resourceId: proposition.id,
    actorType: 'admin',
    actorId: auth.email,
    ipAddress: getClientIp(req),
    metadata: {
      sejour_slug,
      session_start: pricing.start_date,
      city_departure,
      structure_name: auth.structureName ?? null,
      prix_total: pricing.price_ged_total ?? 0,
    },
  });

  // L5/6 — refactor EmailResult : await + check sent, mais on NE BLOQUE PAS
  // la réponse 201 (l'insert proposition a réussi côté DB, l'alerte admin est
  // un side-effect best-effort). M2 audit 2026-04-21 : tracer proprement les
  // échecs via logEmailFailure plutôt qu'un console.error seul.
  const alertResult = await sendPropositionAlertGED({
    demandeurNom:   auth.structureName || auth.email,
    demandeurEmail: auth.email,
    sejourTitre,
    sessionDate:    dateFormatted,
    villeDepart:    city_departure,
    propositionId:  proposition.id,
  });
  if (!alertResult.sent) {
    await logEmailFailure('sendPropositionAlertGED', alertResult, 'proposition', proposition.id);
  }

  return NextResponse.json({ ok: true, propositionId: proposition.id }, { status: 201 });
}
