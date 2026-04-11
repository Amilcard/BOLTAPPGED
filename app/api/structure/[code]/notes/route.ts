export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { resolveCodeToStructure } from '@/lib/structure';
import { auditLog } from '@/lib/audit-log';

/**
 * GET /api/structure/[code]/notes
 * Liste les notes par enfant. Tous les rôles sauf secrétariat.
 * Éducateur : lecture seule.
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
    .from('gd_notes')
    .select('id, inscription_id, content, created_by, created_at')
    .eq('structure_id', structureId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[notes GET] error:', error.message);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }

  await auditLog(supabase, {
    action: 'read',
    resourceType: 'inscription',
    resourceId: structureId,
    actorType: 'referent',
    actorId: resolved.email || undefined,
    metadata: { type: 'notes_read', role: resolved.role, count: data?.length ?? 0 },
  });

  return NextResponse.json({ notes: data ?? [] });
}

/**
 * POST /api/structure/[code]/notes
 * Ajouter une note sur un enfant. Direction et CDS uniquement.
 * Non éditable après envoi (traçabilité RGPD).
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

  const { inscription_id, content } = body;

  if (!inscription_id || typeof inscription_id !== 'string') {
    return NextResponse.json({ error: 'inscription_id requis (note liée à un enfant).' }, { status: 400 });
  }
  if (!content || typeof content !== 'string' || content.trim().length < 5) {
    return NextResponse.json({ error: 'Contenu requis (min 5 caractères).' }, { status: 400 });
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

  const { data: note, error: insertError } = await supabase
    .from('gd_notes')
    .insert({
      structure_id: structureId,
      inscription_id,
      content: content.trim(),
      created_by: resolved.email || 'unknown',
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[notes POST] error:', insertError.message);
    return NextResponse.json({ error: 'Erreur création note.' }, { status: 500 });
  }

  await auditLog(supabase, {
    action: 'create',
    resourceType: 'inscription',
    resourceId: note.id,
    inscriptionId: inscription_id as string,
    actorType: 'referent',
    actorId: resolved.email || undefined,
    metadata: { type: 'note_created', role: resolved.role },
  });

  return NextResponse.json({ ok: true, id: note.id }, { status: 201 });
}
