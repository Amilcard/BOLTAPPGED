'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Lock, FileText, Check, X as XIcon } from 'lucide-react';
import { REQUIS_TO_JOINT, DOC_OPT_LABELS } from '@/lib/dossier-shared';

interface DocJoint {
  type: string;
  filename: string;
  storage_path: string;
  uploaded_at: string;
  size: number;
}

/**
 * Props — 2 modes :
 *  - référent (défaut) : `inscriptionId` + `token` → URLs `/api/dossier-enfant/*`, token en FormData/body
 *  - staff structure : `apiBase` fourni → URL directe (ex.
 *    `/api/structure/[code]/inscriptions/[id]/upload`), pas de token, auth par session cookie.
 */
interface Props {
  inscriptionId: string;
  token: string;
  onUploadSuccess?: () => void;
  requiredTypes?: string[]; // docs requis par le séjour (valeurs de documents_requis)
  /**
   * URL complète vers l'endpoint upload (POST/DELETE/GET). Si fourni, le
   * composant bascule en mode staff : pas de token dans FormData/body.
   * La route doit supporter POST multipart + DELETE body + GET ?token=... OU
   * mode staff en cookie.
   */
  apiBase?: string;
}

// REQUIS_TO_JOINT et DOC_OPT_LABELS importés depuis @/lib/dossier-shared

const DOC_TYPES = [
  { value: 'vaccins', label: 'Carnet de vaccination', required: true },
  { value: 'certificat_medical', label: 'Certificat medical', required: false },
  { value: 'ordonnance', label: 'Ordonnance (si traitement)', required: false },
  { value: 'attestation_assurance', label: 'Attestation d\'assurance', required: false },
  { value: 'pass_nautique', label: 'Pass nautique', required: false },
  { value: 'certificat_plongee', label: 'Certificat de plongee', required: false },
  { value: 'autre', label: 'Autre document', required: false },
] as const;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function DocumentsJointsUpload({ inscriptionId, token, onUploadSuccess, requiredTypes = [], apiBase }: Props) {
  const [documents, setDocuments] = useState<DocJoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState('vaccins');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const isStaffMode = !!apiBase;

  const loadDocuments = useCallback(async () => {
    try {
      // Mode staff : pas de GET listing sur la route structure (scope vague 3+4 limité).
      // Le Panel parent fournit `dossier.documents_joints` via useDossierEnfant GET
      // structure déjà implémenté. On skip le load ici et laisse le parent gérer
      // via reload() après chaque upload/delete.
      if (isStaffMode) {
        setLoading(false);
        return;
      }
      const res = await fetch(
        `/api/dossier-enfant/${inscriptionId}/upload?token=${token}`
      );
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [inscriptionId, token, isStaffMode]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('Veuillez selectionner un fichier.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Fichier trop volumineux (max 5 Mo).');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      // Token FormData uniquement en mode référent (staff = session cookie)
      if (!isStaffMode) formData.append('token', token);
      formData.append('type', selectedType);
      formData.append('file', file);

      const uploadUrl = apiBase || `/api/dossier-enfant/${inscriptionId}/upload`;
      const res = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erreur upload');
      }

      setSuccess('Document envoye avec succes !');
      if (fileRef.current) fileRef.current.value = '';
      void loadDocuments();
      onUploadSuccess?.();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'envoi.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: DocJoint) => {
    const docLabel = doc.filename || getTypeLabel(doc.type);
    if (!confirm(`Supprimer "${docLabel}" ?`)) return;

    try {
      const deleteUrl = apiBase || `/api/dossier-enfant/${inscriptionId}/upload`;
      const deleteBody = isStaffMode
        ? { storage_path: doc.storage_path }
        : { token, storage_path: doc.storage_path };
      const res = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deleteBody),
      });

      if (res.ok) {
        void loadDocuments();
        onUploadSuccess?.();
      }
    } catch {
      // Silently fail
    }
  };

  const getTypeLabel = (type: string) =>
    DOC_TYPES.find(d => d.value === type)?.label || type;

  const uploadedTypes = documents.map(d => d.type);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Ajoutez les pieces justificatives necessaires au dossier (PDF, JPG ou PNG, max 5 Mo).
      </p>

      {/* Zone d'upload */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none flex-shrink-0"
          >
            {DOC_TYPES.map(dt => (
              <option key={dt.value} value={dt.value}>
                {dt.label}
                {uploadedTypes.includes(dt.value) && dt.value !== 'autre' ? ' (remplacer)' : ''}
              </option>
            ))}
          </select>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-light file:text-primary hover:file:bg-brand-light/80 flex-1"
          />
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 transition disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
          >
            {uploading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Envoi...
              </>
            ) : (
              'Envoyer'
            )}
          </button>
        </div>

        <p className="text-xs text-gray-500 flex items-center gap-1 mt-2">
          <Lock className="w-3 h-3" />
          Connexion sécurisée. Formats : PDF, JPG, PNG, WebP (max 5 Mo).
        </p>

        {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</p>}
        {success && <p className="text-sm text-green-600 bg-green-50 p-2 rounded-lg">{success}</p>}
      </div>

      {/* Liste des documents */}
      {loading ? (
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-6 text-gray-400 text-sm">
          Aucune piece jointe pour le moment.
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc, i) => (
            <div
              key={doc.storage_path || i}
              className="flex items-center justify-between p-3 bg-white border rounded-lg"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-primary-300 flex-shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{getTypeLabel(doc.type)}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {doc.filename} — {formatSize(doc.size)} — {formatDate(doc.uploaded_at)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(doc)}
                className="text-gray-400 hover:text-red-500 transition flex-shrink-0 ml-2"
                title="Supprimer"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Indicateur de complétude — docs toujours requis (vaccins) */}
      <div className="text-xs text-gray-500 pt-2 border-t space-y-2">
        <div>
          {DOC_TYPES.filter(dt => dt.required).map(dt => {
            const uploaded = documents.some(d => d.type === dt.value);
            return (
              <span key={dt.value} className={`inline-flex items-center gap-1 mr-3 ${uploaded ? 'text-green-600' : 'text-gray-400'}`}>
                {uploaded ? <Check className="w-3 h-3" /> : <span className="w-3 h-3 inline-block rounded-full border border-gray-300" />} {dt.label}
              </span>
            );
          })}
        </div>

        {/* Docs requis par ce séjour spécifique */}
        {requiredTypes.length > 0 && (
          <div>
            <p className="font-medium text-gray-600 mb-1">Requis pour ce séjour :</p>
            <div className="flex flex-wrap gap-2">
              {requiredTypes.map(reqType => {
                const jointType = REQUIS_TO_JOINT[reqType] ?? reqType;
                const uploaded = documents.some(d => d.type === jointType);
                const label = DOC_OPT_LABELS[reqType] ?? reqType;
                return (
                  <span
                    key={reqType}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      uploaded ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {uploaded ? <Check className="w-3 h-3" /> : '!'} {label}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
