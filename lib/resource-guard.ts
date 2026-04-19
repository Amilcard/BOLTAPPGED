// lib/resource-guard.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { ResolvedAccess } from '@/lib/structure';

/**
 * Guard data-ownership complémentaire à requireStructureRole.
 *
 * Scenario : un éducateur ne doit pouvoir créer/modifier des événements
 * (medical, incidents, calls, notes) que sur SES PROPRES inscriptions —
 * pas sur celles d'un autre éducateur de la même structure.
 *
 * requireStructureRole garantit "rôle valide sur cette structure".
 * requireInscriptionOwnership garantit "inscription scope rôle courant".
 *
 * - direction / cds / cds_delegated : accès total à la structure (filtre structure_id seul)
 * - educateur / secretariat : limité à referent_email (filtre + structure_id)
 *
 * Retour :
 *   { ok: true } si ownership validé
 *   { ok: false, response } avec 404 si inscription absente ou hors scope
 *
 * Pattern cohérent avec structure-guard.ts — caller gère la réponse directement.
 */
export type OwnershipResult =
  | { ok: true }
  | { ok: false; response: NextResponse };

export async function requireInscriptionOwnership(params: {
  supabase: SupabaseClient;
  resolved: ResolvedAccess;
  inscriptionId: string;
  structureId: string;
}): Promise<OwnershipResult> {
  const { supabase, resolved, inscriptionId, structureId } = params;

  let query = supabase
    .from('gd_inscriptions')
    .select('id')
    .eq('id', inscriptionId)
    .eq('structure_id', structureId)
    .is('deleted_at', null);

  // Éducateur : scope restreint à ses propres referent_email.
  // Réassignation explicite — le builder Supabase retourne un nouvel objet
  // chaîné ; ne pas capturer le retour casserait silencieusement le filtre.
  //
  // Note 2026-04-19 : secretariat RETIRÉ du scope. Dans les 4 POST actuels
  // utilisant ce helper (medical/incidents/calls/notes), secretariat est
  // bloqué en amont par `excludeRoles:['secretariat']` → scope jamais atteint
  // en pratique. Pour les routes où secretariat a un accès légitime TOUTE
  // la structure (ex. dossier inscription), utiliser `requireInscriptionInStructure`
  // ci-dessous — pas ce helper.
  if (resolved.role === 'educateur') {
    if (!resolved.email) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Email de session manquant — accès refusé.' },
          { status: 403 },
        ),
      };
    }
    query = query.eq('referent_email', resolved.email);
  }

  const { data } = await query.maybeSingle();

  if (!data) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Inscription introuvable dans votre périmètre.' },
        { status: 404 },
      ),
    };
  }

  return { ok: true };
}

/**
 * Guard "inscription appartient à la structure" — sans scope referent_email.
 *
 * Utilisé par les routes où tout le staff (direction, cds, cds_delegated,
 * secrétariat) doit pouvoir agir sur TOUS les dossiers de la structure —
 * ex. `PATCH /api/structure/[code]/inscriptions/[id]/dossier` (secrétariat
 * dépanne un éducateur absent).
 *
 * Contraste avec `requireInscriptionOwnership` qui restreint `educateur` à
 * ses propres inscriptions (scope referent_email).
 *
 * Retour : OwnershipResult (ok:true | ok:false + response 404).
 */
export async function requireInscriptionInStructure(params: {
  supabase: SupabaseClient;
  inscriptionId: string;
  structureId: string;
}): Promise<OwnershipResult> {
  const { supabase, inscriptionId, structureId } = params;

  const { data } = await supabase
    .from('gd_inscriptions')
    .select('id')
    .eq('id', inscriptionId)
    .eq('structure_id', structureId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!data) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Inscription introuvable dans cette structure.' },
        { status: 404 },
      ),
    };
  }

  return { ok: true };
}
