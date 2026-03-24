export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

// Blocs JSONB éditables (whitelist)
const EDITABLE_BLOCS = [
  'bulletin_complement',
  'fiche_sanitaire',
  'fiche_liaison_jeune',
  'fiche_renseignements',
] as const;

type BlocName = typeof EDITABLE_BLOCS[number];

/**
 * GET /api/dossier-enfant/[inscriptionId]?token=xxx
 * Retourne le dossier enfant lié à une inscription.
 * Sécurité : le suivi_token doit correspondre au même référent.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { inscriptionId: string } }
) {
  try {
    const { inscriptionId } = params;
    const token = req.nextUrl.searchParams.get('token');

    if (!token || !inscriptionId) {
      return NextResponse.json(
        { error: { code: 'MISSING_PARAMS', message: 'Paramètres manquants.' } },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Vérifier ownership via token
    const ownership = await verifyOwnership(supabase, token, inscriptionId);
    if (!ownership.ok) {
      return NextResponse.json(
        { error: { code: ownership.code, message: ownership.message } },
        { status: ownership.status }
      );
    }

    // Chercher le dossier enfant existant
    const { data: dossier, error: err } = await supabase
      .from('gd_dossier_enfant')
      .select('*')
      .eq('inscription_id', inscriptionId)
      .maybeSingle();

    if (err) {
      console.error('GET dossier-enfant error:', err);
      throw err;
    }

    // Si pas de dossier, retourner un squelette vide (le front sait qu'il faut créer)
    if (!dossier) {
      // Déterminer renseignements_required depuis gd_stays pour afficher le bon nombre d'onglets dès le premier chargement
      let renseignementsRequired = false;
      const { data: inscRaw } = await supabase
        .from('gd_inscriptions')
        .select('sejour_slug')
        .eq('id', inscriptionId)
        .single();
      if (inscRaw) {
        const { data: stayRaw } = await supabase
          .from('gd_stays')
          .select('documents_requis')
          .eq('slug', (inscRaw as { sejour_slug?: string }).sejour_slug)
          .maybeSingle();
        if (stayRaw) {
          const docs = Array.isArray((stayRaw as { documents_requis?: unknown[] }).documents_requis)
            ? (stayRaw as { documents_requis: unknown[] }).documents_requis
            : [];
          renseignementsRequired = docs.includes('renseignements');
        }
      }

      return NextResponse.json({
        exists: false,
        inscriptionId,
        bulletin_complement: {},
        fiche_sanitaire: {},
        fiche_liaison_jeune: {},
        fiche_renseignements: null,
        documents_joints: [],
        bulletin_completed: false,
        sanitaire_completed: false,
        liaison_completed: false,
        renseignements_completed: false,
        renseignements_required: renseignementsRequired,
      });
    }

    return NextResponse.json({
      exists: true,
      ...dossier,
    });
  } catch (error) {
    console.error('GET /api/dossier-enfant error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/dossier-enfant/[inscriptionId]
 * Met à jour un bloc JSONB du dossier enfant.
 * Body : { token, bloc, data, completed? }
 * - token : suivi_token pour authentification
 * - bloc : nom du bloc JSONB (whitelist)
 * - data : objet JSONB à merger dans le bloc
 * - completed : booléen optionnel pour marquer le bloc comme complet
 *
 * Stratégie : MERGE (pas remplace) — on fusionne data dans le bloc existant.
 * Cela permet la sauvegarde progressive champ par champ.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { inscriptionId: string } }
) {
  try {
    const { inscriptionId } = params;
    const body = await req.json();
    const { token, bloc, data, completed } = body;

    if (!token || !inscriptionId || !bloc) {
      return NextResponse.json(
        { error: { code: 'MISSING_PARAMS', message: 'Paramètres manquants.' } },
        { status: 400 }
      );
    }

    // Vérifier que le bloc est dans la whitelist
    if (!EDITABLE_BLOCS.includes(bloc as BlocName)) {
      return NextResponse.json(
        { error: { code: 'INVALID_BLOC', message: 'Bloc non autorisé.' } },
        { status: 403 }
      );
    }

    // Validation basique : data doit être un objet
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return NextResponse.json(
        { error: { code: 'INVALID_DATA', message: 'Les données doivent être un objet.' } },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Vérifier ownership via token
    const ownership = await verifyOwnership(supabase, token, inscriptionId);
    if (!ownership.ok) {
      return NextResponse.json(
        { error: { code: ownership.code, message: ownership.message } },
        { status: ownership.status }
      );
    }

    // Vérifier si le dossier existe déjà
    const { data: existing } = await supabase
      .from('gd_dossier_enfant')
      .select('id, ' + bloc)
      .eq('inscription_id', inscriptionId)
      .maybeSingle();

    let result;

    if (!existing) {
      // Créer le dossier avec ce bloc
      const insertData: Record<string, unknown> = {
        inscription_id: inscriptionId,
        [bloc]: data,
      };
      if (typeof completed === 'boolean') {
        // Map bloc name to completed column
        const completedCol = getCompletedColumn(bloc);
        if (completedCol) insertData[completedCol] = completed;
      }

      // Initialiser renseignements_required depuis gd_stays.documents_requis
      const { data: inscRaw } = await supabase
        .from('gd_inscriptions')
        .select('sejour_slug')
        .eq('id', inscriptionId)
        .single();
      if (inscRaw) {
        const insc = inscRaw as { sejour_slug?: string };
        const { data: stayRaw } = await supabase
          .from('gd_stays')
          .select('documents_requis')
          .eq('slug', insc.sejour_slug)
          .maybeSingle();
        if (stayRaw) {
          const stay = stayRaw as { documents_requis?: unknown[] };
          const docs = Array.isArray(stay.documents_requis) ? stay.documents_requis : [];
          insertData.renseignements_required = docs.includes('renseignements');
        }
      }

      const { data: inserted, error: insertErr } = await supabase
        .from('gd_dossier_enfant')
        .insert(insertData)
        .select()
        .single();

      if (insertErr) {
        console.error('INSERT dossier-enfant error:', insertErr);
        throw insertErr;
      }
      result = inserted;
    } else {
      // Merger les données dans le bloc existant
      const existingBloc = (existing as unknown as Record<string, unknown>)[bloc] as Record<string, unknown> || {};
      const merged = { ...existingBloc, ...data };

      const updateData: Record<string, unknown> = {
        [bloc]: merged,
      };
      const completedCol = getCompletedColumn(bloc);
      if (typeof completed === 'boolean' && completedCol) {
        updateData[completedCol] = completed;
      }

      const { data: updated, error: updateErr } = await supabase
        .from('gd_dossier_enfant')
        .update(updateData)
        .eq('inscription_id', inscriptionId)
        .select()
        .single();

      if (updateErr) {
        console.error('UPDATE dossier-enfant error:', updateErr);
        throw updateErr;
      }
      result = updated;

    }

    return NextResponse.json({ ok: true, dossier: result });
  } catch (error) {
    console.error('PATCH /api/dossier-enfant error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}

// === Helpers ===

function getCompletedColumn(bloc: string): string | null {
  const map: Record<string, string> = {
    bulletin_complement: 'bulletin_completed',
    fiche_sanitaire: 'sanitaire_completed',
    fiche_liaison_jeune: 'liaison_completed',
    fiche_renseignements: 'renseignements_completed',
  };
  return map[bloc] || null;
}

async function verifyOwnership(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  token: string,
  inscriptionId: string
): Promise<{ ok: true } | { ok: false; code: string; message: string; status: number }> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(token)) {
    return { ok: false, code: 'INVALID_TOKEN', message: 'Token invalide.', status: 400 };
  }
  if (!uuidRegex.test(inscriptionId)) {
    return { ok: false, code: 'INVALID_ID', message: 'ID inscription invalide.', status: 400 };
  }

  // Trouver le referent_email du token
  const { data: sourceRaw } = await supabase
    .from('gd_inscriptions')
    .select('referent_email')
    .eq('suivi_token', token)
    .single();
  const source = sourceRaw as { referent_email: string } | null;

  if (!source) {
    return { ok: false, code: 'NOT_FOUND', message: 'Token non trouvé.', status: 404 };
  }

  // Vérifier que l'inscription ciblée appartient au même référent
  const { data: targetRaw } = await supabase
    .from('gd_inscriptions')
    .select('referent_email')
    .eq('id', inscriptionId)
    .single();
  const target = targetRaw as { referent_email: string } | null;

  if (!target || target.referent_email !== source.referent_email) {
    return { ok: false, code: 'FORBIDDEN', message: 'Accès non autorisé.', status: 403 };
  }

  return { ok: true };
}
