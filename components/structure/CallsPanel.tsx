'use client';

import { useEffect, useState, useCallback } from 'react';
import { PhoneCall, Plus, X, ArrowRight, ArrowLeft } from 'lucide-react';

interface Inscription {
  id: string;
  jeune_prenom: string;
  jeune_nom: string;
}

interface Call {
  id: string;
  inscription_id: string | null;
  call_type: string;
  direction: string;
  interlocuteur: string;
  resume: string;
  parent_accord: boolean;
  created_by: string;
  call_date: string;
}

interface Props {
  code: string;
  role: string;
  inscriptions: Inscription[];
}

const TYPE_STYLES: Record<string, string> = {
  ged_colo: 'bg-primary-100 text-primary',
  educ_colo: 'bg-accent/10 text-accent',
  colo_structure: 'bg-secondary-100 text-secondary-700',
  astreinte: 'bg-red-100 text-red-700',
  parents: 'bg-primary-50 text-primary-400',
};

const TYPE_LABELS: Record<string, string> = {
  ged_colo: 'GED → Colo',
  educ_colo: 'Éduc → Colo',
  colo_structure: 'Colo → Structure',
  astreinte: 'Astreinte',
  parents: 'Parents',
};

export default function CallsPanel({ code, role, inscriptions }: Props) {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  // F3 fix : string au lieu de boolean — expose le message serveur (rate-limit, validation, ownership)
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [callType, setCallType] = useState('ged_colo');

  const canWrite = role === 'direction' || role === 'cds' || role === 'cds_delegated';

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const res = await fetch(`/api/structure/${code}/calls`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCalls(data.calls ?? []);
      } else {
        const data = await res.json().catch(() => ({}));
        setLoadError(data?.error?.message || data?.error || 'Impossible de charger les appels. Rechargez la page.');
      }
    } catch { setLoadError('Impossible de charger les appels. Vérifiez votre connexion.'); }
    setLoading(false);
  }, [code]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    setSubmitError('');
    try {
      const res = await fetch(`/api/structure/${code}/calls`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inscription_id: fd.get('inscription_id') || null,
          call_type: fd.get('call_type'),
          direction: fd.get('direction'),
          interlocuteur: fd.get('interlocuteur'),
          resume: fd.get('resume'),
          parent_accord: fd.get('parent_accord') === 'on',
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

  const getEnfantName = (inscriptionId: string | null) => {
    if (!inscriptionId) return null;
    const insc = inscriptions.find(i => i.id === inscriptionId);
    return insc ? `${insc.jeune_prenom} ${insc.jeune_nom}` : null;
  };

  if (loading) return <div className="p-6 text-center text-gray-400">Chargement...</div>;
  if (loadError) return <div role="alert" className="p-6 text-center text-red-600 text-sm">{loadError}</div>;

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
            {showForm ? 'Annuler' : 'Tracer un appel'}
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="call-type" className="block text-sm font-medium text-gray-700 mb-1">Type d&apos;appel</label>
              <select id="call-type" name="call_type" required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={callType} onChange={e => setCallType(e.target.value)}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="call-dir" className="block text-sm font-medium text-gray-700 mb-1">Sens</label>
              <select id="call-dir" name="direction" required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="sortant">Sortant (vous appelez)</option>
                <option value="entrant">Entrant (on vous appelle)</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="call-enfant" className="block text-sm font-medium text-gray-700 mb-1">Enfant concerné (optionnel)</label>
            <select id="call-enfant" name="inscription_id" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Aucun (appel logistique)</option>
              {inscriptions.map(i => (
                <option key={i.id} value={i.id}>{i.jeune_prenom} {i.jeune_nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="call-interl" className="block text-sm font-medium text-gray-700 mb-1">Interlocuteur</label>
            <input id="call-interl" name="interlocuteur" required minLength={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Ex : M. Martin, directeur colo" />
          </div>
          <div>
            <label htmlFor="call-resume" className="block text-sm font-medium text-gray-700 mb-1">Résumé</label>
            <textarea id="call-resume" name="resume" required minLength={5} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Points abordés, décisions prises..." />
          </div>
          {callType === 'parents' && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="parent_accord" required className="w-4 h-4" />
              Accord de la structure obtenu
            </label>
          )}
          {submitError && <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{submitError}</p>}
          <button type="submit" disabled={submitting} className="px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary-600 transition disabled:opacity-50">
            {submitting ? 'Envoi...' : 'Enregistrer'}
          </button>
        </form>
      )}

      {calls.length === 0 ? (
        <div className="p-8 text-center text-gray-400">Aucun appel tracé.</div>
      ) : (
        <div className="space-y-3">
          {calls.map(c => {
            const enfant = getEnfantName(c.inscription_id);
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-card transition">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <PhoneCall className="w-4 h-4 text-primary-300" />
                    {c.direction === 'sortant'
                      ? <ArrowRight className="w-3 h-3 text-gray-400" />
                      : <ArrowLeft className="w-3 h-3 text-gray-400" />}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_STYLES[c.call_type] ?? 'bg-muted text-gray-600'}`}>
                      {TYPE_LABELS[c.call_type] ?? c.call_type}
                    </span>
                    {enfant && <span className="text-sm font-medium text-primary">{enfant}</span>}
                    {c.parent_accord && <span className="text-xs text-accent">Accord obtenu</span>}
                  </div>
                  <span className="text-xs text-gray-400">{new Date(c.call_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-xs text-gray-500 mb-1">{c.interlocuteur} — {c.created_by}</p>
                <p className="text-sm text-gray-600">{c.resume}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
