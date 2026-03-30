'use client';

import { useState, useEffect, useRef } from 'react';

interface DocJoint {
  type: string;
  filename: string;
  storage_path: string;
  uploaded_at: string;
  size: number;
}

interface Props {
  inscriptionId: string;
  token: string;
  onUploadSuccess?: () => void;
}

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

export function DocumentsJointsUpload({ inscriptionId, token, onUploadSuccess }: Props) {
  const [documents, setDocuments] = useState<DocJoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState('vaccins');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const loadDocuments = async () => {
    try {
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
  };

  useEffect(() => {
    void loadDocuments();
  }, [inscriptionId, token]);

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
      formData.append('token', token);
      formData.append('type', selectedType);
      formData.append('file', file);

      const res = await fetch(`/api/dossier-enfant/${inscriptionId}/upload`, {
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

  const handleDelete = async (storagePath: string) => {
    if (!confirm('Supprimer ce document ?')) return;

    try {
      const res = await fetch(`/api/dossier-enfant/${inscriptionId}/upload`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, storage_path: storagePath }),
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
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-500 outline-none flex-shrink-0"
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
            className="text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 flex-1"
          />
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
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
                <span className="text-lg flex-shrink-0">
                  {doc.type === 'vaccins' ? '💉' :
                   doc.type === 'ordonnance' ? '💊' :
                   doc.type === 'certificat_medical' ? '🩺' :
                   doc.type === 'attestation_assurance' ? '🛡' :
                   doc.type === 'pass_nautique' ? '🏊' :
                   doc.type === 'certificat_plongee' ? '🤿' : '📎'}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{getTypeLabel(doc.type)}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {doc.filename} — {formatSize(doc.size)} — {formatDate(doc.uploaded_at)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(doc.storage_path)}
                className="text-gray-400 hover:text-red-500 transition flex-shrink-0 ml-2"
                title="Supprimer"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Indicateur de completude */}
      <div className="text-xs text-gray-500 pt-2 border-t">
        {DOC_TYPES.filter(dt => dt.required).map(dt => {
          const uploaded = documents.some(d => d.type === dt.value);
          return (
            <span key={dt.value} className={`inline-flex items-center gap-1 mr-3 ${uploaded ? 'text-green-600' : 'text-gray-400'}`}>
              {uploaded ? '✓' : '○'} {dt.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
