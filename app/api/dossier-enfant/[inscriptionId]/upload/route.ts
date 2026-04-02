export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
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
    const supabase = getSupabase();

    const formData = await req.formData();
    const token = formData.get('token') as string;
    const docType = formData.get('type') as string;
    const file = formData.get('file') as File | null;

    // Validation
    if (!token || !inscriptionId) {
      return NextResponse.json({ error: 'Token et inscriptionId requis.' }, { status: 400 });
    }

    if (!docType || !ALLOWED_TYPES.includes(docType as typeof ALLOWED_TYPES[number])) {
      return NextResponse.json({ error: `Type invalide. Types acceptes: ${ALLOWED_TYPES.join(', ')}` }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: 'Fichier manquant.' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 5 Mo).' }, { status: 400 });
    }

    const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
    const ALLOWED_EXT = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp']);
    const fileExt = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_MIME.has(file.type) || !ALLOWED_EXT.has(fileExt)) {
      return NextResponse.json({ error: 'Type de fichier non autorisé.' }, { status: 400 });
    }

    // Verifier ownership via token
    const ownership = await verifyOwnership(supabase, token, inscriptionId);
    if (!ownership.ok) {
      return NextResponse.json({ error: ownership.message }, { status: ownership.status });
    }

    // Generer le path de stockage
    const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    const timestamp = Date.now();
    const storagePath = `${inscriptionId}/${docType}_${timestamp}.${ext}`;

    // Upload vers Supabase Storage
    const fileBuffer = await file.arrayBuffer();
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
      const { data: newDossier, error: insertError } = await supabase
        .from('gd_dossier_enfant')
        .insert({
          inscription_id: inscriptionId,
          documents_joints: [newDoc],
        })
        .select('id')
        .single();

      if (insertError) {
        await supabase.storage.from('dossier-documents').remove([storagePath]);
        throw insertError;
      }

      // Si PDF signé physiquement → marquer le bloc comme complété
      if (SIGNED_TO_COMPLETED[docType] && newDossier) {
        await supabase
          .from('gd_dossier_enfant')
          .update({ [SIGNED_TO_COMPLETED[docType]]: true })
          .eq('id', newDossier.id);
      }
    }

    const { data: { publicUrl } } = supabase.storage
      .from('dossier-documents')
      .getPublicUrl(storagePath);

    return NextResponse.json({
      success: true,
      document: { ...newDoc, url: publicUrl },
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('Upload error:', error);
    const message = error instanceof Error ? error.message : 'Erreur serveur.';
    return NextResponse.json({ error: message }, { status: 500 });
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

    const supabase = getSupabase();
    const ownership = await verifyOwnership(supabase, token, inscriptionId);
    if (!ownership.ok) {
      return NextResponse.json({ error: ownership.message }, { status: ownership.status });
    }

    const { data: dossier } = await supabase
      .from('gd_dossier_enfant')
      .select('documents_joints')
      .eq('inscription_id', inscriptionId)
      .single();

    const docs = dossier?.documents_joints || [];

    return NextResponse.json({ documents: Array.isArray(docs) ? docs : [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
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

    const supabase = getSupabase();
    const ownership = await verifyOwnership(supabase, token, inscriptionId);
    if (!ownership.ok) {
      return NextResponse.json({ error: ownership.message }, { status: ownership.status });
    }

    // Garde IDOR : vérifier que le chemin appartient bien à cette inscription
    if (!storage_path.startsWith(`${inscriptionId}/`)) {
      return NextResponse.json({ error: 'Chemin non autorisé.' }, { status: 403 });
    }

    // Supprimer du storage
    await supabase.storage.from('dossier-documents').remove([storage_path]);

    // Mettre a jour documents_joints
    const { data: dossier } = await supabase
      .from('gd_dossier_enfant')
      .select('id, documents_joints')
      .eq('inscription_id', inscriptionId)
      .single();

    if (dossier) {
      const docs = Array.isArray(dossier.documents_joints) ? dossier.documents_joints : [];
      const updatedDocs = docs.filter((d: { storage_path?: string }) => d.storage_path !== storage_path);

      await supabase
        .from('gd_dossier_enfant')
        .update({ documents_joints: updatedDocs })
        .eq('id', dossier.id);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---- Helpers ----

async function verifyOwnership(
  supabase: ReturnType<typeof getSupabase>,
  token: string,
  inscriptionId: string
): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(token)) return { ok: false, message: 'Token invalide.', status: 400 };
  if (!uuidRegex.test(inscriptionId)) return { ok: false, message: 'ID invalide.', status: 400 };

  const { data: source } = await supabase
    .from('gd_inscriptions')
    .select('referent_email')
    .eq('suivi_token', token)
    .single();

  if (!source) return { ok: false, message: 'Token non trouve.', status: 404 };

  const { data: target } = await supabase
    .from('gd_inscriptions')
    .select('referent_email')
    .eq('id', inscriptionId)
    .single();

  if (!target || target.referent_email !== source.referent_email) {
    return { ok: false, message: 'Acces non autorise.', status: 403 };
  }

  return { ok: true };
}
