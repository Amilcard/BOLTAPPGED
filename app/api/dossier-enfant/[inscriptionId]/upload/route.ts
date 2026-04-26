export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { verifyOwnership } from '@/lib/verify-ownership';
import { auditLog, getClientIp } from '@/lib/audit-log';
import { validateUploadSize } from '@/lib/validators';
import { captureServerException } from '@/lib/sentry-capture';
const ALLOWED_TYPES = [
  'vaccins', 'ordonnance', 'pass_nautique', 'certificat_plongee',
  'certificat_medical', 'attestation_assurance', 'signature_parentale',
  'bulletin_signe', 'sanitaire_signe', 'liaison_signe',
  'autre',
] as const;
const MAX_SIZE = 5 * 1024 * 1024; // 5 Mo

// Types de PDF signés physiquement → colonne completed correspondante
const SIGNED_TO_COMPLETED: Record<string, string> = {
  bulletin_signe: 'bulletin_completed',
  sanitaire_signe: 'sanitaire_completed',
  liaison_signe: 'liaison_completed',
};

/**
 * POST /api/dossier-enfant/[inscriptionId]/upload
 * Upload un document joint (multipart/form-data)
 * Fields: token, type (vaccins|ordonnance|...), file
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ inscriptionId: string }> }
) {
  try {
    const { inscriptionId } = await params;

    const formData = await req.formData();
    const token = formData.get('token') as string;
    const docType = formData.get('type') as string;
    const file = formData.get('file') as File | null;

    // Validation — avant toute initialisation Supabase
    if (!token || !inscriptionId) {
      return NextResponse.json({ error: 'Token et inscriptionId requis.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    if (!docType || !ALLOWED_TYPES.includes(docType as typeof ALLOWED_TYPES[number])) {
      return NextResponse.json({ error: `Type invalide. Types acceptes: ${ALLOWED_TYPES.join(', ')}` }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: 'Fichier manquant.' }, { status: 400 });
    }

    // Validator centralisé — cap taille + type numérique (remplace check inline).
    const sizeCheck = validateUploadSize(file, { max: MAX_SIZE });
    if (!sizeCheck.ok) {
      const msg = sizeCheck.reason === 'too_large'
        ? `Fichier trop volumineux (max ${Math.round(MAX_SIZE / 1024 / 1024)} Mo).`
        : 'Fichier invalide.';
      const status = sizeCheck.reason === 'too_large' ? 413 : 400;
      return NextResponse.json({ error: msg }, { status });
    }

    const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
    const ALLOWED_EXT = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp']);
    const fileExt = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_MIME.has(file.type) || !ALLOWED_EXT.has(fileExt)) {
      return NextResponse.json({ error: 'Type de fichier non autorisé.' }, { status: 400 });
    }

    // Validation magic bytes — vérifie le contenu réel du fichier, pas le MIME déclaré
    const fileBuffer = await file.arrayBuffer();
    const header = new Uint8Array(fileBuffer.slice(0, 12));
    const detectedType = detectMimeFromMagic(header);
    if (!detectedType || !ALLOWED_MIME.has(detectedType)) {
      return NextResponse.json({ error: 'Le contenu du fichier ne correspond pas à un type autorisé (PDF, JPEG, PNG, WebP).' }, { status: 400 });
    }

    // Verifier ownership via token
    const ownership = await verifyOwnership(supabase, token, inscriptionId);
    if (!ownership.ok) {
      return NextResponse.json({ error: { code: ownership.code, message: ownership.message } }, { status: ownership.status });
    }

    // Generer le path de stockage
    const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    const timestamp = Date.now();
    const storagePath = `${inscriptionId}/${docType}_${timestamp}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('dossier-documents')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: 'Erreur lors de l\'upload du fichier.' }, { status: 500 });
    }

    // Mettre a jour documents_joints dans gd_dossier_enfant
    // D'abord verifier si le dossier existe
    const { data: dossier } = await supabase
      .from('gd_dossier_enfant')
      .select('id, documents_joints')
      .eq('inscription_id', inscriptionId)
      .single();

    const newDoc = {
      type: docType,
      filename: file.name,
      storage_path: storagePath,
      uploaded_at: new Date().toISOString(),
      size: file.size,
    };

    if (dossier) {
      // Dossier existe : ajouter au tableau
      const existingDocs = Array.isArray(dossier.documents_joints) ? dossier.documents_joints : [];
      // Remplacer si meme type existe deja (sauf "autre" qui peut avoir plusieurs)
      let updatedDocs;
      if (docType === 'autre') {
        updatedDocs = [...existingDocs, newDoc];
      } else {
        updatedDocs = existingDocs.filter((d: { type?: string }) => d.type !== docType);
        updatedDocs.push(newDoc);
      }

      const { error: updateError } = await supabase
        .from('gd_dossier_enfant')
        .update({ documents_joints: updatedDocs })
        .eq('id', dossier.id);

      if (updateError) {
        // Rollback storage : DB a échoué, supprimer le fichier uploadé
        await supabase.storage.from('dossier-documents').remove([storagePath]);
        throw updateError;
      }

      // Si PDF signé physiquement → marquer le bloc comme complété
      if (SIGNED_TO_COMPLETED[docType]) {
        await supabase
          .from('gd_dossier_enfant')
          .update({ [SIGNED_TO_COMPLETED[docType]]: true })
          .eq('id', dossier.id);
      }
    } else {
      // Dossier n'existe pas encore : le creer avec le document
      // Initialiser renseignements_required depuis gd_stays.documents_requis
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

      const { data: newDossier, error: insertError } = await supabase
        .from('gd_dossier_enfant')
        .insert({
          inscription_id: inscriptionId,
          documents_joints: [newDoc],
          renseignements_required: renseignementsRequired,
        })
        .select('id')
        .single();

      if (insertError) {
        await supabase.storage.from('dossier-documents').remove([storagePath]);
        throw insertError;
      }

      if (!newDossier) {
        // Ne devrait pas arriver avec service-role, mais guard explicite
        await supabase.storage.from('dossier-documents').remove([storagePath]);
        throw new Error('Dossier créé mais ID non retourné — impossible de marquer le bloc comme complété.');
      }

      // Si PDF signé physiquement → marquer le bloc comme complété
      if (SIGNED_TO_COMPLETED[docType]) {
        await supabase
          .from('gd_dossier_enfant')
          .update({ [SIGNED_TO_COMPLETED[docType]]: true })
          .eq('id', newDossier.id);
      }
    }

    // Audit log : upload document (RGPD Art. 9)
    await auditLog(supabase, {
      action: 'upload',
      resourceType: 'document',
      resourceId: storagePath,
      inscriptionId,
      actorType: 'referent',
      actorId: ownership.ok ? (ownership as { referentEmail: string }).referentEmail : undefined,
      ipAddress: getClientIp(req),
      metadata: { docType, filename: file.name, size: file.size },
    });

    // Bucket privé → signed URL temporaire (1h) au lieu de getPublicUrl (retournerait 403)
    const { data: signedData } = await supabase.storage
      .from('dossier-documents')
      .createSignedUrl(storagePath, 3600);

    return NextResponse.json({
      success: true,
      document: { ...newDoc, url: signedData?.signedUrl ?? null },
    }, { status: 201 });
  } catch (error: unknown) {
    captureServerException(error, { domain: 'upload', operation: 'dossier_upload_post' });
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Erreur serveur lors de l\'upload.' }, { status: 500 });
  }
}

/**
 * GET /api/dossier-enfant/[inscriptionId]/upload?token=xxx
 * Liste les documents joints
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ inscriptionId: string }> }
) {
  try {
    const { inscriptionId } = await params;
    const token = req.nextUrl.searchParams.get('token');

    if (!token || !inscriptionId) {
      return NextResponse.json({ error: 'Parametres manquants.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const ownership = await verifyOwnership(supabase, token, inscriptionId);
    if (!ownership.ok) {
      return NextResponse.json({ error: { code: ownership.code, message: ownership.message } }, { status: ownership.status });
    }

    const { data: dossier } = await supabase
      .from('gd_dossier_enfant')
      .select('documents_joints')
      .eq('inscription_id', inscriptionId)
      .single();

    const docs = dossier?.documents_joints || [];

    return NextResponse.json({ documents: Array.isArray(docs) ? docs : [] });
  } catch (error: unknown) {
    captureServerException(error, { domain: 'upload', operation: 'dossier_upload_get' });
    console.error('Upload route error:', error);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}

/**
 * DELETE /api/dossier-enfant/[inscriptionId]/upload
 * Supprimer un document joint
 * Body: { token, storage_path }
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ inscriptionId: string }> }
) {
  try {
    const { inscriptionId } = await params;
    const { token, storage_path } = await req.json();

    if (!token || !inscriptionId || !storage_path) {
      return NextResponse.json({ error: 'Parametres manquants.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const ownership = await verifyOwnership(supabase, token, inscriptionId);
    if (!ownership.ok) {
      return NextResponse.json({ error: { code: ownership.code, message: ownership.message } }, { status: ownership.status });
    }

    // Garde IDOR : vérifier que le chemin appartient bien à cette inscription
    if (!storage_path.startsWith(`${inscriptionId}/`)) {
      return NextResponse.json({ error: 'Chemin non autorisé.' }, { status: 403 });
    }

    // Mettre à jour documents_joints EN PREMIER (si DB échoue, le fichier reste intact)
    const { data: dossier } = await supabase
      .from('gd_dossier_enfant')
      .select('id, documents_joints')
      .eq('inscription_id', inscriptionId)
      .single();

    if (dossier) {
      const docs = Array.isArray(dossier.documents_joints) ? dossier.documents_joints : [];
      const updatedDocs = docs.filter((d: { storage_path?: string }) => d.storage_path !== storage_path);

      const { error: updateError } = await supabase
        .from('gd_dossier_enfant')
        .update({ documents_joints: updatedDocs })
        .eq('id', dossier.id);

      if (updateError) throw updateError;
    }

    // Supprimer du storage seulement après succès DB
    await supabase.storage.from('dossier-documents').remove([storage_path]);

    // Audit log : suppression document (RGPD)
    await auditLog(supabase, {
      action: 'delete',
      resourceType: 'document',
      resourceId: storage_path,
      inscriptionId,
      actorType: 'referent',
      actorId: ownership.ok ? (ownership as { referentEmail: string }).referentEmail : undefined,
      ipAddress: getClientIp(req),
      metadata: { storage_path },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    captureServerException(error, { domain: 'upload', operation: 'dossier_upload_delete' });
    console.error('Upload route error:', error);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}

// verifyOwnership importé depuis @/lib/verify-ownership (centralisé RGPD)

/**
 * Détecte le MIME réel d'un fichier via ses magic bytes (premiers octets).
 * Empêche l'upload d'exécutables avec un MIME spoofé.
 */
function detectMimeFromMagic(header: Uint8Array): string | null {
  // PDF: %PDF
  if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) {
    return 'application/pdf';
  }
  // JPEG: FF D8 FF
  if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
    return 'image/png';
  }
  // WebP: RIFF....WEBP
  if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46
    && header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50) {
    return 'image/webp';
  }
  return null;
}
