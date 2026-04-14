'use client';

import { useEffect, useState, useCallback } from 'react';
import { FileText, Plus, X } from 'lucide-react';

interface Inscription {
  id: string;
  jeune_prenom: string;
  jeune_nom: string;
}

interface Note {
  id: string;
  inscription_id: string;
  content: string;
  created_by: string;
  created_at: string;
}

interface Props {
  code: string;
  role: string;
  inscriptions: Inscription[];
}

export default function NotesPanel({ code, role, inscriptions }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  const canWrite = role === 'direction' || role === 'cds' || role === 'cds_delegated';

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/structure/${code}/notes`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes ?? []);
        setLoadError(false);
      } else {
        setLoadError(true);
      }
    } catch { setLoadError(true); }
    setLoading(false);
  }, [code]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/structure/${code}/notes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inscription_id: fd.get('inscription_id'),
          content: fd.get('content'),
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setSubmitError(null);
        load();
      } else {
        const body = await res.json().catch(() => ({}));
        setSubmitError(body?.error?.message ?? 'Erreur lors de l\'enregistrement. Réessayez.');
      }
    } catch {
      setSubmitError('Erreur réseau. Vérifiez votre connexion.');
    }
    setSubmitting(false);
  };

  const getEnfantName = (inscriptionId: string) => {
    const insc = inscriptions.find(i => i.id === inscriptionId);
    return insc ? `${insc.jeune_prenom} ${insc.jeune_nom}` : '—';
  };

  if (loading) return <div className="p-6 text-center text-gray-400">Chargement...</div>;
  if (loadError) return <div className="p-4 bg-secondary-50 border border-secondary-200 rounded-xl text-sm text-secondary-700" role="alert">Impossible de charger les notes. Rechargez la page ou contactez GED.</div>;

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Annuler' : 'Ajouter une note'}
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <label htmlFor="note-enfant" className="block text-sm font-medium text-gray-700 mb-1">Enfant concerné</label>
            <select id="note-enfant" name="inscription_id" required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Sélectionner...</option>
              {inscriptions.map(i => (
                <option key={i.id} value={i.id}>{i.jeune_prenom} {i.jeune_nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="note-content" className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <textarea id="note-content" name="content" required minLength={5} rows={4} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Observations, suivi, remarques..." />
          </div>
          {submitError && <p className="text-sm text-red-600" role="alert">{submitError}</p>}
          <button type="submit" disabled={submitting} className="px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary-600 transition disabled:opacity-50">
            {submitting ? 'Envoi...' : 'Enregistrer'}
          </button>
        </form>
      )}

      <p className="text-xs text-gray-400">Les notes ne peuvent pas être modifiées après envoi (traçabilité RGPD).</p>

      {notes.length === 0 ? (
        <div className="p-8 text-center text-gray-400">Aucune note pour le moment.</div>
      ) : (
        <div className="space-y-3">
          {notes.map(n => (
            <div key={n.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary-300" />
                  <p className="font-medium text-primary text-sm">{getEnfantName(n.inscription_id)}</p>
                </div>
                <span className="text-xs text-gray-400">{new Date(n.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} — {n.created_by}</span>
              </div>
              <p className="text-sm text-gray-600 whitespace-pre-line">{n.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
