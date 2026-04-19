/**
 * lib/dossier-upload.ts
 *
 * Helpers partagés pour l'upload de pièces jointes au dossier enfant.
 * Centralise : whitelist types/MIME/extensions, magic bytes detection,
 * append-to-dossier avec rollback storage atomique.
 *
 * Utilisé par :
 *   - `POST /api/structure/[code]/inscriptions/[id]/upload` (staff)
 *   - `DELETE /api/structure/[code]/inscriptions/[id]/upload` (staff)
 *
 * La route référent historique `/api/dossier-enfant/[id]/upload` conserve
 * sa logique inline pour éviter toute régression sur un parcours critique
 * (P1 protection CLAUDE.md). Migration optionnelle en PR dédiée.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Types de documents acceptés comme pièces jointes au dossier.
 * Certains (bulletin_signe, sanitaire_signe, liaison_signe) ferment
 * automatiquement leur bloc *_completed côté DB via SIGNED_TO_COMPLETED.
 */
export const ALLOWED_DOC_TYPES = [
  'vaccins', 'ordonnance', 'pass_nautique', 'certificat_plongee',
  'certificat_medical', 'attestation_assurance', 'signature_parentale',
  'bulletin_signe', 'sanitaire_signe', 'liaison_signe',
  'autre',
] as const;
export type DocType = typeof ALLOWED_DOC_TYPES[number];

/**
 * Mapping docType "signé physiquement" → colonne *_completed à flaguer.
 * Quand un PDF signé est uploadé, le bloc correspondant passe automatiquement
 * en completed=true (le référent a signé physiquement).
 */
export const SIGNED_TO_COMPLETED: Record<string, string> = {
  bulletin_signe: 'bulletin_completed',
  sanitaire_signe: 'sanitaire_completed',
  liaison_signe: 'liaison_completed',
};

/** Cap taille fichier — 5 MB. Identique à la route référent historique. */
export const UPLOAD_MAX_SIZE = 5 * 1024 * 1024;

export const ALLOWED_MIME_SET = new Set([
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
]);
export const ALLOWED_EXT_SET = new Set([
  'pdf', 'jpg', 'jpeg', 'png', 'webp',
]);

/**
 * Détecte le MIME réel d'un fichier via ses magic bytes (premiers octets).
 * Empêche l'upload d'exécutables avec un MIME déclaré spoofé.
 */
export function detectMimeFromMagic(header: Uint8Array): string | null {
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
  // WebP: RIFF ... WEBP
  if (
    header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
    header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

export interface ValidateFileInput {
  file: File;
  docType: string;
  buffer: ArrayBuffer;
}

export type ValidationResult =
  | { ok: true; detectedMime: string }
  | { ok: false; status: number; error: string };

/**
 * Validation complète d'un fichier uploadé :
 *  - docType dans la whitelist
 *  - taille ≤ UPLOAD_MAX_SIZE
 *  - extension + MIME déclaré dans les whitelists
 *  - magic bytes correspondent à un MIME autorisé
 *
 * Retour : { ok: true, detectedMime } ou { ok: false, status, error }.
 */
export function validateUploadedDocument(input: ValidateFileInput): ValidationResult {
  const { file, docType, buffer } = input;

  if (!ALLOWED_DOC_TYPES.includes(docType as DocType)) {
    return { ok: false, status: 400, error: `Type invalide. Types acceptés : ${ALLOWED_DOC_TYPES.join(', ')}` };
  }

  if (!file || typeof file.size !== 'number') {
    return { ok: false, status: 400, error: 'Fichier invalide.' };
  }
  if (file.size > UPLOAD_MAX_SIZE) {
    return {
      ok: false,
      status: 413,
      error: `Fichier trop volumineux (max ${Math.round(UPLOAD_MAX_SIZE / 1024 / 1024)} Mo).`,
    };
  }

  const fileExt = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_MIME_SET.has(file.type) || !ALLOWED_EXT_SET.has(fileExt)) {
    return { ok: false, status: 400, error: 'Type de fichier non autorisé.' };
  }

  const header = new Uint8Array(buffer.slice(0, 12));
  const detected = detectMimeFromMagic(header);
  if (!detected || !ALLOWED_MIME_SET.has(detected)) {
    return {
      ok: false,
      status: 400,
      error: 'Le contenu du fichier ne correspond pas à un type autorisé (PDF, JPEG, PNG, WebP).',
    };
  }

  return { ok: true, detectedMime: detected };
}

export interface AttachDocInput {
  supabase: SupabaseClient;
  inscriptionId: string;
  docType: DocType;
  file: File;
  buffer: ArrayBuffer;
  storagePath: string;
}

export interface AttachDocResult {
  ok: true;
  newDoc: {
    type: string;
    filename: string;
    storage_path: string;
    uploaded_at: string;
    size: number;
  };
}

/**
 * Uploade le fichier au Storage Supabase puis ajoute l'entrée correspondante
 * dans `gd_dossier_enfant.documents_joints`. Gère :
 *  - création du dossier s'il n'existe pas (+ init `renseignements_required`)
 *  - rollback storage si UPDATE/INSERT DB échoue
 *  - flagging auto `*_completed` pour les types "signé physiquement"
 *  - remplacement si même docType (sauf 'autre' qui peut cohabiter)
 *
 * Retour : { ok: true, newDoc } ou throw Error (caller gère try/catch).
 */
export async function attachDocToDossier(input: AttachDocInput): Promise<AttachDocResult> {
  const { supabase, inscriptionId, docType, file, buffer, storagePath } = input;

  // 1. Upload storage
  const { error: uploadError } = await supabase.storage
    .from('dossier-documents')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Storage upload: ${uploadError.message}`);
  }

  const newDoc = {
    type: docType,
    filename: file.name,
    storage_path: storagePath,
    uploaded_at: new Date().toISOString(),
    size: file.size,
  };

  // 2. Update ou insert gd_dossier_enfant.documents_joints
  const { data: dossier } = await supabase
    .from('gd_dossier_enfant')
    .select('id, documents_joints')
    .eq('inscription_id', inscriptionId)
    .single();

  try {
    if (dossier) {
      const existingDocs = Array.isArray(dossier.documents_joints) ? dossier.documents_joints : [];
      const updatedDocs = docType === 'autre'
        ? [...existingDocs, newDoc]
        : [...existingDocs.filter((d: { type?: string }) => d.type !== docType), newDoc];

      const { error: updErr } = await supabase
        .from('gd_dossier_enfant')
        .update({ documents_joints: updatedDocs })
        .eq('id', dossier.id);
      if (updErr) throw updErr;

      if (SIGNED_TO_COMPLETED[docType]) {
        await supabase
          .from('gd_dossier_enfant')
          .update({ [SIGNED_TO_COMPLETED[docType]]: true })
          .eq('id', dossier.id);
      }
    } else {
      // Créer le dossier avec ce doc + init renseignements_required
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

      const { data: newDossier, error: insErr } = await supabase
        .from('gd_dossier_enfant')
        .insert({
          inscription_id: inscriptionId,
          documents_joints: [newDoc],
          renseignements_required: renseignementsRequired,
        })
        .select('id')
        .single();
      if (insErr) throw insErr;
      if (!newDossier) throw new Error('Dossier créé mais ID non retourné');

      if (SIGNED_TO_COMPLETED[docType]) {
        await supabase
          .from('gd_dossier_enfant')
          .update({ [SIGNED_TO_COMPLETED[docType]]: true })
          .eq('id', newDossier.id);
      }
    }
  } catch (dbErr) {
    // Rollback storage — le fichier a été uploadé mais la DB a refusé.
    await supabase.storage.from('dossier-documents').remove([storagePath]);
    throw dbErr;
  }

  return { ok: true, newDoc };
}

/**
 * Supprime un document joint : filtre dans documents_joints puis delete storage.
 * Garde IDOR : le caller DOIT vérifier `storage_path.startsWith(inscriptionId + '/')`.
 */
export async function detachDocFromDossier(params: {
  supabase: SupabaseClient;
  inscriptionId: string;
  storagePath: string;
}): Promise<void> {
  const { supabase, inscriptionId, storagePath } = params;

  const { data: dossier } = await supabase
    .from('gd_dossier_enfant')
    .select('id, documents_joints')
    .eq('inscription_id', inscriptionId)
    .single();

  if (dossier) {
    const docs = Array.isArray(dossier.documents_joints) ? dossier.documents_joints : [];
    const updatedDocs = docs.filter((d: { storage_path?: string }) => d.storage_path !== storagePath);

    const { error: updErr } = await supabase
      .from('gd_dossier_enfant')
      .update({ documents_joints: updatedDocs })
      .eq('id', dossier.id);
    if (updErr) throw updErr;
  }

  // Storage delete après succès DB (évite perdre le fichier si DB throw)
  await supabase.storage.from('dossier-documents').remove([storagePath]);
}
