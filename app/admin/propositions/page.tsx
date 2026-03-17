'use client';

import { useEffect, useState, useCallback } from 'react';
import { getStoredAuth } from '@/lib/utils';
import { Plus, FileDown, Check, X, Clock, Send, Loader2, Receipt } from 'lucide-react';

interface Sejour {
  slug: string;
  title: string;
}

interface Session {
  stay_slug: string;
  start_date: string;
  end_date: string;
  city_departure: string;
}

interface Proposition {
  id: string;
  structure_nom: string;
  structure_adresse: string;
  structure_cp: string;
  structure_ville: string;
  enfant_nom: string;
  enfant_prenom: string;
  sejour_slug: string;
  sejour_titre: string;
  session_start: string;
  session_end: string;
  ville_depart: string;
  encadrement: boolean;
  prix_sejour: number;
  prix_transport: number;
  prix_encadrement: number;
  prix_total: number;
  status: string;
  created_at: string;
  validated_at: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  brouillon: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700', icon: Clock },
  envoyee: { label: 'Envoyée', color: 'bg-blue-100 text-blue-700', icon: Send },
  validee: { label: 'Validée', color: 'bg-green-100 text-green-700', icon: Check },
  refusee: { label: 'Refusée', color: 'bg-red-100 text-red-700', icon: X },
  annulee: { label: 'Annulée', color: 'bg-gray-200 text-gray-500', icon: X },
};

export default function PropositionsPage() {
  const [propositions, setPropositions] = useState<Proposition[]>([]);
  const [sejours, setSejours] = useState<Sejour[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [form, setForm] = useState({
    structure_nom: '',
    structure_adresse: '',
    structure_cp: '',
    structure_ville: '',
    enfant_nom: '',
    enfant_prenom: '',
    sejour_slug: '',
    session_start: '',
    session_end: '',
    ville_depart: '',
    encadrement: false,
  });

  const authHeaders = () => {
    const token = getStoredAuth();
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  };

  const loadPropositions = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/propositions', { headers: authHeaders() });
      const data = await res.json();
      setPropositions(data.propositions || []);
    } catch (err) {
      console.error('Error loading propositions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSejours = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stays', { headers: authHeaders() });
      const data = await res.json();
      setSejours(data.stays || []);
    } catch (err) {
      console.error('Error loading sejours:', err);
    }
  }, []);

  useEffect(() => {
    loadPropositions();
    loadSejours();
  }, [loadPropositions, loadSejours]);

  // Quand un séjour est sélectionné, charger ses sessions
  useEffect(() => {
    if (!form.sejour_slug) {
      setSessions([]);
      return;
    }
    const loadSessions = async () => {
      try {
        const res = await fetch(`/api/admin/stays/${form.sejour_slug}/sessions`);
        if (res.ok) {
          const data = await res.json();
          setSessions(data.sessions || []);
        }
      } catch {
        // Fallback : charger depuis session_prices
        try {
          const res = await fetch('/api/admin/sessions');
          if (res.ok) {
            const data = await res.json();
            const filtered = (data.sessions || []).filter((s: any) => s.stay_slug === form.sejour_slug);
            setSessions(filtered);
          }
        } catch {
          setSessions([]);
        }
      }
    };
    loadSessions();
  }, [form.sejour_slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/admin/propositions', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowForm(false);
      setForm({
        structure_nom: '', structure_adresse: '', structure_cp: '', structure_ville: '',
        enfant_nom: '', enfant_prenom: '',
        sejour_slug: '', session_start: '', session_end: '', ville_depart: '',
        encadrement: false,
      });
      loadPropositions();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch('/api/admin/propositions', {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ id, status }),
      });
      loadPropositions();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const downloadPdf = (id: string, nom: string, prenom: string) => {
    window.open(`/api/admin/propositions/pdf?id=${id}`, '_blank');
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR');
  const formatPrice = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' €';

  // Extraire villes de départ uniques des sessions
  const villesDepart = [...new Set(sessions.map(s => s.city_departure).filter(Boolean))];

  // Extraire sessions uniques (start+end)
  const uniqueSessions = sessions.reduce((acc: Session[], s) => {
    if (!acc.find(a => a.start_date === s.start_date && a.end_date === s.end_date)) {
      acc.push(s);
    }
    return acc;
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Propositions Tarifaires</h1>
          <p className="text-gray-500 mt-1">Générer et suivre les propositions envoyées aux structures</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
        >
          <Plus size={20} />
          Nouvelle proposition
        </button>
      </div>

      {/* FORMULAIRE DE CRÉATION */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-6">
          <h2 className="text-lg font-semibold border-b pb-3">Nouvelle Proposition Tarifaire</h2>

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>
          )}

          {/* Structure */}
          <div>
            <h3 className="font-medium text-gray-700 mb-3">Structure sociale</h3>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text" placeholder="Nom de la structure *" required
                value={form.structure_nom} onChange={e => setForm({ ...form, structure_nom: e.target.value })}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-500 outline-none"
              />
              <input
                type="text" placeholder="Adresse"
                value={form.structure_adresse} onChange={e => setForm({ ...form, structure_adresse: e.target.value })}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-500 outline-none"
              />
              <input
                type="text" placeholder="Code postal"
                value={form.structure_cp} onChange={e => setForm({ ...form, structure_cp: e.target.value })}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-500 outline-none"
              />
              <input
                type="text" placeholder="Ville"
                value={form.structure_ville} onChange={e => setForm({ ...form, structure_ville: e.target.value })}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-500 outline-none"
              />
            </div>
          </div>

          {/* Enfant */}
          <div>
            <h3 className="font-medium text-gray-700 mb-3">Enfant</h3>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text" placeholder="Nom de l'enfant *" required
                value={form.enfant_nom} onChange={e => setForm({ ...form, enfant_nom: e.target.value })}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-500 outline-none"
              />
              <input
                type="text" placeholder="Prénom de l'enfant *" required
                value={form.enfant_prenom} onChange={e => setForm({ ...form, enfant_prenom: e.target.value })}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-500 outline-none"
              />
            </div>
          </div>

          {/* Séjour */}
          <div>
            <h3 className="font-medium text-gray-700 mb-3">Séjour</h3>
            <div className="grid grid-cols-2 gap-4">
              <select
                required value={form.sejour_slug}
                onChange={e => setForm({ ...form, sejour_slug: e.target.value, session_start: '', session_end: '', ville_depart: '' })}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-500 outline-none"
              >
                <option value="">Sélectionner un séjour *</option>
                {sejours.map(s => (
                  <option key={s.slug} value={s.slug}>{s.title}</option>
                ))}
              </select>

              <select
                required value={`${form.session_start}|${form.session_end}`}
                onChange={e => {
                  const [start, end] = e.target.value.split('|');
                  setForm({ ...form, session_start: start, session_end: end });
                }}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-500 outline-none"
                disabled={!form.sejour_slug}
              >
                <option value="|">Sélectionner une session *</option>
                {uniqueSessions.map(s => (
                  <option key={`${s.start_date}|${s.end_date}`} value={`${s.start_date}|${s.end_date}`}>
                    {formatDate(s.start_date)} → {formatDate(s.end_date)}
                  </option>
                ))}
              </select>

              <select
                required value={form.ville_depart}
                onChange={e => setForm({ ...form, ville_depart: e.target.value })}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-500 outline-none"
                disabled={!form.session_start}
              >
                <option value="">Ville de départ *</option>
                {villesDepart.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>

              <label className="flex items-center gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  checked={form.encadrement}
                  onChange={e => setForm({ ...form, encadrement: e.target.checked })}
                  className="w-5 h-5 rounded text-orange-500 focus:ring-orange-300"
                />
                <span className="text-sm">
                  Encadrement renforcé (animateur dédié — 630 €/semaine)
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition"
            >
              Annuler
            </button>
            <button
              type="submit" disabled={submitting}
              className="flex items-center gap-2 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition disabled:opacity-50"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Receipt size={18} />}
              Créer la proposition
            </button>
          </div>
        </form>
      )}

      {/* LISTE DES PROPOSITIONS */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" size={32} /></div>
      ) : propositions.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-12 text-center text-gray-500">
          <Receipt size={48} className="mx-auto mb-4 text-gray-300" />
          <p>Aucune proposition tarifaire pour le moment.</p>
          <p className="text-sm mt-2">Cliquez sur "Nouvelle proposition" pour en créer une.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Enfant</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Structure</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Séjour</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dates</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {propositions.map(p => {
                const statusInfo = STATUS_LABELS[p.status] || STATUS_LABELS.brouillon;
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.enfant_nom} {p.enfant_prenom}</div>
                      {p.encadrement && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                          + encadrement
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{p.structure_nom}</td>
                    <td className="px-4 py-3 text-sm">{p.sejour_titre}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(p.session_start)} → {formatDate(p.session_end)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatPrice(p.prix_total)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => downloadPdf(p.id, p.enfant_nom, p.enfant_prenom)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition" title="Télécharger PDF"
                        >
                          <FileDown size={18} className="text-gray-600" />
                        </button>
                        {p.status === 'brouillon' && (
                          <button
                            onClick={() => updateStatus(p.id, 'envoyee')}
                            className="p-1.5 hover:bg-blue-50 rounded-lg transition" title="Marquer comme envoyée"
                          >
                            <Send size={18} className="text-blue-600" />
                          </button>
                        )}
                        {(p.status === 'brouillon' || p.status === 'envoyee') && (
                          <button
                            onClick={() => updateStatus(p.id, 'validee')}
                            className="p-1.5 hover:bg-green-50 rounded-lg transition" title="Valider (BON POUR ACCORD)"
                          >
                            <Check size={18} className="text-green-600" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
