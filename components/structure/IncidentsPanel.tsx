'use client';

import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Shield, Activity, Plus, X } from 'lucide-react';

interface Inscription {
  id: string;
  jeune_prenom: string;
  jeune_nom: string;
}

interface Incident {
  id: string;
  inscription_id: string;
  category: string;
  severity: string;
  status: string;
  description: string;
  resolved_at: string | null;
  created_by: string;
  created_at: string;
}

interface Props {
  code: string;
  role: string;
  inscriptions: Inscription[];
}

const SEVERITY_STYLES: Record<string, string> = {
  info: 'bg-primary-100 text-primary',
  attention: 'bg-secondary-100 text-secondary-700',
  urgent: 'bg-red-100 text-red-700',
};

const SEVERITY_LABELS: Record<string, string> = {
  info: 'Info',
  attention: 'Attention',
  urgent: 'Urgent',
};

const CATEGORY_LABELS: Record<string, string> = {
  medical: 'Médical',
  comportemental: 'Comportemental',
  fugue: 'Fugue',
  accident: 'Accident',
  autre: 'Autre',
};

const STATUS_LABELS: Record<string, string> = {
  ouvert: 'Ouvert',
  en_cours: 'En cours',
  resolu: 'Résolu',
};

export default function IncidentsPanel({ code, role, inscriptions }: Props) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // F3 fix : passer de boolean à string pour exposer le message serveur (rate-limit,
  // validation, ownership) au lieu d'un message générique « Erreur lors du signalement ».
  const [submitError, setSubmitError] = useState('');
  const [loadError, setLoadError] = useState('');

  const canWrite = role === 'direction' || role === 'cds' || role === 'cds_delegated';

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const res = await fetch(`/api/structure/${code}/incidents`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setIncidents(data.incidents ?? []);
      } else {
        const data = await res.json().catch(() => ({}));
        setLoadError(data?.error?.message || data?.error || 'Impossible de charger les faits marquants. Rechargez la page ou contactez GED.');
      }
    } catch { setLoadError('Impossible de charger les faits marquants. Vérifiez votre connexion.'); }
    setLoading(false);
  }, [code]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    setSubmitError('');
    try {
      const res = await fetch(`/api/structure/${code}/incidents`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inscription_id: fd.get('inscription_id'),
          category: fd.get('category'),
          severity: fd.get('severity'),
          description: fd.get('description'),
        }),
      });
      if (res.ok) {
        setShowForm(false);
        load();
      } else {
        const data = await res.json().catch(() => ({}));
        setSubmitError(data?.error?.message || data?.error || 'Erreur lors du signalement. Veuillez réessayer.');
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
  if (loadError) return <div className="p-4 bg-secondary-50 border border-secondary-200 rounded-xl text-sm text-secondary-700" role="alert">{loadError}</div>;

  return (
    <div className="space-y-4">
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
            {showForm ? 'Annuler' : 'Signaler un fait marquant'}
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <label htmlFor="inc-enfant" className="block text-sm font-medium text-gray-700 mb-1">Enfant concerné</label>
            <select id="inc-enfant" name="inscription_id" required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Sélectionner...</option>
              {inscriptions.map(i => (
                <option key={i.id} value={i.id}>{i.jeune_prenom} {i.jeune_nom}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="inc-cat" className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
              <select id="inc-cat" name="category" required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="inc-sev" className="block text-sm font-medium text-gray-700 mb-1">Gravité</label>
              <select id="inc-sev" name="severity" required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                {Object.entries(SEVERITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="inc-desc" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea id="inc-desc" name="description" required minLength={5} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Decrire le fait marquant..." />
          </div>
          {submitError && <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{submitError}</p>}
          <button type="submit" disabled={submitting} className="px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary-600 transition disabled:opacity-50">
            {submitting ? 'Envoi...' : 'Signaler'}
          </button>
        </form>
      )}

      {incidents.length === 0 ? (
        <div className="p-8 text-center text-gray-400">Aucun fait marquant signalé.</div>
      ) : (
        <div className="space-y-3">
          {incidents.map(inc => (
            <div key={inc.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-card transition">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {inc.severity === 'urgent' ? <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" /> :
                   inc.severity === 'attention' ? <Shield className="w-5 h-5 text-secondary flex-shrink-0" /> :
                   <Activity className="w-5 h-5 text-primary-300 flex-shrink-0" />}
                  <div>
                    <p className="font-medium text-primary text-sm">{getEnfantName(inc.inscription_id)}</p>
                    <p className="text-xs text-gray-500">{new Date(inc.created_at).toLocaleDateString('fr-FR')} — {inc.created_by}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_STYLES[inc.severity] ?? ''}`}>
                    {SEVERITY_LABELS[inc.severity] ?? inc.severity}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-gray-600">
                    {CATEGORY_LABELS[inc.category] ?? inc.category}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${inc.status === 'resolu' ? 'bg-primary-50 text-primary' : 'bg-secondary-50 text-secondary'}`}>
                    {STATUS_LABELS[inc.status] ?? inc.status}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-600">{inc.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
