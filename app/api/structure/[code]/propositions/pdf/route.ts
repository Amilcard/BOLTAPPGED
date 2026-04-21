export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireStructureRole } from '@/lib/structure-guard';
import { generatePropositionPdf } from '@/lib/pdf-proposition';
import { auditLog, getClientIp } from '@/lib/audit-log';
import { structureRateLimitGuard } from '@/lib/rate-limit-structure';
import { UUID_RE } from '@/lib/validators';

/**
 * GET /api/structure/[code]/propositions/pdf?id=UUID
 * Télécharge le PDF d'une proposition (scope strict par structure).
 * Régénère à la volée (pattern iso admin).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const rateLimited = await structureRateLimitGuard(req);
  if (rateLimited) return rateLimited;

  const { code } = await params;
  const guard = await requireStructureRole(req, code, { excludeRoles: [] });
  if (!guard.ok) return guard.response;
  const resolved = guard.resolved;

  const id = req.nextUrl.searchParams.get('id');
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: { code: 'INVALID_ID', message: 'ID invalide.' } }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const structureId = resolved.structure.id as string;

  const { data: prop } = await supabase
    .from('gd_propositions_tarifaires')
    .select('*')
    .eq('id', id)
    .single();

  if (!prop) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Proposition introuvable.' } }, { status: 404 });
  }

  // ── Vérification ownership : proposition doit appartenir à la structure ──
  const p = prop as Record<string, unknown>;
  const demandeurEmail = (p.demandeur_email as string | null)?.toLowerCase() ?? null;
  const inscriptionId = p.inscription_id as string | null;

  let ownershipOk = false;

  // Via inscription_id → structure_id
  if (inscriptionId) {
    const { data: insc } = await supabase
      .from('gd_inscriptions')
      .select('structure_id, referent_email')
      .eq('id', inscriptionId)
      .single();
    if (insc && (insc as { structure_id?: string }).structure_id === structureId) {
      // Éducateur : limiter à ses propres inscriptions
      if (resolved.role === 'educateur') {
        if ((insc as { referent_email?: string }).referent_email?.toLowerCase() === resolved.email?.toLowerCase()) {
          ownershipOk = true;
        }
      } else {
        ownershipOk = true;
      }
    }
  }

  // Via demandeur_email ∈ emails structure
  if (!ownershipOk && demandeurEmail) {
    if (resolved.role === 'educateur') {
      if (demandeurEmail === resolved.email?.toLowerCase()) ownershipOk = true;
    } else {
      const { data: codes } = await supabase
        .from('gd_structure_access_codes')
        .select('email')
        .eq('structure_id', structureId)
        .eq('active', true);
      const emails = new Set<string>();
      for (const c of codes ?? []) {
        const e = (c as { email?: string | null }).email;
        if (e) emails.add(e.toLowerCase());
      }
      // Referent inscriptions structure
      const { data: inscList } = await supabase
        .from('gd_inscriptions')
        .select('referent_email')
        .eq('structure_id', structureId);
      for (const i of inscList ?? []) {
        const e = (i as { referent_email?: string | null }).referent_email;
        if (e) emails.add(e.toLowerCase());
      }
      if (emails.has(demandeurEmail)) ownershipOk = true;
    }
  }

  if (!ownershipOk) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Proposition hors périmètre.' } },
      { status: 403 }
    );
  }

  await auditLog(supabase, {
    action: 'download',
    resourceType: 'proposition',
    resourceId: id,
    actorType: 'staff',
    actorId: resolved.email || undefined,
    ipAddress: getClientIp(req),
    metadata: { context: 'structure_proposition_pdf', role: resolved.role },
  });

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await generatePropositionPdf(p);
  } catch (err) {
    console.error('[propositions PDF] generation failed:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json(
      { error: { code: 'PDF_ERROR', message: 'Erreur génération PDF.' } },
      { status: 500 }
    );
  }

  const enfantNom = String(p.enfant_nom ?? '').replace(/[^\w\s-]/g, '') || 'inconnu';
  const enfantPrenom = String(p.enfant_prenom ?? '').replace(/[^\w\s-]/g, '') || 'inconnu';
  const filename = `Proposition_${enfantNom}_${enfantPrenom}.pdf`;

  // NextResponse accepte BodyInit ; Uint8Array est compatible.
  return new NextResponse(pdfBytes as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  });
}
