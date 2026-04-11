export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { resolveCodeToStructure } from '@/lib/structure';
import { auditLog } from '@/lib/audit-log';

const VALID_CATEGORIES = ['medical', 'comportemental', 'fugue', 'accident', 'autre'] as const;
const VALID_SEVERITIES = ['info', 'attention', 'urgent'] as const;

/**
 * GET /api/structure/[code]/incidents
 * Liste les incidents de la structure. Tous les rôles sauf secrétariat.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const resolved = await resolveCodeToStructure(code);
  if (!resolved || resolved.role === 'secretariat') {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }

  const supabase = getSupabase();
  const structureId = resolved.structure.id as string;

  const { data, error } = await supabase
    .from('gd_incidents')
    .select('id, inscription_id, category, severity, status, description, resolved_at, created_by, created_at')
    .eq('structure_id', structureId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[incidents GET] error:', error.message);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }

  return NextResponse.json({ incidents: data ?? [] });
}

/**
 * POST /api/structure/[code]/incidents
 * Créer un incident. Direction et CDS uniquement.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const resolved = await resolveCodeToStructure(code);
  if (!resolved || !['direction', 'cds'].includes(resolved.role)) {
    return NextResponse.json({ error: 'Accès réservé à la direction et au CDS.' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const { inscription_id, category, severity, description } = body;

  if (!inscription_id || typeof inscription_id !== 'string') {
    return NextResponse.json({ error: 'inscription_id requis.' }, { status: 400 });
  }
  if (!category || !VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
    return NextResponse.json({ error: `Catégorie invalide. Valeurs : ${VALID_CATEGORIES.join(', ')}` }, { status: 400 });
  }
  if (!severity || !VALID_SEVERITIES.includes(severity as typeof VALID_SEVERITIES[number])) {
    return NextResponse.json({ error: `Gravité invalide. Valeurs : ${VALID_SEVERITIES.join(', ')}` }, { status: 400 });
  }
  if (!description || typeof description !== 'string' || description.trim().length < 5) {
    return NextResponse.json({ error: 'Description requise (min 5 caractères).' }, { status: 400 });
  }

  const supabase = getSupabase();
  const structureId = resolved.structure.id as string;

  // Vérifier que l'inscription appartient à cette structure
  const { data: insc } = await supabase
    .from('gd_inscriptions')
    .select('id')
    .eq('id', inscription_id)
    .eq('structure_id', structureId)
    .single();

  if (!insc) {
    return NextResponse.json({ error: 'Inscription introuvable dans cette structure.' }, { status: 404 });
  }

  const { data: incident, error: insertError } = await supabase
    .from('gd_incidents')
    .insert({
      structure_id: structureId,
      inscription_id,
      category,
      severity,
      description: description.trim(),
      created_by: resolved.email || 'unknown',
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[incidents POST] error:', insertError.message);
    return NextResponse.json({ error: 'Erreur création incident.' }, { status: 500 });
  }

  await auditLog(supabase, {
    action: 'create',
    resourceType: 'structure',
    resourceId: incident.id,
    inscriptionId: inscription_id as string,
    actorType: 'referent',
    actorId: resolved.email || undefined,
    metadata: { type: 'incident_created', category, severity, role: resolved.role },
  });

  // TODO: email notification si gravité >= attention (Sprint B phase 2)

  return NextResponse.json({ ok: true, id: incident.id }, { status: 201 });
}
