'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/utils';
import { Eye, Trash2, Building2 } from 'lucide-react';
import { InscriptionSupabase, InscriptionEnriched } from '@/lib/types';
import { useAdminUI } from '@/components/admin/admin-ui';
import { DossierBadge } from '@/components/admin/DossierBadge';
import { AdminPagination } from '@/components/ui/AdminPagination';

interface StructureOption {
  id: string;
  name: string;
  city: string;
  code: string;
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

const STATUS_OPTIONS = [
  { value: 'en_attente', label: 'En attente', color: 'bg-accent/10 text-accent' },
  { value: 'validee', label: 'Validée', color: 'bg-primary-50 text-primary' },
  { value: 'refusee', label: 'Refusée', color: 'bg-red-100 text-red-700' },
  { value: 'annulee', label: 'Annulée', color: 'bg-gray-100 text-gray-500' },
];

const PAYMENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_payment: { label: 'En attente', color: 'bg-orange-100 text-orange-700' },
  paid: { label: 'Payé', color: 'bg-primary-50 text-primary' },
  failed: { label: 'Échoué', color: 'bg-red-100 text-red-700' },
};

export default function AdminDemandes() {
  const router = useRouter();
  const { confirm, toast } = useAdminUI();
  const [inscriptions, setInscriptions] = useState<InscriptionSupabase[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusChanging, setStatusChanging] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [structures, setStructures] = useState<StructureOption[]>([]);
  const [selectedStructure, setSelectedStructure] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 50;
  const [total, setTotal] = useState(0);
  const totalPages = Math.ceil(total / LIMIT);

  const fetchInscriptions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedStructure) params.set('structure_id', selectedStructure);
      params.set('page', String(page));
      params.set('limit', String(LIMIT));
      const res = await fetch(`/api/admin/inscriptions?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setInscriptions(json.data ?? json);
        setTotal(json.total ?? (json.data ?? json).length);
      } else {
        toast('Erreur de chargement des demandes. Rechargez la page.');
      }
    } catch (err) {
      console.error('Erreur chargement inscriptions:', err);
      toast('Erreur réseau. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }, [selectedStructure, page, toast]);

  useEffect(() => { void fetchInscriptions(); }, [fetchInscriptions]);

  useEffect(() => {
    const loadStructures = async () => {
      try {
        const res = await fetch('/api/admin/structures');
        if (res.ok) {
          const data = await res.json();
          setStructures((data.structures || []).map((s: { id: string; name: string; city: string; code: string }) => ({
            id: s.id, name: s.name, city: s.city, code: s.code,
          })));
        }
      } catch { /* silent */ }
    };
    void loadStructures();
  }, []);

  const handleStatusChange = async (id: string, status: string) => {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(id)) return;
    const DESTRUCTIVE = ['refusee', 'annulee'];
    const LABELS: Record<string, string> = { refusee: 'Refusée', annulee: 'Annulée' };
    const doChange = async () => {
      setStatusChanging(id);
      try {
        // nosemgrep: javascript.lang.security.audit.ssrf.http-request.js-ssrf -- relative URL, UUID validated above
        const res = await fetch(`/api/admin/inscriptions/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast(`Erreur mise à jour statut : ${err?.error?.message ?? 'Erreur inconnue'}`);
        }
        void fetchInscriptions();
      } finally {
        setStatusChanging(null);
      }
    };
    if (DESTRUCTIVE.includes(status)) {
      const statusLabel = Object.prototype.hasOwnProperty.call(LABELS, status) ? LABELS[status] : status;
      confirm(`Passer cette inscription en "${statusLabel}" ? Cette action est difficile à annuler.`, doChange);
    } else {
      void doChange();
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string, jeune: string) => {
    e.preventDefault();
    e.stopPropagation();
    const UUID_DEL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_DEL.test(id)) return;
    confirm(`Supprimer définitivement l'inscription de ${jeune} ? Cette action est irréversible.`, async () => {
      try {
        // nosemgrep: javascript.lang.security.audit.ssrf.http-request.js-ssrf -- relative URL, UUID validated above
        const res = await fetch(`/api/admin/inscriptions/${id}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast(`Erreur suppression : ${err?.error?.message || res.status}`);
          return;
        }
        void fetchInscriptions();
      } catch {
        toast('Erreur réseau lors de la suppression');
      }
    });
  };

  const getStatusStyle = (status: string) =>
    STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];

  const getPaymentStyle = (paymentStatus?: string) =>
    PAYMENT_STATUS_LABELS[paymentStatus || 'pending_payment'] || PAYMENT_STATUS_LABELS.pending_payment;

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-primary mb-8">Demandes</h1>
        <div className="bg-white rounded-brand shadow-card-sm overflow-hidden">
          {[...Array(5)].map((_, i) => (
            // deepsource-ignore JS-0437 -- static array skeleton, i is the stable key
            <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-4 bg-gray-200 rounded w-32 flex-1" />
              <div className="h-4 bg-gray-200 rounded w-20" />
              <div className="h-6 bg-gray-200 rounded-full w-24" />
              <div className="h-4 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const filtered = search.trim()
    ? inscriptions.filter(i =>
        `${i.referent_nom} ${i.organisation} ${i.referent_email} ${i.jeune_prenom} ${i.jeune_nom}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : inscriptions;

  return (
    <div>
      <div className="flex items-center justify-between mb-8 gap-4">
        <h1 className="text-3xl font-bold text-primary">
          Demandes ({filtered.length}{search ? ` / ${inscriptions.length}` : ''})
        </h1>
        <div className="flex items-center gap-3">
          {structures.length > 0 && (
            <div className="relative">
              <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                aria-label="Filtrer par structure"
                value={selectedStructure}
                onChange={e => { setPage(1); setSelectedStructure(e.target.value); }}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[200px]"
              >
                <option value="">Toutes les structures</option>
                {structures.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.city})</option>
                ))}
              </select>
            </div>
          )}
          <input
            aria-label="Rechercher un référent, enfant ou structure"
            type="text"
            placeholder="Rechercher un référent, enfant, structure…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm w-72 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-brand shadow-card p-8 text-center text-gray-500">
          Aucune inscription pour le moment.
        </div>
      ) : (
        <div className="bg-white rounded-brand shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" aria-label="Liste des demandes">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Date</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Ref.</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Jeune</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Séjour</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Référent</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Documents</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Prix</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Paiement</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Statut</th>
                  <th className="px-4 py-4 text-right text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((insc) => {
                  const statusStyle = getStatusStyle(insc.status);
                  const paymentStyle = getPaymentStyle(insc.payment_status);
                  const isEnRetard = !(insc as InscriptionEnriched).ged_sent_at && daysSince(insc.created_at) > 7;
                  return (
                    <tr key={insc.id} className="hover:bg-gray-50 cursor-pointer" tabIndex={0} onClick={() => void router.push(`/admin/demandes/${insc.id}`)} onKeyDown={(e) => { if (e.key === 'Enter') void router.push(`/admin/demandes/${insc.id}`); }}>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {formatDate(insc.created_at)}
                      </td>
                      <td className="px-4 py-4 text-xs font-mono text-gray-500">
                        <div className="flex flex-col gap-1">
                          <span>{insc.dossier_ref || '—'}</span>
                          {isEnRetard && (
                            <span data-testid="badge-retard" className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                              En retard
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 font-medium">
                        {insc.jeune_prenom} {insc.jeune_nom}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {(insc as InscriptionEnriched).sejour_titre || insc.sejour_slug}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600 max-w-[160px]">
                        <div className="font-medium truncate" title={insc.referent_nom}>{insc.referent_nom}</div>
                        {insc.organisation && <div className="text-xs text-gray-400 truncate" title={insc.organisation}>{insc.organisation}</div>}
                      </td>
                      <td className="px-4 py-4">
                        <DossierBadge completude={(insc as InscriptionEnriched).dossier_completude} gedSentAt={(insc as InscriptionEnriched).ged_sent_at} />
                      </td>
                      <td className="px-4 py-4 text-sm font-medium">
                        {insc.price_total} €
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${paymentStyle.color}`}>
                          {paymentStyle.label}
                        </span>
                      </td>
                      <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                        <select
                          aria-label={`Statut de ${insc.jeune_prenom || ''} ${insc.jeune_nom || ''}`}
                          className={`px-3 py-1 rounded-full text-xs font-medium ${statusStyle.color} cursor-pointer disabled:opacity-50 disabled:cursor-wait`}
                          disabled={statusChanging === insc.id}
                          value={insc.status}
                          onChange={(e) => { void handleStatusChange(insc.id, e.target.value); }}
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => void router.push(`/admin/demandes/${insc.id}`)}
                            className="p-2 hover:bg-gray-100 rounded"
                            title="Détails"
                            aria-label={`Voir le dossier de ${insc.jeune_prenom} ${insc.jeune_nom}`}
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={(e) => handleDelete(e, insc.id, `${insc.jeune_prenom} ${insc.jeune_nom}`)}
                            className="p-2 hover:bg-red-50 rounded text-gray-400 hover:text-red-600 transition"
                            title="Supprimer"
                            aria-label={`Supprimer l'inscription de ${insc.jeune_prenom} ${insc.jeune_nom}`}
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
          </div>
          <AdminPagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPage={(p) => setPage(p)} />
        </div>
      )}
    </div>
  );
}
