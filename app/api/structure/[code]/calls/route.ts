export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { resolveCodeToStructure } from '@/lib/structure';
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
  const rateLimited = await structureRateLimitGuard(_req);
  if (rateLimited) return rateLimited;

  const { code } = await params;
  const resolved = await resolveCodeToStructure(code);
  if (!resolved || resolved.role === 'secretariat') {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }

  const supabase = getSupabase();
  const structureId = resolved.structure.id as string;

  const { data, error } = await supabase
    .from('gd_calls')
    .select('id, inscription_id, call_type, direction, interlocuteur, resume, parent_accord, created_by, call_date, created_at')
    .eq('structure_id', structureId)
    .order('call_date', { ascending: false });

  if (error) {
    console.error('[calls GET] error:', error.message);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }

  return NextResponse.json({ calls: data ?? [] });
}

/**
 * POST /api/structure/[code]/calls
 * Tracer un appel significatif. Direction et CDS uniquement.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const rateLimited = await structureRateLimitGuard(req);
  if (rateLimited) return rateLimited;

  const { code } = await params;
  const resolved = await resolveCodeToStructure(code);
  if (!resolved || !['direction', 'cds', 'cds_delegated'].includes(resolved.role)) {
    return NextResponse.json({ error: 'Accès réservé à la direction et au CDS.' }, { status: 403 });
  }

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

  const supabase = getSupabase();
  const structureId = resolved.structure.id as string;

  // Si inscription_id fourni, vérifier qu'elle appartient à la structure
  if (inscription_id && typeof inscription_id === 'string') {
    const { data: insc } = await supabase
      .from('gd_inscriptions')
      .select('id')
      .eq('id', inscription_id)
      .eq('structure_id', structureId)
      .single();

    if (!insc) {
      return NextResponse.json({ error: 'Inscription introuvable dans cette structure.' }, { status: 404 });
    }
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
}
