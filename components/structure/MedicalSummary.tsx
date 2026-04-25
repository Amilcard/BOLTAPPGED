'use client';

import { useEffect, useState, useCallback } from 'react';
import { Heart, Plus, X } from 'lucide-react';

interface Inscription {
  id: string;
  jeune_prenom: string;
  jeune_nom: string;
}

interface MedicalEvent {
  id: string;
  inscription_id: string;
  event_type: string;
  description: string;
  created_by: string;
  created_at: string;
}

interface Props {
  code: string;
  role: string;
  inscriptions: Inscription[];
}

export default function MedicalSummary({ code, role, inscriptions }: Props) {
  const [count, setCount] = useState(0);
  const [detail, setDetail] = useState<MedicalEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // F1 fix : feedback erreur visible (avant : catch silencieux → user croyait que ça avait marché)
  const [submitError, setSubmitError] = useState('');
  const [loadError, setLoadError] = useState('');

  const canWrite = role === 'direction' || role === 'cds' || role === 'educateur';
  const canSeeDetail = role === 'direction' || role === 'cds';

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const res = await fetch(`/api/structure/${code}/medical`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCount(data.count ?? 0);
        setDetail(data.detail);
      } else {
        const data = await res.json().catch(() => ({}));
        setLoadError(data?.error?.message || data?.error || 'Impossible de charger les événements médicaux. Rechargez la page.');
      }
    } catch {
      setLoadError('Impossible de charger les événements médicaux. Vérifiez votre connexion.');
    }
    setLoading(false);
  }, [code]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/structure/${code}/medical`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inscription_id: fd.get('inscription_id'),
          event_type: fd.get('event_type'),
          description: fd.get('description'),
        }),
      });
      if (res.ok) {
        setShowForm(false);
        load();
      } else {
        const data = await res.json().catch(() => ({}));
        setSubmitError(data?.error?.message || data?.error || 'Erreur lors de l\'enregistrement. Veuillez réessayer.');
      }
    } catch {
      setSubmitError('Erreur réseau. Vérifiez votre connexion et réessayez.');
    }
    setSubmitting(false);
  };

  const getEnfantName = (inscriptionId: string) => {
    const insc = inscriptions.find(i => i.id === inscriptionId);
    return insc ? `${insc.jeune_prenom} ${insc.jeune_nom}` : '—';
  };

  if (loading) return <div className="p-6 text-center text-gray-400">Chargement...</div>;

  // Éducateur : compteur uniquement
  if (!canSeeDetail) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center gap-3">
          <Heart className="w-5 h-5 text-primary-300" />
          <div>
            <p className="text-sm font-medium text-primary">{count} événement{count !== 1 ? 's' : ''} médical{count !== 1 ? 'aux' : ''}</p>
            <p className="text-xs text-gray-400">Le détail est accessible au CDS et à la direction.</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-gray-400">Données médicales Art. 9 RGPD — purge automatique 3 mois après fin de séjour</p>
      </div>
    );
  }

  // CDS/Direction : détail complet
  return (
    <div className="space-y-4">
      <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-xs text-red-800">
        Données médicales Art. 9 RGPD — accès restreint direction/CDS — purge automatique 3 mois après fin de séjour
      </div>

      {canWrite && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowForm(!showForm)}
            className={`flex items-center gap-2 px-4 py-2 rounded-pill text-sm font-medium transition ${
              showForm
                ? 'border border-gray-200 text-gray-700 bg-white hover:bg-gray-50'
                : 'bg-secondary text-white hover:bg-secondary/90'
            }`}
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Annuler' : 'Ajouter un événement médical'}
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <label htmlFor="med-enfant" className="block text-sm font-medium text-gray-700 mb-1">Enfant concerné</label>
            <select id="med-enfant" name="inscription_id" required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Sélectionner...</option>
              {inscriptions.map(i => (
                <option key={i.id} value={i.id}>{i.jeune_prenom} {i.jeune_nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="med-type" className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <input id="med-type" name="event_type" required minLength={2} list="med-type-suggestions" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Ex : prise médicament, consultation, urgences..." />
            {/* F4 fix : datalist HTML5 — guide l'utilisateur vers une nomenclature cohérente
                sans casser les données existantes (text libre côté DB, pas de CHECK constraint) */}
            <datalist id="med-type-suggestions">
              <option value="prise médicament" />
              <option value="consultation" />
              <option value="urgences" />
              <option value="prévention" />
              <option value="hospitalisation" />
              <option value="autre" />
            </datalist>
          </div>
          <div>
            <label htmlFor="med-desc" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea id="med-desc" name="description" required minLength={5} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Décrire l'événement médical..." />
          </div>
          {submitError && <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{submitError}</p>}
          <button type="submit" disabled={submitting} className="px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary-600 transition disabled:opacity-50">
            {submitting ? 'Envoi...' : 'Enregistrer'}
          </button>
        </form>
      )}

      {loadError && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{loadError}</div>
      )}

      {(detail ?? []).length === 0 ? (
        <div className="p-8 text-center text-gray-400">Aucun événement médical.</div>
      ) : (
        <div className="space-y-3">
          {(detail ?? []).map(ev => (
            <div key={ev.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-primary text-sm">{getEnfantName(ev.inscription_id)}</p>
                <span className="text-xs text-gray-400">{new Date(ev.created_at).toLocaleDateString('fr-FR')} — {ev.created_by}</span>
              </div>
              <p className="text-xs font-medium text-accent mb-1">{ev.event_type}</p>
              <p className="text-sm text-gray-600">{ev.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
