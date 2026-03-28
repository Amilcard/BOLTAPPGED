'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { STORAGE_KEYS, formatDate } from '@/lib/utils';
import { Eye, FileCheck, FileClock, Trash2, Building2 } from 'lucide-react';
import { InscriptionSupabase } from '@/lib/types';
import { useAdminUI } from '@/components/admin/admin-ui';

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
  { value: 'en_attente', label: 'En attente', color: 'bg-blue-100 text-blue-700' },
  { value: 'validee', label: 'Validée', color: 'bg-green-100 text-green-700' },
  { value: 'refusee', label: 'Refusée', color: 'bg-red-100 text-red-700' },
  { value: 'annulee', label: 'Annulée', color: 'bg-gray-100 text-gray-500' },
];

const PAYMENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_payment: { label: 'En attente', color: 'bg-orange-100 text-orange-700' },
  paid: { label: 'Payé', color: 'bg-green-100 text-green-700' },
  failed: { label: 'Échoué', color: 'bg-red-100 text-red-700' },
};

function DossierBadge({ completude, gedSentAt }: { completude: any; gedSentAt?: string | null }) {
  if (!completude) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        <FileClock size={12} /> Non commencé
      </span>
    );
  }

  const fiches = [completude.bulletin, completude.sanitaire, completude.liaison, completude.renseignements].filter(Boolean).length;
  const total = 4;
  const hasPJ = completude.pj_count > 0;
  const hasVaccins = completude.pj_vaccins;
  const isComplete = fiches === total; // 4/4 blocs obligatoires

  if (gedSentAt) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300">
        <FileCheck size={12} /> ✓ Envoyé
      </span>
    );
  }

  if (isComplete) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <FileCheck size={12} /> Complet
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
        {fiches}/{total} fiches
      </span>
      <div className="flex gap-1">
        <span className={`text-[10px] font-bold px-1 rounded ${completude.bulletin ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`} title="Bulletin d'inscription">B</span>
        <span className={`text-[10px] font-bold px-1 rounded ${completude.sanitaire ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`} title="Fiche sanitaire">S</span>
        <span className={`text-[10px] font-bold px-1 rounded ${completude.liaison ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`} title="Fiche de liaison">L</span>
        <span className={`text-[10px] font-bold px-1 rounded ${completude.renseignements ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`} title="Fiche de renseignements">R</span>
        <span className={`text-[10px] font-bold px-1 rounded ${hasVaccins ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`} title="Carnet de vaccinations">V</span>
        <span className={`text-[10px] font-bold px-1 rounded ${hasPJ ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`} title="Pièces jointes">PJ</span>
      </div>
    </div>
  );
}

export default function AdminDemandes() {
  const router = useRouter();
  const { confirm, toast } = useAdminUI();
  const [inscriptions, setInscriptions] = useState<InscriptionSupabase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [structures, setStructures] = useState<StructureOption[]>([]);
  const [selectedStructure, setSelectedStructure] = useState('');

  const fetchInscriptions = async () => {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.AUTH);
      const params = new URLSearchParams();
      if (selectedStructure) params.set('structure_id', selectedStructure);
      const res = await fetch(`/api/admin/inscriptions?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setInscriptions(await res.json());
      } else {
        toast('Erreur de chargement des demandes. Rechargez la page.');
      }
    } catch (err) {
      console.error('Erreur chargement inscriptions:', err);
      toast('Erreur réseau. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInscriptions(); }, [selectedStructure]);

  useEffect(() => {
    const loadStructures = async () => {
      try {
        const token = localStorage.getItem(STORAGE_KEYS.AUTH);
        const res = await fetch('/api/admin/structures', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setStructures((data.structures || []).map((s: { id: string; name: string; city: string; code: string }) => ({
            id: s.id, name: s.name, city: s.city, code: s.code,
          })));
        }
      } catch { /* silent */ }
    };
    loadStructures();
  }, []);

  const handleStatusChange = async (id: string, status: string) => {
    const DESTRUCTIVE = ['refusee', 'annulee'];
    const LABELS: Record<string, string> = { refusee: 'Refusée', annulee: 'Annulée' };
    const doChange = async () => {
      const token = localStorage.getItem(STORAGE_KEYS.AUTH);
      const res = await fetch(`/api/admin/inscriptions/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast(`Erreur mise à jour statut : ${err?.error?.message ?? 'Erreur inconnue'}`);
      }
      fetchInscriptions();
    };
    if (DESTRUCTIVE.includes(status)) {
      confirm(`Passer cette inscription en "${LABELS[status]}" ? Cette action est difficile à annuler.`, doChange);
    } else {
      doChange();
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string, jeune: string) => {
    e.preventDefault();
    e.stopPropagation();
    confirm(`Supprimer définitivement l'inscription de ${jeune} ? Cette action est irréversible.`, async () => {
      try {
        const token = localStorage.getItem(STORAGE_KEYS.AUTH);
        const res = await fetch(`/api/admin/inscriptions/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast(`Erreur suppression : ${err?.error?.message || res.status}`);
          return;
        }
        fetchInscriptions();
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
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {[...Array(5)].map((_, i) => (
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
                value={selectedStructure}
                onChange={e => setSelectedStructure(e.target.value)}
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
            type="text"
            placeholder="Rechercher un référent, enfant, structure…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm w-72 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
          Aucune inscription pour le moment.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
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
                  const isEnRetard = !(insc as any).ged_sent_at && daysSince(insc.created_at) > 7;
                  return (
                    <tr key={insc.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/admin/demandes/${insc.id}`)}>
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
                        {(insc as any).sejour_titre || insc.sejour_slug}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600 max-w-[160px]">
                        <div className="font-medium truncate" title={insc.referent_nom}>{insc.referent_nom}</div>
                        {insc.organisation && <div className="text-xs text-gray-400 truncate" title={insc.organisation}>{insc.organisation}</div>}
                      </td>
                      <td className="px-4 py-4">
                        <DossierBadge completude={(insc as any).dossier_completude} gedSentAt={(insc as any).ged_sent_at} />
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
                          className={`px-3 py-1 rounded-full text-xs font-medium ${statusStyle.color} cursor-pointer`}
                          value={insc.status}
                          onChange={(e) => handleStatusChange(insc.id, e.target.value)}
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => router.push(`/admin/demandes/${insc.id}`)}
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
        </div>
      )}
    </div>
  );
}
