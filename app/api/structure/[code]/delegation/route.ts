export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { resolveCodeToStructure } from '@/lib/structure';
import { auditLog } from '@/lib/audit-log';

/**
 * PATCH /api/structure/[code]/delegation
 *
 * Directeur uniquement.
 * Définit ou supprime une délégation temporaire au CDS.
 *
 * Body :
 *   { from: string (ISO date), until: string (ISO date) }  → active la délégation
 *   { from: null, until: null }                            → supprime la délégation
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  if (!code || !/^[A-Z0-9]{10}$/i.test(code)) {
    return NextResponse.json(
      { error: { code: 'INVALID_CODE', message: 'Seul le directeur peut gérer les délégations.' } },
      { status: 400 }
    );
  }

  // Vérifier que le code est bien un code directeur (10 chars) et résoudre la structure
  const resolved = await resolveCodeToStructure(code);
  if (!resolved || resolved.role !== 'direction') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Accès réservé au directeur.' } },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'Corps de requête invalide.' } },
      { status: 400 }
    );
  }

  const { from, until } = body as { from: string | null; until: string | null };

  // Suppression de la délégation
  if (from === null && until === null) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('gd_structures')
      .update({ delegation_active_from: null, delegation_active_until: null })
      .eq('id', resolved.structure.id as string);

    if (error) {
      console.error('[delegation] Erreur suppression délégation:', error.message);
      return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
    }

    auditLog(supabase, {
      action: 'update',
      resourceType: 'inscription',
      resourceId: resolved.structure.id as string,
      actorType: 'referent',
      metadata: { type: 'delegation_removed', role: 'directeur' },
    });

    return NextResponse.json({ removed: true });
  }

  // Validation des dates
  if (!from || !until) {
    return NextResponse.json(
      { error: { code: 'MISSING_DATES', message: 'Les deux dates sont requises.' } },
      { status: 400 }
    );
  }

  const fromDate  = new Date(from);
  const untilDate = new Date(until);

  if (isNaN(fromDate.getTime()) || isNaN(untilDate.getTime())) {
    return NextResponse.json(
      { error: { code: 'INVALID_DATES', message: 'Format de date invalide.' } },
      { status: 400 }
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (fromDate < today) {
    return NextResponse.json(
      { error: { code: 'PAST_DATE', message: 'La date de début ne peut pas être dans le passé.' } },
      { status: 400 }
    );
  }

  if (untilDate <= fromDate) {
    return NextResponse.json(
      { error: { code: 'INVALID_RANGE', message: 'La date de fin doit être après la date de début.' } },
      { status: 400 }
    );
  }

  // Limite : délégation max 90 jours
  const diffDays = (untilDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays > 90) {
    return NextResponse.json(
      { error: { code: 'RANGE_TOO_LONG', message: 'La délégation ne peut pas dépasser 90 jours.' } },
      { status: 400 }
    );
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from('gd_structures')
    .update({
      delegation_active_from:  fromDate.toISOString(),
      delegation_active_until: untilDate.toISOString(),
    })
    .eq('id', resolved.structure.id as string);

  if (error) {
    console.error('[delegation] Erreur enregistrement délégation:', error.message);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }

  auditLog(supabase, {
    action: 'update',
    resourceType: 'inscription',
    resourceId: resolved.structure.id as string,
    actorType: 'referent',
    metadata: {
      type: 'delegation_set',
      role: 'directeur',
      from: fromDate.toISOString(),
      until: untilDate.toISOString(),
    },
  });

  return NextResponse.json({
    set: true,
    from: fromDate.toISOString(),
    until: untilDate.toISOString(),
  });
}
