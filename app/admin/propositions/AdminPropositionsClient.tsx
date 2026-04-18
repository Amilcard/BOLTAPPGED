'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, FileDown, Check, X, Clock, Send, Loader2, Receipt, Eye, Download, Trash2 } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useAdminUI } from '@/components/admin/admin-ui';
import { ENCADREMENT_EUR_PAR_SEMAINE } from '@/lib/constants';
import { AdminPagination } from '@/components/ui/AdminPagination';

interface Sejour {
  slug: string;
  title: string;
}

interface SessionPrice {
  stay_slug: string;
  start_date: string;
  end_date: string;
  city_departure: string;
  base_price_eur: number;
  transport_surcharge_ged: number;
  price_ged_total: number;
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
  demandeur_email?: string | null;
  demandeur_nom?: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  brouillon: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700', icon: Clock },
  demandee:  { label: 'Demandée', color: 'bg-blue-100 text-blue-700', icon: Clock },
  envoyee:   { label: 'Envoyée', color: 'bg-accent/10 text-accent', icon: Send },
  validee:   { label: 'Validée', color: 'bg-primary-50 text-primary', icon: Check },
  refusee:   { label: 'Refusée', color: 'bg-red-100 text-red-700', icon: X },
  annulee:   { label: 'Annulée', color: 'bg-gray-200 text-gray-500', icon: X },
};

export default function AdminPropositionsClient() {
  const { confirm, toast } = useAdminUI();
  const [propositions, setPropositions] = useState<Proposition[]>([]);
  const [sejours, setSejours] = useState<Sejour[]>([]);
  const [sessions, setSessions] = useState<SessionPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const LIMIT = 50;
  const [total, setTotal] = useState(0);
  const totalPages = Math.ceil(total / LIMIT);
  const [showForm, setShowForm] = useState(false);
  const [showPreviewForm, setShowPreviewForm] = useState(false);
  const [preview, setPreview] = useState<Proposition | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rowLoading, setRowLoading] = useState<string | null>(null);
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
    return { 'Content-Type': 'application/json' };
  };

  const loadPropositions = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/propositions?page=${page}&limit=${LIMIT}`, { headers: authHeaders() });
      const data = await res.json();
      setPropositions(data.propositions || []);
      setTotal(data.total ?? (data.propositions || []).length);
    } catch (err) {
      console.error('Error loading propositions:', err);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const loadSejours = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stays', { headers: authHeaders() });
      const data = await res.json();
      const stays = Array.isArray(data) ? data : (data.stays || []);
      setSejours(stays);
    } catch (err) {
      console.error('Error loading sejours:', err);
    }
  }, []);

  useEffect(() => {
    void loadPropositions();
    void loadSejours();
  }, [loadPropositions, loadSejours]);

  useEffect(() => {
    if (!form.sejour_slug) {
      setSessions([]);
      return;
    }
    const loadSessions = async () => {
      try {
        const res = await fetch(
          `/api/admin/session-prices?stay_slug=${encodeURIComponent(form.sejour_slug)}`,
          { headers: authHeaders() }
        );
        if (res.ok) {
          const data = await res.json();
          setSessions(data.sessions || []);
        } else {
          setSessions([]);
        }
      } catch {
        setSessions([]);
      }
    };
    loadSessions();
  }, [form.sejour_slug]);

  const handlePreview = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setShowPreviewForm(true);
  };

  const handleConfirm = async () => {
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
      setShowPreviewForm(false);
      setForm({
        structure_nom: '', structure_adresse: '', structure_cp: '', structure_ville: '',
        enfant_nom: '', enfant_prenom: '',
        sejour_slug: '', session_start: '', session_end: '', ville_depart: '',
        encadrement: false,
      });
      void loadPropositions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setSubmitting(false);
    }
  };

  const getSejourTitle = () => sejours.find(s => s.slug === form.sejour_slug)?.title || form.sejour_slug;
  const getEstimatedPrice = () => {
    const session = sessions.find(s => s.start_date === form.session_start && s.city_departure === form.ville_depart);
    if (!session) return null;
    const base = Number(session.base_price_eur) || 0;
    const transport = Number(session.transport_surcharge_ged) || 0;
    const startDate = new Date(form.session_start);
    const endDate = new Date(form.session_end);
    const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const nbSemaines = Math.max(1, Math.round(diffDays / 7));
    const encadr = form.encadrement ? nbSemaines * ENCADREMENT_EUR_PAR_SEMAINE : 0;
    return { base, transport, encadrement: encadr, total: base + transport + encadr };
  };

  const deleteProposition = (e: React.MouseEvent, id: string, enfant: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (rowLoading) return;
    confirm(`Supprimer la proposition de ${enfant} ? Cette action est irréversible.`, async () => {
      setRowLoading(id);
      try {
        const res = await fetch('/api/admin/propositions', {
          method: 'DELETE',
          headers: authHeaders(),
          body: JSON.stringify({ id }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast(`Erreur : ${err?.error || res.status}`);
          return;
        }
        loadPropositions();
      } catch {
        toast('Erreur réseau');
      } finally {
        setRowLoading(null);
      }
    });
  };

  const updateStatus = async (id: string, status: string) => {
    if (rowLoading) return;
    setRowLoading(id);
    try {
      const res = await fetch('/api/admin/propositions', {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast(`Erreur mise à jour : ${err?.error || res.status}`);
      }
      void loadPropositions();
    } catch (err) {
      console.error('Error updating status:', err);
      toast('Erreur réseau');
    } finally {
      setRowLoading(null);
    }
  };

  const downloadPdf = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/propositions/pdf?id=${id}`, {
        headers: authHeaders(),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errData.error || `Erreur ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      toast('Erreur lors de la génération du PDF');
    }
  };

  const handleSendProposition = async (id: string) => {
    try {
      const res = await fetch('/api/admin/propositions/send', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        alert(`Erreur : ${err?.error ?? res.status}`);
        return;
      }
      alert('Proposition envoyée par email.');
      void loadPropositions();
    } catch {
      alert('Erreur réseau.');
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR');
  const formatPrice = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' €';

  const villesDepart = [...new Set(sessions.map(s => s.city_departure).filter(Boolean))];

  const uniqueSessions = sessions.reduce((acc: SessionPrice[], s) => {
    if (!acc.find(a => a.start_date === s.start_date && a.end_date === s.end_date)) {
      acc.push(s);
    }
    return acc;
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Propositions Tarifaires</h1>
          <p className="text-gray-500 mt-1">Générer et suivre les propositions envoyées aux structures</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-pill hover:bg-secondary/90 transition"
        >
          <Plus size={20} />
          Nouvelle proposition
        </button>
      </div>

      {/* FORMULAIRE DE CRÉATION */}
      {showForm && (<>
        <form onSubmit={handlePreview} className="bg-white rounded-brand shadow-card p-6 space-y-6">
          <h2 className="text-lg font-semibold border-b pb-3">Nouvelle Proposition Tarifaire</h2>

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>
          )}

          {/* Structure */}
          <div>
            <h3 className="font-medium text-gray-700 mb-3">Structure sociale</h3>
            <div className="grid grid-cols-2 gap-4">
              <input
                aria-label="Nom de la structure"
                type="text" placeholder="Nom de la structure *" required
                value={form.structure_nom} onChange={e => setForm({ ...form, structure_nom: e.target.value })}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-300 focus:border-primary outline-none"
              />
              <input
                aria-label="Adresse"
                type="text" placeholder="Adresse"
                value={form.structure_adresse} onChange={e => setForm({ ...form, structure_adresse: e.target.value })}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-300 focus:border-primary outline-none"
              />
              <input
                aria-label="Code postal"
                type="text" placeholder="Code postal"
                value={form.structure_cp} onChange={e => setForm({ ...form, structure_cp: e.target.value })}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-300 focus:border-primary outline-none"
              />
              <input
                aria-label="Ville"
                type="text" placeholder="Ville"
                value={form.structure_ville} onChange={e => setForm({ ...form, structure_ville: e.target.value })}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-300 focus:border-primary outline-none"
              />
            </div>
          </div>

          {/* Enfant */}
          <div>
            <h3 className="font-medium text-gray-700 mb-3">Enfant</h3>
            <div className="grid grid-cols-2 gap-4">
              <input
                aria-label="Nom de l'enfant"
                type="text" placeholder="Nom de l'enfant *" required
                value={form.enfant_nom} onChange={e => setForm({ ...form, enfant_nom: e.target.value })}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-300 focus:border-primary outline-none"
              />
              <input
                aria-label="Prénom de l'enfant"
                type="text" placeholder="Prénom de l'enfant *" required
                value={form.enfant_prenom} onChange={e => setForm({ ...form, enfant_prenom: e.target.value })}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-300 focus:border-primary outline-none"
              />
            </div>
          </div>

          {/* Séjour */}
          <div>
            <h3 className="font-medium text-gray-700 mb-3">Séjour</h3>
            <div className="grid grid-cols-2 gap-4">
              <select
                aria-label="Séjour"
                required value={form.sejour_slug}
                onChange={e => setForm({ ...form, sejour_slug: e.target.value, session_start: '', session_end: '', ville_depart: '' })}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-300 focus:border-primary outline-none"
              >
                <option value="">Sélectionner un séjour *</option>
                {sejours.map(s => (
                  <option key={s.slug} value={s.slug}>{s.title}</option>
                ))}
              </select>

              <select
                aria-label="Session"
                required value={`${form.session_start}|${form.session_end}`}
                onChange={e => {
                  const [start, end] = e.target.value.split('|');
                  setForm({ ...form, session_start: start, session_end: end });
                }}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-300 focus:border-primary outline-none"
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
                aria-label="Ville de départ"
                required value={form.ville_depart}
                onChange={e => setForm({ ...form, ville_depart: e.target.value })}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-300 focus:border-primary outline-none"
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
                  className="w-5 h-5 rounded text-primary focus:ring-primary-300"
                />
                <span className="text-sm">
                  Encadrement renforcé (animateur dédié — {ENCADREMENT_EUR_PAR_SEMAINE} €/semaine)
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
              className="flex items-center gap-2 px-6 py-2 bg-secondary text-white rounded-pill hover:bg-secondary/90 transition disabled:opacity-50"
            >
              <Eye size={18} />
              Aperçu de la proposition
            </button>
          </div>
        </form>

        {/* APERÇU AVANT CONFIRMATION */}
        {showPreviewForm && (
          <div className="bg-white rounded-brand shadow-brand-lg border-2 border-orange-200 p-6 space-y-6">
            <div className="bg-secondary text-white px-6 py-4 rounded-lg -mx-6 -mt-6">
              <p className="text-sm opacity-80">Association Groupe et Découverte</p>
              <h2 className="text-xl font-bold mt-1">Proposition Tarifaire — Aperçu</h2>
            </div>

            <div className="grid grid-cols-2 gap-6 pt-2">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 uppercase font-medium mb-1">Structure sociale</p>
                <p className="font-semibold">{form.structure_nom}</p>
                {form.structure_adresse && <p className="text-sm text-gray-600">{form.structure_adresse}</p>}
                <p className="text-sm text-gray-600">{form.structure_cp} {form.structure_ville}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 uppercase font-medium mb-1">Enfant</p>
                <p className="font-semibold">{form.enfant_nom.toUpperCase()} {form.enfant_prenom}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium mb-1">Séjour</p>
                <p className="font-semibold text-orange-600">{getSejourTitle()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium mb-1">Période</p>
                <p className="font-medium">{form.session_start && form.session_end ? `${formatDate(form.session_start)} → ${formatDate(form.session_end)}` : '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium mb-1">Ville de départ</p>
                <p className="font-medium capitalize">{form.ville_depart}</p>
              </div>
              {form.encadrement && (
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium mb-1">Encadrement</p>
                  <p className="font-medium text-orange-600">Animateur dédié ({ENCADREMENT_EUR_PAR_SEMAINE} €/semaine)</p>
                </div>
              )}
            </div>

            {/* Estimation tarifaire */}
            {(() => {
              const prices = getEstimatedPrice();
              if (!prices) return <p className="text-sm text-gray-500 italic">Prix calculé après enregistrement</p>;
              return (
                <div className="border-t-2 border-orange-500 pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Estimation tarifaire</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between"><span className="text-gray-600">Séjour</span><span className="font-medium">{formatPrice(prices.base)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Transport</span><span className="font-medium">{formatPrice(prices.transport)}</span></div>
                    {form.encadrement && <div className="flex justify-between"><span className="text-gray-600">Encadrement</span><span className="font-medium">{formatPrice(prices.encadrement)}</span></div>}
                    <div className="flex justify-between"><span className="text-gray-600">Adhésion</span><span className="font-medium">Comprise</span></div>
                    <div className="flex justify-between pt-3 mt-2 border-t-2 border-orange-500">
                      <span className="text-lg font-bold">Total estimé</span>
                      <span className="text-lg font-bold text-orange-600">{formatPrice(prices.total)}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* BON POUR ACCORD */}
            <div className="bg-gray-50 rounded-lg p-5 border-2 border-dashed border-gray-300 text-center">
              <p className="font-bold text-orange-600 text-lg mb-2">BON POUR ACCORD</p>
              <p className="text-sm text-gray-500">Nom et qualité du signataire : _______________________</p>
              <p className="text-sm text-gray-500 mt-1">Date : ____/____/________&nbsp;&nbsp;&nbsp;&nbsp;Signature et cachet :</p>
            </div>

            {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button" onClick={() => setShowPreviewForm(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition"
              >
                Modifier
              </button>
              <button
                onClick={handleConfirm} disabled={submitting}
                className="flex items-center gap-2 px-6 py-2 bg-secondary text-white rounded-pill hover:bg-secondary/90 transition disabled:opacity-50"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                Confirmer et enregistrer
              </button>
            </div>
          </div>
        )}
      </>)}

      {/* LISTE DES PROPOSITIONS */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" size={32} /></div>
      ) : propositions.length === 0 ? (
        <div className="bg-white rounded-brand shadow-card p-12 text-center text-gray-500">
          <Receipt size={48} className="mx-auto mb-4 text-gray-300" />
          <p>Aucune proposition tarifaire pour le moment.</p>
          <p className="text-sm mt-2">Cliquez sur "Nouvelle proposition" pour en créer une.</p>
        </div>
      ) : (
        <div className="bg-white rounded-brand shadow-card overflow-hidden">
          <table className="w-full" aria-label="Liste des propositions">
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
                          onClick={() => setPreview(p)}
                          className="p-1.5 hover:bg-orange-50 rounded-lg transition" title="Aperçu"
                        >
                          <Eye size={18} className="text-orange-600" />
                        </button>
                        <button
                          onClick={() => { void downloadPdf(p.id); }}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition" title="Télécharger PDF"
                        >
                          <FileDown size={18} className="text-gray-600" />
                        </button>
                        {p.status === 'demandee' && p.demandeur_email && (
                          <button
                            onClick={() => { void handleSendProposition(p.id); }}
                            className="p-1.5 hover:bg-blue-50 rounded-lg transition" title={`Envoyer à ${p.demandeur_email}`}
                          >
                            <Send size={18} className="text-blue-600" />
                          </button>
                        )}
                        {p.status === 'brouillon' && (
                          <button
                            onClick={() => updateStatus(p.id, 'envoyee')}
                            className="p-1.5 hover:bg-muted rounded-lg transition" title="Marquer comme envoyée"
                          >
                            <Send size={18} className="text-blue-600" />
                          </button>
                        )}
                        {(p.status === 'brouillon' || p.status === 'envoyee') && (
                          <button
                            onClick={() => updateStatus(p.id, 'validee')}
                            className="p-1.5 hover:bg-primary-50 rounded-lg transition" title="Valider (BON POUR ACCORD)"
                          >
                            <Check size={18} className="text-green-600" />
                          </button>
                        )}
                        <button
                          onClick={(e) => deleteProposition(e, p.id, `${p.enfant_prenom} ${p.enfant_nom}`)}
                          className="p-1.5 hover:bg-red-50 rounded-lg transition text-gray-400 hover:text-red-600" title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <AdminPagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPage={(p) => setPage(p)} />
        </div>
      )}

      {/* APERÇU VISUEL */}
      <DialogPrimitive.Root open={!!preview} onOpenChange={(open) => { if (!open) setPreview(null); }}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <DialogPrimitive.Content
            className="fixed inset-0 flex items-center justify-center z-50 p-4 focus:outline-none"
            aria-describedby={undefined}
          >
            <DialogPrimitive.Title className="sr-only">Aperçu proposition tarifaire</DialogPrimitive.Title>
          {preview && (
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            {/* Header orange */}
            <div className="bg-secondary text-white px-8 py-5 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">Association Groupe et Découverte</p>
                  <h2 className="text-xl font-bold mt-1">Proposition Tarifaire</h2>
                </div>
                <button onClick={() => setPreview(null)} className="p-2 hover:bg-white/20 rounded-full transition">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="px-8 py-6 space-y-6">
              {/* Destinataire */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 uppercase font-medium mb-1">Structure sociale</p>
                <p className="font-semibold">{preview.structure_nom}</p>
                {preview.structure_adresse && <p className="text-sm text-gray-600">{preview.structure_adresse}</p>}
                <p className="text-sm text-gray-600">{preview.structure_cp} {preview.structure_ville}</p>
              </div>

              {/* Infos inscription */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium mb-1">Enfant</p>
                  <p className="font-semibold">{preview.enfant_nom.toUpperCase()} {preview.enfant_prenom}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium mb-1">Séjour</p>
                  <p className="font-semibold text-orange-600">{preview.sejour_titre}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium mb-1">Période</p>
                  <p className="font-medium">{formatDate(preview.session_start)} → {formatDate(preview.session_end)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium mb-1">Ville de départ</p>
                  <p className="font-medium capitalize">{preview.ville_depart}</p>
                </div>
              </div>

              {/* Tarification */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3 border-b pb-2">Tarification</h3>
                <div className="space-y-2">
                  <div className="flex justify-between py-1">
                    <span className="text-gray-600">Montant du séjour</span>
                    <span className="font-medium">{formatPrice(preview.prix_sejour)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-600">Transport</span>
                    <span className="font-medium">{formatPrice(preview.prix_transport)}</span>
                  </div>
                  {preview.encadrement && (
                    <div className="flex justify-between py-1">
                      <span className="text-gray-600">Encadrement renforcé</span>
                      <span className="font-medium">{formatPrice(preview.prix_encadrement)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1">
                    <span className="text-gray-600">Adhésion</span>
                    <span className="font-medium">Comprise</span>
                  </div>
                  <div className="flex justify-between pt-3 mt-2 border-t-2 border-orange-500">
                    <span className="text-lg font-bold">Total</span>
                    <span className="text-lg font-bold text-orange-600">{formatPrice(preview.prix_total)}</span>
                  </div>
                </div>
              </div>

              {/* BON POUR ACCORD */}
              <div className="bg-gray-50 rounded-lg p-5 border-2 border-dashed border-gray-300 text-center">
                <p className="font-bold text-orange-600 text-lg mb-2">BON POUR ACCORD</p>
                <p className="text-sm text-gray-500">Nom et qualité du signataire : _______________________</p>
                <p className="text-sm text-gray-500 mt-1">Date : ____/____/________&nbsp;&nbsp;&nbsp;&nbsp;Signature et cachet :</p>
              </div>

              {/* Statut */}
              <div className="flex items-center justify-between pt-2">
                <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium ${(STATUS_LABELS[preview.status] || STATUS_LABELS.brouillon).color}`}>
                  {(STATUS_LABELS[preview.status] || STATUS_LABELS.brouillon).label}
                </span>
                <button
                  onClick={() => { downloadPdf(preview.id); }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-pill hover:bg-secondary/90 transition"
                >
                  <Download size={18} />
                  Télécharger le PDF
                </button>
              </div>
            </div>
          </div>
          )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
