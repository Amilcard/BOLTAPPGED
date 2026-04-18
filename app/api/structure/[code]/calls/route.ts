export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireStructureRole } from '@/lib/structure-guard';
import { requireInscriptionOwnership } from '@/lib/resource-guard';
import { auditLog } from '@/lib/audit-log';
import { structureRateLimitGuard } from '@/lib/rate-limit-structure';

const VALID_CALL_TYPES = ['ged_colo', 'educ_colo', 'colo_structure', 'astreinte', 'parents'] as const;
const VALID_DIRECTIONS = ['entrant', 'sortant'] as const;

/**
 * GET /api/structure/[code]/calls
 * Liste les appels significatifs. Tous les rôles sauf secrétariat.
 * Éducateur : lecture seule.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
 try {
  const rateLimited = await structureRateLimitGuard(_req);
  if (rateLimited) return rateLimited;

  const { code } = await params;
  const guard = await requireStructureRole(_req, code, { excludeRoles: ['secretariat'] });
  if (!guard.ok) return guard.response;
  const resolved = guard.resolved;

  const supabase = getSupabaseAdmin();
  const structureId = resolved.structure.id as string;

  let query = supabase
    .from('gd_calls')
    .select('id, inscription_id, call_type, direction, interlocuteur, resume, parent_accord, created_by, call_date, created_at')
    .eq('structure_id', structureId)
    .order('call_date', { ascending: false });

  // Éducateur : lecture limitée à ses propres inscriptions (RGPD Art. 9)
  if (resolved.role === 'educateur' && resolved.email) {
    const { data: myInscriptions } = await supabase
      .from('gd_inscriptions')
      .select('id')
      .eq('structure_id', structureId)
      .eq('referent_email', resolved.email);

    const ids = (myInscriptions ?? []).map((i: { id: string }) => i.id);
    if (ids.length === 0) {
      return NextResponse.json({ calls: [] });
    }
    query = query.in('inscription_id', ids);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[calls GET] error:', error.message);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }

  return NextResponse.json({ calls: data ?? [] });
 } catch (err) {
  console.error('GET /api/structure/[code]/calls error:', err);
  return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } }, { status: 500 });
 }
}

/**
 * POST /api/structure/[code]/calls
 * Tracer un appel significatif. Direction et CDS uniquement.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
 try {
  const rateLimited = await structureRateLimitGuard(req);
  if (rateLimited) return rateLimited;

  const { code } = await params;
  const guard = await requireStructureRole(req, code, {
    allowRoles: ['direction', 'cds', 'cds_delegated'],
    forbiddenMessage: 'Accès réservé à la direction et au CDS.',
  });
  if (!guard.ok) return guard.response;
  const resolved = guard.resolved;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const { inscription_id, call_type, direction, interlocuteur, resume, parent_accord } = body;

  if (!call_type || !VALID_CALL_TYPES.includes(call_type as typeof VALID_CALL_TYPES[number])) {
    return NextResponse.json({ error: `Type d'appel invalide. Valeurs : ${VALID_CALL_TYPES.join(', ')}` }, { status: 400 });
  }
  if (!direction || !VALID_DIRECTIONS.includes(direction as typeof VALID_DIRECTIONS[number])) {
    return NextResponse.json({ error: 'Sens requis : entrant ou sortant.' }, { status: 400 });
  }
  if (!interlocuteur || typeof interlocuteur !== 'string' || interlocuteur.trim().length < 2) {
    return NextResponse.json({ error: 'Interlocuteur requis.' }, { status: 400 });
  }
  if (!resume || typeof resume !== 'string' || resume.trim().length < 5) {
    return NextResponse.json({ error: 'Résumé requis (min 5 caractères).' }, { status: 400 });
  }

  // Si appel parents, vérifier accord
  if (call_type === 'parents' && !parent_accord) {
    return NextResponse.json({ error: 'L\'accord de la structure est requis pour un appel parents.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const structureId = resolved.structure.id as string;

  // Si inscription_id fourni, vérifier ownership scope rôle courant
  // (éducateur/secrétariat limité à ses propres inscriptions).
  if (inscription_id && typeof inscription_id === 'string') {
    const ownership = await requireInscriptionOwnership({
      supabase,
      resolved,
      inscriptionId: inscription_id,
      structureId,
    });
    if (!ownership.ok) return ownership.response;
  }

  const { data: call, error: insertError } = await supabase
    .from('gd_calls')
    .insert({
      structure_id: structureId,
      inscription_id: inscription_id && typeof inscription_id === 'string' ? inscription_id : null,
      call_type,
      direction,
      interlocuteur: interlocuteur.trim(),
      resume: resume.trim(),
      parent_accord: call_type === 'parents' ? !!parent_accord : false,
      created_by: resolved.email || 'unknown',
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[calls POST] error:', insertError.message);
    return NextResponse.json({ error: 'Erreur création appel.' }, { status: 500 });
  }

  await auditLog(supabase, {
    action: 'create',
    resourceType: 'structure',
    resourceId: call.id,
    inscriptionId: (inscription_id as string) || undefined,
    actorType: 'referent',
    actorId: resolved.email || undefined,
    metadata: { type: 'call_traced', call_type, direction, role: resolved.role },
  });

  return NextResponse.json({ ok: true, id: call.id }, { status: 201 });
 } catch (err) {
  console.error('POST /api/structure/[code]/calls error:', err);
  return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } }, { status: 500 });
 }
}
