export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { requireEditor } from '@/lib/auth-middleware';
import { auditLog } from '@/lib/audit-log';
/**
 * GET /api/admin/propositions — Liste toutes les propositions tarifaires
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireEditor(request);
    if (!auth) {
      return NextResponse.json({ error: 'Accès réservé aux éditeurs et administrateurs.' }, { status: 403 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('gd_propositions_tarifaires')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error (GET propositions):', error);
      throw error;
    }
    return NextResponse.json({ propositions: data || [] });
  } catch (err: unknown) {
    console.error('Error in GET /api/admin/propositions:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/propositions — Créer une nouvelle proposition tarifaire
 * Body: { structure_nom, structure_adresse, structure_cp, structure_ville,
 *         enfant_nom, enfant_prenom, sejour_slug, session_start, session_end,
 *         ville_depart, encadrement }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireEditor(req);
    if (!auth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const supabase = getSupabase();
    const body = await req.json();

    const {
      structure_nom, structure_adresse, structure_cp, structure_ville,
      enfant_nom, enfant_prenom,
      sejour_slug, session_start, session_end,
      ville_depart, encadrement,
    } = body;

    // Validation basique
    if (!structure_nom || !enfant_nom || !enfant_prenom || !sejour_slug || !session_start || !session_end || !ville_depart) {
      return NextResponse.json({ error: 'Champs obligatoires manquants.' }, { status: 400 });
    }

    // Récupérer les infos du séjour
    interface StayRow {
      slug: string;
      title?: string;
      marketing_title?: string;
      description_pro?: string;
    }
    const { data: sejour } = await supabase
      .from('gd_stays')
      .select('slug, title, marketing_title, description_pro')
      .eq('slug', sejour_slug)
      .single() as { data: StayRow | null; error?: unknown };

    if (!sejour) {
      return NextResponse.json({ error: 'Séjour introuvable.' }, { status: 404 });
    }

    // Récupérer le prix depuis gd_session_prices
    const { data: pricing } = await supabase
      .from('gd_session_prices')
      .select('base_price_eur, transport_surcharge_ged, price_ged_total')
      .eq('stay_slug', sejour_slug)
      .eq('start_date', session_start)
      .eq('city_departure', ville_depart)
      .single();

    // Calculer les prix
    const prixSejour = pricing?.base_price_eur || 0;
    const prixTransport = pricing?.transport_surcharge_ged || 0;

    // Calculer encadrement : 630€ par semaine
    const startDate = new Date(session_start);
    const endDate = new Date(session_end);
    const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const nbSemaines = Math.max(1, Math.round(diffDays / 7));
    const prixEncadrement = encadrement ? nbSemaines * 630 : 0;

    const prixTotal = Number(prixSejour) + Number(prixTransport) + prixEncadrement;

    // Récupérer les activités du séjour
    const sejourActivites = sejour.description_pro || '';

    // Créer la proposition
    const { data: proposition, error } = await supabase
      .from('gd_propositions_tarifaires')
      .insert({
        structure_nom,
        structure_adresse: structure_adresse || '',
        structure_cp: structure_cp || '',
        structure_ville: structure_ville || '',
        enfant_nom,
        enfant_prenom,
        sejour_slug,
        sejour_titre: sejour.marketing_title || sejour.title,
        sejour_activites: sejourActivites,
        session_start,
        session_end,
        ville_depart,
        prix_sejour: prixSejour,
        prix_transport: prixTransport,
        encadrement: !!encadrement,
        prix_encadrement: prixEncadrement,
        prix_total: prixTotal,
        status: 'brouillon',
      })
      .select()
      .single();

    if (error) throw error;

    await auditLog(supabase, {
      action: 'create',
      resourceType: 'inscription',
      resourceId: proposition.id,
      actorType: 'admin',
      actorId: auth.email,
      metadata: { enfant_nom, sejour_slug },
    });

    return NextResponse.json({ proposition }, { status: 201 });
  } catch (err: unknown) {
    console.error('Error creating proposition:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/propositions — Mettre à jour le statut d'une proposition
 * Body: { id, status, ... }
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireEditor(req);
    if (!auth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const supabase = getSupabase();
    const body = await req.json();
    const { id, status, note } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID manquant.' }, { status: 400 });
    }

    const validStatuses = ['brouillon', 'envoyee', 'validee', 'refusee'];
    if (status !== undefined && !validStatuses.includes(status)) {
      return NextResponse.json({ error: `Statut invalide. Valeurs : ${validStatuses.join(', ')}` }, { status: 400 });
    }

    // Whitelist stricte des champs modifiables
    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (note !== undefined) updates.note = typeof note === 'string' ? note : null;
    if (status === 'validee') updates.validated_at = new Date().toISOString();

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Aucun champ à mettre à jour.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('gd_propositions_tarifaires')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await auditLog(supabase, {
      action: 'update',
      resourceType: 'inscription',
      resourceId: id,
      actorType: 'admin',
      actorId: auth.email,
      metadata: { fields: Object.keys(updates) },
    });

    return NextResponse.json({ proposition: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/propositions — Supprimer une proposition
 * Body: { id }
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireEditor(req);
    if (!auth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const supabase = getSupabase();
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'ID manquant.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('gd_propositions_tarifaires')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await auditLog(supabase, {
      action: 'delete',
      resourceType: 'inscription',
      resourceId: id,
      actorType: 'admin',
      actorId: auth.email,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
