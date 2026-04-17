export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendAdminUrgenceNotification } from '@/lib/email';
import { auditLog } from '@/lib/audit-log';

/**
 * POST /api/inscription-urgence
 *
 * Crée une inscription complète depuis le lien d'invitation urgence.
 * Le JWT contient : email éducateur + séjour + session + ville départ.
 * L'éducateur fournit uniquement les infos de l'enfant.
 * L'inscription est créée en statut "en_attente" — validation GED requise.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error('[inscription-urgence] NEXTAUTH_SECRET manquant');
    return NextResponse.json(
      { error: { code: 'CONFIG_ERROR', message: 'Erreur de configuration serveur.' } },
      { status: 500 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Corps de requête invalide.' } },
      { status: 400 }
    );
  }

  const { token } = body;
  if (!token || typeof token !== 'string') {
    return NextResponse.json(
      { error: { code: 'TOKEN_INVALID', message: 'Lien expiré ou invalide.' } },
      { status: 401 }
    );
  }

  // Vérification et lecture du JWT
  let payloadEmail: string;
  let sejourSlug: string;
  let sessionDate: string;
  let cityDeparture: string;

  try {
    const encodedSecret = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, encodedSecret);
    const p = payload as Record<string, unknown>;

    if (
      p.type !== 'educator_invite' ||
      typeof p.email !== 'string' ||
      typeof p.sejour_slug !== 'string' ||
      typeof p.session_date !== 'string' ||
      typeof p.city_departure !== 'string'
    ) {
      return NextResponse.json(
        { error: { code: 'TOKEN_INVALID', message: 'Lien expiré ou invalide.' } },
        { status: 401 }
      );
    }

    payloadEmail = p.email;
    sejourSlug = p.sejour_slug;
    sessionDate = p.session_date;
    cityDeparture = p.city_departure;
  } catch {
    return NextResponse.json(
      { error: { code: 'TOKEN_INVALID', message: 'Lien expiré ou invalide.' } },
      { status: 401 }
    );
  }

  // Validation des infos enfant
  const jeunePrenom   = typeof body.jeune_prenom   === 'string' ? body.jeune_prenom.trim()   : '';
  const jeuneNom      = typeof body.jeune_nom      === 'string' ? body.jeune_nom.trim()      : '';
  const dateNaissance = typeof body.date_naissance === 'string' ? body.date_naissance.trim() : '';

  if (!jeunePrenom || !jeuneNom || !dateNaissance) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Prénom, nom et date de naissance requis.' } },
      { status: 400 }
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateNaissance) || isNaN(new Date(dateNaissance).getTime())) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Date de naissance invalide.' } },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  // Récupérer le prix depuis la base
  const { data: priceRow } = await supabase
    .from('gd_session_prices')
    .select('price_ged_total, transport_surcharge_ged')
    .eq('stay_slug', sejourSlug)
    .eq('start_date', sessionDate)
    .eq('city_departure', cityDeparture)
    .single();

  if (!priceRow) {
    return NextResponse.json(
      { error: { code: 'SESSION_NOT_FOUND', message: 'Session introuvable. Le lien est peut-être périmé.' } },
      { status: 400 }
    );
  }

  const priceTotal = (priceRow.price_ged_total ?? 0) + (priceRow.transport_surcharge_ged ?? 0);

  // Récupérer le nom du séjour pour la notification admin
  const { data: stay } = await supabase
    .from('gd_stays')
    .select('marketing_title')
    .eq('slug', sejourSlug)
    .single();
  const sejourTitle = stay?.marketing_title ?? sejourSlug;

  // Générer la référence dossier
  const today = new Date();
  const datePrefix = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const dossierRef = `DOS-${datePrefix}-URG-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  // Créer l'inscription complète
  const { data: inscription, error } = await supabase
    .from('gd_inscriptions')
    .insert({
      jeune_prenom:        jeunePrenom,
      jeune_nom:           jeuneNom,
      jeune_date_naissance: dateNaissance,
      referent_email:      payloadEmail,
      sejour_slug:         sejourSlug,
      session_date:        sessionDate,
      city_departure:      cityDeparture,
      price_total:         priceTotal,
      status:              'en_attente',
      payment_method:      'transfer',
      payment_status:      'pending_transfer',
      dossier_ref:         dossierRef,
      inscription_urgence: true,
    })
    .select('id')
    .single();

  if (error || !inscription) {
    console.error('[inscription-urgence] Insert error:', error?.code, error?.message);
    return NextResponse.json(
      { error: { code: 'INSERT_ERROR', message: 'Impossible de créer l\'inscription. Veuillez réessayer.' } },
      { status: 500 }
    );
  }

  // Audit log
  await auditLog(supabase, {
    action: 'create',
    resourceType: 'inscription',
    resourceId: inscription.id,
    actorType: 'system',
    metadata: { type: 'inscription_urgence', sejour: sejourSlug, session: sessionDate },
  });

  // Notification admin
  try {
    await sendAdminUrgenceNotification({
      jeunePrenom,
      jeuneNom,
      referentEmail: payloadEmail,
      sejourTitle,
      sessionDate,
      cityDeparture,
      dossierRef,
      priceTotal,
    });
  } catch (emailErr) {
    console.error('[inscription-urgence] Notification admin échouée:', (emailErr as Error)?.message);
  }

  return NextResponse.json({ success: true, inscriptionId: inscription.id, dossierRef }, { status: 201 });
}
