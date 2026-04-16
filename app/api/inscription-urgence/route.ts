export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getSupabaseAdmin } from '@/lib/supabase-server';

/**
 * POST /api/inscription-urgence
 *
 * Valide le JWT d'invitation, vérifie les champs puis insère dans gd_inscriptions.
 * referent_email vient du token JWT vérifié — jamais du body.
 *
 * Body : {
 *   token: string,
 *   jeune_prenom: string,
 *   jeune_nom: string,
 *   date_naissance: string,
 *   structure_nom: string,
 *   ville: string,
 *   referent_email: string  ← ignoré, on utilise payload.email
 * }
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

  // Vérification JWT
  let payloadEmail: string;
  try {
    const encodedSecret = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, encodedSecret);
    const p = payload as Record<string, unknown>;

    if (p.type !== 'educator_invite' || typeof p.email !== 'string') {
      return NextResponse.json(
        { error: { code: 'TOKEN_INVALID', message: 'Lien expiré ou invalide.' } },
        { status: 401 }
      );
    }
    payloadEmail = p.email;
  } catch {
    return NextResponse.json(
      { error: { code: 'TOKEN_INVALID', message: 'Lien expiré ou invalide.' } },
      { status: 401 }
    );
  }

  // Validation champs
  const jeunePrenom    = typeof body.jeune_prenom    === 'string' ? body.jeune_prenom.trim()    : '';
  const jeuneNom       = typeof body.jeune_nom       === 'string' ? body.jeune_nom.trim()       : '';
  const dateNaissance  = typeof body.date_naissance  === 'string' ? body.date_naissance.trim()  : '';
  const structureNom   = typeof body.structure_nom   === 'string' ? body.structure_nom.trim()   : '';
  const ville          = typeof body.ville           === 'string' ? body.ville.trim()           : '';

  if (!jeunePrenom || !jeuneNom || !dateNaissance || !structureNom || !ville) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Tous les champs sont requis.' } },
      { status: 400 }
    );
  }

  // Validation date naissance basique
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateNaissance) || isNaN(new Date(dateNaissance).getTime())) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Date de naissance invalide.' } },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  const { data: rows, error } = await supabase
    .from('gd_inscriptions')
    .insert({
      jeune_prenom:          jeunePrenom,
      jeune_nom:             jeuneNom,
      jeune_date_naissance:  dateNaissance,
      referent_email:        payloadEmail,   // source de vérité = token JWT
      organisation:          structureNom,
      structure_pending_name: structureNom,
      structure_city:        ville,
      status:                'pending',
      payment_method:        'urgence',
      inscription_urgence:   true,
      // Colonnes obligatoires non fournies par ce flow → null explicite
      sejour_slug:           null,
      session_date:          null,
      city_departure:        null,
      referent_nom:          null,
      referent_tel:          null,
      price_total:           null,
    })
    .select('id')
    .single();

  if (error || !rows) {
    console.error('[inscription-urgence] Insert error:', error?.code);
    return NextResponse.json(
      { error: { code: 'INSERT_ERROR', message: 'Impossible de créer l\'inscription.' } },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, inscriptionId: rows.id }, { status: 201 });
}
