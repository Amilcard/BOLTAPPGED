export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireStructureRole } from '@/lib/structure-guard';
import { requireInscriptionInStructure } from '@/lib/resource-guard';
import { auditLog, getClientIp } from '@/lib/audit-log';
import { structureRateLimitGuard } from '@/lib/rate-limit-structure';
import { UUID_RE } from '@/lib/validators';
import {
  ALLOWED_DOC_TYPES,
  validateUploadedDocument,
  attachDocToDossier,
  detachDocFromDossier,
  type DocType,
} from '@/lib/dossier-upload';

/**
 * POST /api/structure/[code]/inscriptions/[id]/upload
 *
 * Upload staff d'un document joint (multipart/form-data).
 * Miroir de `/api/dossier-enfant/[id]/upload` avec auth JWT session structure.
 *
 * FormData : { type (docType), file }
 *   - token NON requis — auth par cookie session
 *
 * Décision produit 2026-04-19 : staff = mandataire légitime, peut uploader
 * des PJ (certificat médical, pass nautique, etc.) quand le référent est
 * absent.
 *
 * Helper `lib/dossier-upload.ts` extrait pour mutualiser magic bytes +
 * rollback storage + flagging SIGNED_TO_COMPLETED. Route référent conservée
 * inline (non régression P1 critique).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string; id: string }> },
) {
  try {
    const rateLimited = await structureRateLimitGuard(req);
    if (rateLimited) return rateLimited;

    const { code, id: inscriptionId } = await params;

    if (!UUID_RE.test(inscriptionId)) {
      return NextResponse.json(
        { error: { code: 'INVALID_ID', message: "ID inscription invalide." } },
        { status: 400 },
      );
    }

    const guard = await requireStructureRole(req, code, {
      allowRoles: ['secretariat', 'direction', 'cds', 'cds_delegated'],
      forbiddenMessage: 'Accès réservé au staff structure.',
    });
    if (!guard.ok) return guard.response;
    const resolved = guard.resolved;

    const formData = await req.formData();
    const docType = formData.get('type') as string;
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Fichier manquant.' }, { status: 400 });
    }

    if (!docType || !ALLOWED_DOC_TYPES.includes(docType as DocType)) {
      return NextResponse.json(
        { error: `Type invalide. Types acceptés : ${ALLOWED_DOC_TYPES.join(', ')}` },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const structureId = resolved.structure.id as string;

    const ownership = await requireInscriptionInStructure({
      supabase,
      inscriptionId,
      structureId,
    });
    if (!ownership.ok) return ownership.response;

    const buffer = await file.arrayBuffer();

    const validation = validateUploadedDocument({ file, docType, buffer });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    const timestamp = Date.now();
    const storagePath = `${inscriptionId}/${docType}_${timestamp}.${ext}`;

    const attach = await attachDocToDossier({
      supabase,
      inscriptionId,
      docType: docType as DocType,
      file,
      buffer,
      storagePath,
    });

    // AuditLog RGPD Art.9 — upload par staff (pas référent)
    await auditLog(supabase, {
      action: 'upload',
      resourceType: 'document',
      resourceId: storagePath,
      inscriptionId,
      actorType: 'staff',
      actorId: resolved.email || undefined,
      ipAddress: getClientIp(req),
      metadata: {
        docType,
        filename: file.name,
        size: file.size,
        context: 'staff_upload_doc',
        actor_role: resolved.role,
      },
    });

    // Signed URL 1h (bucket privé)
    const { data: signedData } = await supabase.storage
      .from('dossier-documents')
      .createSignedUrl(storagePath, 3600);

    return NextResponse.json(
      {
        success: true,
        document: { ...attach.newDoc, url: signedData?.signedUrl ?? null },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('POST /api/structure/[code]/inscriptions/[id]/upload error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: "Erreur serveur lors de l'upload." } },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/structure/[code]/inscriptions/[id]/upload
 *
 * Supprime une pièce jointe. Body : { storage_path }.
 * Même auth/ownership que POST. Guard IDOR : storage_path doit commencer
 * par inscriptionId.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ code: string; id: string }> },
) {
  try {
    const rateLimited = await structureRateLimitGuard(req);
    if (rateLimited) return rateLimited;

    const { code, id: inscriptionId } = await params;

    if (!UUID_RE.test(inscriptionId)) {
      return NextResponse.json(
        { error: { code: 'INVALID_ID', message: "ID inscription invalide." } },
        { status: 400 },
      );
    }

    const guard = await requireStructureRole(req, code, {
      allowRoles: ['secretariat', 'direction', 'cds', 'cds_delegated'],
      forbiddenMessage: 'Accès réservé au staff structure.',
    });
    if (!guard.ok) return guard.response;
    const resolved = guard.resolved;

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
    }

    const storagePath = typeof body.storage_path === 'string' ? body.storage_path : '';
    if (!storagePath) {
      return NextResponse.json({ error: 'storage_path requis.' }, { status: 400 });
    }

    // Guard IDOR strict : le path doit appartenir à cette inscription
    if (!storagePath.startsWith(`${inscriptionId}/`)) {
      return NextResponse.json({ error: 'Chemin non autorisé.' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const structureId = resolved.structure.id as string;

    const ownership = await requireInscriptionInStructure({
      supabase,
      inscriptionId,
      structureId,
    });
    if (!ownership.ok) return ownership.response;

    await detachDocFromDossier({ supabase, inscriptionId, storagePath });

    await auditLog(supabase, {
      action: 'delete',
      resourceType: 'document',
      resourceId: storagePath,
      inscriptionId,
      actorType: 'staff',
      actorId: resolved.email || undefined,
      ipAddress: getClientIp(req),
      metadata: {
        storage_path: storagePath,
        context: 'staff_delete_doc',
        actor_role: resolved.role,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/structure/[code]/inscriptions/[id]/upload error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 },
    );
  }
}
